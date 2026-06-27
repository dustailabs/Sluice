import { ClaudeStructured } from '../nodes/ClaudeStructured/ClaudeStructured.node';
import * as generic from '../nodes/ClaudeStructured/GenericFunctions';

jest.mock('../nodes/ClaudeStructured/GenericFunctions');
const mockedCallClaude = generic.callClaude as jest.Mock;

const SCHEMA = {
	type: 'object',
	required: ['category'],
	properties: { category: { type: 'string', enum: ['billing', 'technical'] } },
};

function buildContext(items: Array<Record<string, unknown>>, params: Record<string, unknown>) {
	const inputData = items.map((json) => ({ json }));
	return {
		getInputData: () => inputData,
		getNodeParameter: (name: string, _i: number) => params[name],
		getNode: () => ({ name: 'Claude Structured' }),
		continueOnFail: () => false,
		helpers: {},
	} as any;
}

describe('ClaudeStructured.execute', () => {
	beforeEach(() => {
		mockedCallClaude.mockReset();
	});

	it('routes a first-try valid response to the Validated output', async () => {
		mockedCallClaude.mockResolvedValueOnce('{"category": "billing"}');

		const node = new ClaudeStructured();
		const ctx = buildContext([{ text: 'I was charged twice' }], {
			model: 'claude-sonnet-4-6',
			systemPrompt: 'classify',
			userPrompt: 'I was charged twice',
			jsonSchema: SCHEMA,
			maxRetries: 2,
			maxTokens: 256,
		});

		const [validated, failed] = await node.execute.call(ctx);

		expect(validated).toHaveLength(1);
		expect(failed).toHaveLength(0);
		expect((validated[0].json as any).output).toEqual({ category: 'billing' });
		expect(mockedCallClaude).toHaveBeenCalledTimes(1);
	});

	it('retries once on invalid output, then succeeds', async () => {
		mockedCallClaude
			.mockResolvedValueOnce('{"category": "not-a-real-category"}')
			.mockResolvedValueOnce('{"category": "technical"}');

		const node = new ClaudeStructured();
		const ctx = buildContext([{ text: 'app crashed' }], {
			model: 'claude-sonnet-4-6',
			systemPrompt: 'classify',
			userPrompt: 'app crashed',
			jsonSchema: SCHEMA,
			maxRetries: 2,
			maxTokens: 256,
		});

		const [validated, failed] = await node.execute.call(ctx);

		expect(mockedCallClaude).toHaveBeenCalledTimes(2);
		expect(validated).toHaveLength(1);
		expect(failed).toHaveLength(0);
		expect((validated[0].json as any).output).toEqual({ category: 'technical' });

		// the retry call should include the corrective message
		const secondCallMessages = mockedCallClaude.mock.calls[1][1].userMessages;
		expect(secondCallMessages.some((m: any) => m.content.includes('did not match'))).toBe(true);
	});

	it('routes to Failed Validation once retries are exhausted', async () => {
		mockedCallClaude.mockResolvedValue('{"category": "still-wrong"}');

		const node = new ClaudeStructured();
		const ctx = buildContext([{ text: 'unclear ticket' }], {
			model: 'claude-sonnet-4-6',
			systemPrompt: 'classify',
			userPrompt: 'unclear ticket',
			jsonSchema: SCHEMA,
			maxRetries: 1,
			maxTokens: 256,
		});

		const [validated, failed] = await node.execute.call(ctx);

		expect(mockedCallClaude).toHaveBeenCalledTimes(2); // initial + 1 retry
		expect(validated).toHaveLength(0);
		expect(failed).toHaveLength(1);
		expect((failed[0].json as any).validationErrors.length).toBeGreaterThan(0);
	});

	it('processes multiple items independently', async () => {
		mockedCallClaude
			.mockResolvedValueOnce('{"category": "billing"}')
			.mockResolvedValueOnce('{"category": "technical"}');

		const node = new ClaudeStructured();
		const ctx = buildContext(
			[{ text: 'item one' }, { text: 'item two' }],
			{
				model: 'claude-sonnet-4-6',
				systemPrompt: 'classify',
				userPrompt: 'classify this',
				jsonSchema: SCHEMA,
				maxRetries: 0,
				maxTokens: 256,
			},
		);

		const [validated, failed] = await node.execute.call(ctx);

		expect(validated).toHaveLength(2);
		expect(failed).toHaveLength(0);
	});
});
