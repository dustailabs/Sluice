import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import { callClaude } from './GenericFunctions';
import {
	ClaudeOutputError,
	buildRetryMessage,
	parseClaudeJson,
	validateAgainstSchema,
} from './validation';

export class ClaudeStructured implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Claude Structured',
		name: 'claudeStructured',
		icon: 'file:claude.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["model"]}}',
		description:
			'Call Claude and get back JSON that matches a schema you define — validated, with automatic retries on bad output.',
		defaults: { name: 'Claude Structured' },
		inputs: [NodeConnectionTypes.Main],
		// Two outputs: validated JSON, and anything that never validated
		// after retries — the same "drop and surface, never silently pass
		// through" principle Cairn applies to hallucinated citations.
		outputs: [NodeConnectionTypes.Main, NodeConnectionTypes.Main],
		outputNames: ['Validated', 'Failed Validation'],
		credentials: [{ name: 'anthropicApi', required: true }],
		properties: [
			{
				displayName: 'Model',
				name: 'model',
				type: 'string',
				default: 'claude-sonnet-4-6',
				description: 'Anthropic model name, e.g. claude-sonnet-4-6 or claude-haiku-4-5-20251001.',
			},
			{
				displayName: 'System Prompt',
				name: 'systemPrompt',
				type: 'string',
				typeOptions: { rows: 3 },
				default: '',
				description: 'Instructions describing the extraction/classification task.',
			},
			{
				displayName: 'User Prompt',
				name: 'userPrompt',
				type: 'string',
				typeOptions: { rows: 5 },
				default: '={{$json}}',
				description:
					'The content to send to Claude for this item. Use n8n expressions to pull from the input item.',
			},
			{
				displayName: 'JSON Schema',
				name: 'jsonSchema',
				type: 'json',
				default:
					'{\n  "type": "object",\n  "required": ["result"],\n  "properties": {\n    "result": { "type": "string" }\n  }\n}',
				description: "Claude's output must validate against this JSON Schema.",
			},
			{
				displayName: 'Max Retries',
				name: 'maxRetries',
				type: 'number',
				default: 2,
				description:
					'How many times to ask Claude to fix its output before routing the item to "Failed Validation".',
			},
			{
				displayName: 'Max Tokens',
				name: 'maxTokens',
				type: 'number',
				default: 1024,
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const validated: INodeExecutionData[] = [];
		const failed: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			const model = this.getNodeParameter('model', i) as string;
			const systemPrompt = this.getNodeParameter('systemPrompt', i) as string;
			const userPrompt = this.getNodeParameter('userPrompt', i) as string;
			const schemaRaw = this.getNodeParameter('jsonSchema', i);
			const maxRetries = this.getNodeParameter('maxRetries', i) as number;
			const maxTokens = this.getNodeParameter('maxTokens', i) as number;

			const schema = (typeof schemaRaw === 'string' ? JSON.parse(schemaRaw) : schemaRaw) as object;

			const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
				{ role: 'user', content: userPrompt },
			];

			let attempt = 0;
			let lastErrors: string[] = [];
			let succeeded = false;

			while (attempt <= maxRetries) {
				let rawText: string;
				try {
					// eslint-disable-next-line no-await-in-loop
					rawText = await callClaude(this, { model, systemPrompt, userMessages: messages, maxTokens });
				} catch (err) {
					if (this.continueOnFail()) {
						failed.push({ json: { ...items[i].json, error: (err as Error).message }, pairedItem: i });
						break;
					}
					throw new NodeOperationError(this.getNode(), err as Error, { itemIndex: i });
				}

				try {
					const parsed = parseClaudeJson(rawText);
					const result = validateAgainstSchema(parsed, schema);
					if (result.valid) {
						validated.push({
							json: { ...items[i].json, output: parsed as object },
							pairedItem: i,
						});
						succeeded = true;
						break;
					}
					lastErrors = result.errors;
				} catch (err) {
					lastErrors = [err instanceof ClaudeOutputError ? err.message : String(err)];
				}

				attempt += 1;
				if (attempt <= maxRetries) {
					messages.push({ role: 'assistant', content: rawText! });
					messages.push({ role: 'user', content: buildRetryMessage(lastErrors) });
				}
			}

			if (!succeeded && !failed.some((f) => f.pairedItem === i)) {
				failed.push({
					json: { ...items[i].json, validationErrors: lastErrors, attempts: attempt },
					pairedItem: i,
				});
			}
		}

		return [validated, failed];
	}
}
