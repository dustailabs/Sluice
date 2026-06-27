import type { IExecuteFunctions, IHttpRequestOptions } from 'n8n-workflow';

export interface ClaudeMessageParams {
	model: string;
	systemPrompt: string;
	userMessages: Array<{ role: 'user' | 'assistant'; content: string }>;
	maxTokens: number;
}

/**
 * Calls Anthropic's /v1/messages endpoint via n8n's credential-aware HTTP
 * helper, so the request automatically picks up the headers declared in
 * `AnthropicApi.credentials.ts` without this function ever seeing the key.
 *
 * Isolated in its own module so node tests can mock exactly this function
 * and exercise the retry/validation loop without any real HTTP call.
 */
export async function callClaude(
	ctx: IExecuteFunctions,
	params: ClaudeMessageParams,
): Promise<string> {
	const options: IHttpRequestOptions = {
		method: 'POST',
		url: 'https://api.anthropic.com/v1/messages',
		body: {
			model: params.model,
			max_tokens: params.maxTokens,
			system: params.systemPrompt,
			messages: params.userMessages,
		},
		json: true,
	};

	const response = (await ctx.helpers.httpRequestWithAuthentication.call(
		ctx,
		'anthropicApi',
		options,
	)) as { content?: Array<{ type: string; text?: string }> };

	const textBlock = response.content?.find((block) => block.type === 'text');
	if (!textBlock?.text) {
		throw new Error('Claude response contained no text content block.');
	}
	return textBlock.text;
}
