import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	Icon,
	INodeProperties,
} from 'n8n-workflow';

export class PlexApi implements ICredentialType {
	name = 'plexApi';

	displayName = 'Plex API';

	icon: Icon = { light: 'file:plex.svg', dark: 'file:plex.dark.svg' };

	documentationUrl = 'https://support.plex.tv/articles/204059436-finding-an-authentication-token-x-plex-token/';

	properties: INodeProperties[] = [
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'http://plex:32400',
			required: true,
			placeholder: 'http://plex:32400',
			description: 'Base URL of the Plex Media Server (no trailing slash)',
		},
		{
			displayName: 'X-Plex-Token',
			name: 'token',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description:
				'Plex authentication token. See the linked docs on how to find your X-Plex-Token.',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				'X-Plex-Token': '={{$credentials.token}}',
				Accept: 'application/json',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl}}',
			url: '/library/sections',
		},
	};
}
