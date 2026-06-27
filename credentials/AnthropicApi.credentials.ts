import type { ICredentialType, INodeProperties, IAuthenticateGeneric } from 'n8n-workflow';

export class AnthropicApi implements ICredentialType {
	name = 'anthropicApi';

	displayName = 'Anthropic API';

	documentationUrl = 'https://docs.anthropic.com/en/api/getting-started';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
		},
		{
			displayName: 'Anthropic Version',
			name: 'anthropicVersion',
			type: 'string',
			default: '2023-06-01',
			description: 'The Anthropic API version header to send with every request.',
		},
	];

	// n8n attaches these headers to every request made with this credential
	// via httpRequestWithAuthentication — the node itself never touches the key.
	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				'x-api-key': '={{$credentials.apiKey}}',
				'anthropic-version': '={{$credentials.anthropicVersion}}',
			},
		},
	};
}
