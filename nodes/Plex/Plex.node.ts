import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

export class Plex implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Plex',
		name: 'plex',
		icon: { light: 'file:plex.svg', dark: 'file:plex.dark.svg' },
		group: ['input'],
		version: [1],
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Read from a Plex Media Server (libraries, sessions, search, metadata)',
		defaults: { name: 'Plex' },
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		credentials: [{ name: 'plexApi', required: true }],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Library', value: 'library' },
					{ name: 'Media', value: 'media' },
					{ name: 'Search', value: 'search' },
					{ name: 'Server', value: 'server' },
					{ name: 'Session', value: 'session' },
				],
				default: 'library',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['server'] } },
				options: [
					{ name: 'Get Identity', value: 'getIdentity', action: 'Get server identity' },
					{ name: 'Get Info', value: 'getInfo', action: 'Get server info' },
				],
				default: 'getInfo',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['library'] } },
				options: [
					{ name: 'Get Items', value: 'getItems', action: 'Get all items in a library section' },
					{ name: 'Get Libraries', value: 'getLibraries', action: 'Get all library sections' },
				],
				default: 'getLibraries',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['session'] } },
				options: [
					{ name: 'Get Active', value: 'getActive', action: 'Get current playback sessions' },
					{ name: 'Get History', value: 'getHistory', action: 'Get playback history' },
				],
				default: 'getActive',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['search'] } },
				options: [{ name: 'Search', value: 'search', action: 'Search across all libraries' }],
				default: 'search',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['media'] } },
				options: [
					{ name: 'Get Metadata', value: 'getMetadata', action: 'Get metadata for an item by rating key' },
				],
				default: 'getMetadata',
			},
			{
				displayName: 'Library Section ID',
				name: 'sectionId',
				type: 'string',
				default: '',
				required: true,
				description: 'The numeric ID of the library section (from Get Libraries)',
				displayOptions: { show: { resource: ['library'], operation: ['getItems'] } },
			},
			{
				displayName: 'Rating Key',
				name: 'ratingKey',
				type: 'string',
				default: '',
				required: true,
				description: 'The ratingKey of the metadata item to fetch',
				displayOptions: { show: { resource: ['media'], operation: ['getMetadata'] } },
			},
			{
				displayName: 'Query',
				name: 'query',
				type: 'string',
				default: '',
				required: true,
				description: 'The search term',
				displayOptions: { show: { resource: ['search'], operation: ['search'] } },
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const credentials = await this.getCredentials('plexApi', i);
				const baseURL = (credentials.baseUrl as string).replace(/\/+$/, '');
				const resource = this.getNodeParameter('resource', i) as string;
				const operation = this.getNodeParameter('operation', i) as string;
				const param = <T>(name: string, fallback?: T) =>
					this.getNodeParameter(name, i, fallback as T) as T;

				const request = (url: string, qs?: IDataObject) =>
					this.helpers.httpRequestWithAuthentication.call(this, 'plexApi', {
						method: 'GET' as IHttpRequestMethods,
						baseURL,
						url,
						qs,
						json: true,
					} as IHttpRequestOptions);

				const handlers: Record<string, () => Promise<unknown>> = {
					'server:getInfo': () => request('/'),
					'server:getIdentity': () => request('/identity'),
					'library:getLibraries': () => request('/library/sections'),
					'library:getItems': () => request(`/library/sections/${param<string>('sectionId')}/all`),
					'session:getActive': () => request('/status/sessions'),
					'session:getHistory': () => request('/status/sessions/history/all'),
					'search:search': () => request('/hubs/search', { query: param<string>('query') }),
					'media:getMetadata': () => request(`/library/metadata/${param<string>('ratingKey')}`),
				};

				const handler = handlers[`${resource}:${operation}`];
				if (!handler) {
					throw new NodeOperationError(
						this.getNode(),
						`Unsupported operation "${resource}:${operation}"`,
						{ itemIndex: i },
					);
				}

				const response = (await handler()) as IDataObject;
				// Plex wraps everything in a MediaContainer; emit its child elements as items.
				const container = (response?.MediaContainer ?? response) as IDataObject;
				const list = (container?.Metadata ??
					container?.Directory ??
					container?.Hub) as IDataObject[] | undefined;

				if (Array.isArray(list) && list.length > 0) {
					for (const element of list) {
						returnData.push({ json: element, pairedItem: { item: i } });
					}
				} else {
					returnData.push({ json: container ?? {}, pairedItem: { item: i } });
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({ json: { error: (error as Error).message }, pairedItem: { item: i } });
					continue;
				}
				throw new NodeApiError(this.getNode(), error as JsonObject, { itemIndex: i });
			}
		}

		return [returnData];
	}
}
