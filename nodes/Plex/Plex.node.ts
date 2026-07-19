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

const LIB = 'com.plexapp.plugins.library';

export class Plex implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Plex',
		name: 'plex',
		icon: { light: 'file:plex.svg', dark: 'file:plex.dark.svg' },
		group: ['input'],
		version: [1],
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Read from and control a Plex Media Server',
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
					{ name: 'Butler', value: 'butler' },
					{ name: 'Hub', value: 'hub' },
					{ name: 'Library', value: 'library' },
					{ name: 'Media', value: 'media' },
					{ name: 'Playlist', value: 'playlist' },
					{ name: 'Search', value: 'search' },
					{ name: 'Server', value: 'server' },
					{ name: 'Session', value: 'session' },
					{ name: 'Updater', value: 'updater' },
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
					{ name: 'Clean Bundles', value: 'cleanBundles', action: 'Clean unused bundles' },
					{ name: 'Get Identity', value: 'getIdentity', action: 'Get server identity' },
					{ name: 'Get Info', value: 'getInfo', action: 'Get server info' },
					{ name: 'Get Media Providers', value: 'getMediaProviders', action: 'Get media providers' },
					{ name: 'Get Preferences', value: 'getPreferences', action: 'Get server preferences' },
					{ name: 'Optimize Database', value: 'optimizeDatabase', action: 'Optimize the database' },
					{ name: 'Set Preference', value: 'setPreference', action: 'Set a server preference' },
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
					{ name: 'Analyze', value: 'analyze', action: 'Analyze a library section' },
					{ name: 'Empty Trash', value: 'emptyTrash', action: 'Empty a library section trash' },
					{ name: 'Get Collections', value: 'getCollections', action: 'Get collections in a section' },
					{ name: 'Get Items', value: 'getItems', action: 'Get all items in a section' },
					{ name: 'Get Libraries', value: 'getLibraries', action: 'Get all library sections' },
					{ name: 'Get Library', value: 'getLibrary', action: 'Get a library section' },
					{ name: 'Get Recently Added', value: 'getRecentlyAdded', action: 'Get recently added items' },
					{ name: 'Scan', value: 'scan', action: 'Scan a library section for new media' },
				],
				default: 'getLibraries',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['media'] } },
				options: [
					{ name: 'Delete', value: 'delete', action: 'Delete a media item' },
					{ name: 'Get Metadata', value: 'getMetadata', action: 'Get metadata for an item' },
					{ name: 'Get Related', value: 'getRelated', action: 'Get related items' },
					{ name: 'Get Similar', value: 'getSimilar', action: 'Get similar items' },
					{ name: 'Mark Played', value: 'markPlayed', action: 'Mark an item as played' },
					{ name: 'Mark Unplayed', value: 'markUnplayed', action: 'Mark an item as unplayed' },
					{ name: 'Rate', value: 'rate', action: 'Rate an item' },
					{ name: 'Refresh', value: 'refresh', action: 'Refresh metadata for an item' },
				],
				default: 'getMetadata',
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
					{ name: 'Terminate', value: 'terminate', action: 'Terminate a playback session' },
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
				displayOptions: { show: { resource: ['hub'] } },
				options: [
					{ name: 'Get Continue Watching', value: 'getContinueWatching', action: 'Get the continue watching hub' },
					{ name: 'Get Global', value: 'getGlobal', action: 'Get global hubs' },
					{ name: 'Get Promoted', value: 'getPromoted', action: 'Get promoted hubs' },
					{ name: 'Get Section Hubs', value: 'getForSection', action: 'Get hubs for a section' },
				],
				default: 'getGlobal',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['playlist'] } },
				options: [
					{ name: 'Delete', value: 'delete', action: 'Delete a playlist' },
					{ name: 'Get', value: 'get', action: 'Get a playlist' },
					{ name: 'Get Items', value: 'getItems', action: 'Get items in a playlist' },
					{ name: 'Get Many', value: 'getAll', action: 'Get many playlists' },
				],
				default: 'getAll',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['butler'] } },
				options: [
					{ name: 'Get Tasks', value: 'getTasks', action: 'Get all butler tasks' },
					{ name: 'Run All Tasks', value: 'runAll', action: 'Run all butler tasks' },
					{ name: 'Run Task', value: 'runTask', action: 'Run a single butler task' },
					{ name: 'Stop All Tasks', value: 'stopAll', action: 'Stop all butler tasks' },
				],
				default: 'getTasks',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['updater'] } },
				options: [
					{ name: 'Apply Update', value: 'apply', action: 'Apply a downloaded update' },
					{ name: 'Check For Updates', value: 'check', action: 'Check for updates' },
					{ name: 'Get Status', value: 'getStatus', action: 'Get updater status' },
				],
				default: 'getStatus',
			},

			// ── shared parameters ──────────────────────────────────────────────
			{
				displayName: 'Library Section ID',
				name: 'sectionId',
				type: 'string',
				default: '',
				required: true,
				description: 'Numeric ID of the library section (from Get Libraries)',
				displayOptions: {
					show: {
						resource: ['library', 'hub'],
						operation: [
							'getLibrary',
							'getItems',
							'getRecentlyAdded',
							'getCollections',
							'scan',
							'emptyTrash',
							'analyze',
							'getForSection',
						],
					},
				},
			},
			{
				displayName: 'Rating Key',
				name: 'ratingKey',
				type: 'string',
				default: '',
				required: true,
				description: 'The ratingKey of the metadata item',
				displayOptions: { show: { resource: ['media'] } },
			},
			{
				displayName: 'Rating',
				name: 'rating',
				type: 'number',
				typeOptions: { minValue: 0, maxValue: 10 },
				default: 8,
				required: true,
				description: 'Rating from 0 to 10',
				displayOptions: { show: { resource: ['media'], operation: ['rate'] } },
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
			{
				displayName: 'Playlist ID',
				name: 'playlistId',
				type: 'string',
				default: '',
				required: true,
				description: 'The ratingKey of the playlist',
				displayOptions: { show: { resource: ['playlist'], operation: ['get', 'getItems', 'delete'] } },
			},
			{
				displayName: 'Session ID',
				name: 'sessionId',
				type: 'string',
				default: '',
				required: true,
				description: 'The session ID (from Session → Get Active)',
				displayOptions: { show: { resource: ['session'], operation: ['terminate'] } },
			},
			{
				displayName: 'Reason',
				name: 'reason',
				type: 'string',
				default: '',
				description: 'Message shown to the user whose session is terminated',
				displayOptions: { show: { resource: ['session'], operation: ['terminate'] } },
			},
			{
				displayName: 'Preference Name',
				name: 'prefName',
				type: 'string',
				default: '',
				required: true,
				description: 'The preference ID to set (e.g. FriendlyName)',
				displayOptions: { show: { resource: ['server'], operation: ['setPreference'] } },
			},
			{
				displayName: 'Preference Value',
				name: 'prefValue',
				type: 'string',
				default: '',
				description: 'The value to set the preference to',
				displayOptions: { show: { resource: ['server'], operation: ['setPreference'] } },
			},
			{
				displayName: 'Task',
				name: 'task',
				type: 'string',
				default: '',
				required: true,
				placeholder: 'BackupDatabase',
				description:
					'Butler task name, e.g. BackupDatabase, RefreshLibraries, DeepMediaAnalysis, OptimizeDatabase',
				displayOptions: { show: { resource: ['butler'], operation: ['runTask'] } },
			},
			{
				displayName: 'Download',
				name: 'download',
				type: 'boolean',
				default: true,
				description: 'Whether to download any update that is found',
				displayOptions: { show: { resource: ['updater'], operation: ['check'] } },
			},
			{
				displayName: 'When',
				name: 'applyMode',
				type: 'options',
				options: [
					{ name: 'Install Now', value: 'now' },
					{ name: 'Install Tonight', value: 'tonight' },
					{ name: 'Skip This Version', value: 'skip' },
				],
				default: 'now',
				displayOptions: { show: { resource: ['updater'], operation: ['apply'] } },
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

				const request = (method: IHttpRequestMethods, url: string, qs?: IDataObject) =>
					this.helpers.httpRequestWithAuthentication.call(this, 'plexApi', {
						method,
						baseURL,
						url,
						qs,
						json: true,
					} as IHttpRequestOptions);

				const sectionId = () => encodeURIComponent(param<string>('sectionId'));
				const ratingKey = () => encodeURIComponent(param<string>('ratingKey'));

				const handlers: Record<string, () => Promise<unknown>> = {
					// Server
					'server:getInfo': () => request('GET', '/'),
					'server:getIdentity': () => request('GET', '/identity'),
					'server:getMediaProviders': () => request('GET', '/media/providers'),
					'server:getPreferences': () => request('GET', '/:/prefs'),
					'server:setPreference': () =>
						request('PUT', '/:/prefs', { [param<string>('prefName')]: param<string>('prefValue') }),
					'server:optimizeDatabase': () => request('PUT', '/library/optimize'),
					'server:cleanBundles': () => request('PUT', '/library/clean/bundles'),
					// Updater
					'updater:getStatus': () => request('GET', '/updater/status'),
					'updater:check': () =>
						request('PUT', '/updater/check', param<boolean>('download') ? { download: 1 } : undefined),
					'updater:apply': () => {
						const mode = param<string>('applyMode');
						const qs: IDataObject = mode === 'tonight' ? { tonight: 1 } : mode === 'skip' ? { skip: 1 } : {};
						return request('PUT', '/updater/apply', qs);
					},
					// Butler
					'butler:getTasks': () => request('GET', '/butler'),
					'butler:runAll': () => request('POST', '/butler'),
					'butler:runTask': () => request('POST', `/butler/${encodeURIComponent(param<string>('task'))}`),
					'butler:stopAll': () => request('DELETE', '/butler'),
					// Library
					'library:getLibraries': () => request('GET', '/library/sections'),
					'library:getLibrary': () => request('GET', `/library/sections/${sectionId()}`),
					'library:getItems': () => request('GET', `/library/sections/${sectionId()}/all`),
					'library:getRecentlyAdded': () =>
						request('GET', `/library/sections/${sectionId()}/all`, { sort: 'addedAt:desc' }),
					'library:getCollections': () => request('GET', `/library/sections/${sectionId()}/collections`),
					'library:scan': () => request('POST', `/library/sections/${sectionId()}/refresh`),
					'library:emptyTrash': () => request('PUT', `/library/sections/${sectionId()}/emptyTrash`),
					'library:analyze': () => request('PUT', `/library/sections/${sectionId()}/analyze`),
					// Media
					'media:getMetadata': () => request('GET', `/library/metadata/${ratingKey()}`),
					'media:getRelated': () => request('GET', `/library/metadata/${ratingKey()}/related`),
					'media:getSimilar': () => request('GET', `/library/metadata/${ratingKey()}/similar`),
					'media:refresh': () => request('PUT', `/library/metadata/${ratingKey()}/refresh`),
					'media:delete': () => request('DELETE', `/library/metadata/${ratingKey()}`),
					'media:markPlayed': () =>
						request('PUT', '/:/scrobble', { identifier: LIB, key: param<string>('ratingKey') }),
					'media:markUnplayed': () =>
						request('PUT', '/:/unscrobble', { identifier: LIB, key: param<string>('ratingKey') }),
					'media:rate': () =>
						request('PUT', '/:/rate', {
							identifier: LIB,
							key: param<string>('ratingKey'),
							rating: param<number>('rating'),
						}),
					// Session
					'session:getActive': () => request('GET', '/status/sessions'),
					'session:getHistory': () => request('GET', '/status/sessions/history/all'),
					'session:terminate': () =>
						request('POST', '/status/sessions/terminate', {
							sessionId: param<string>('sessionId'),
							reason: param<string>('reason', ''),
						}),
					// Search
					'search:search': () => request('GET', '/hubs/search', { query: param<string>('query') }),
					// Hubs
					'hub:getGlobal': () => request('GET', '/hubs'),
					'hub:getContinueWatching': () => request('GET', '/hubs/continueWatching'),
					'hub:getPromoted': () => request('GET', '/hubs/promoted'),
					'hub:getForSection': () => request('GET', `/hubs/sections/${sectionId()}`),
					// Playlists
					'playlist:getAll': () => request('GET', '/playlists'),
					'playlist:get': () => request('GET', `/playlists/${encodeURIComponent(param<string>('playlistId'))}`),
					'playlist:getItems': () =>
						request('GET', `/playlists/${encodeURIComponent(param<string>('playlistId'))}/items`),
					'playlist:delete': () =>
						request('DELETE', `/playlists/${encodeURIComponent(param<string>('playlistId'))}`),
				};

				const handler = handlers[`${resource}:${operation}`];
				if (!handler) {
					throw new NodeOperationError(
						this.getNode(),
						`Unsupported operation "${resource}:${operation}"`,
						{ itemIndex: i },
					);
				}

				const response = await handler();

				// Write/action endpoints often return an empty body.
				if (response === undefined || response === null || typeof response !== 'object') {
					returnData.push({ json: { success: true }, pairedItem: { item: i } });
					continue;
				}

				// Plex wraps payloads in a MediaContainer; emit the first array child as items.
				const container = ((response as IDataObject).MediaContainer ?? response) as IDataObject;
				const known = [
					'Metadata',
					'Directory',
					'Hub',
					'Setting',
					'MediaProvider',
					'Playlist',
					'Video',
					'Track',
					'Account',
				];
				const list =
					(known.map((k) => container[k]).find(Array.isArray) as IDataObject[] | undefined) ??
					(Object.values(container).find(Array.isArray) as IDataObject[] | undefined);

				if (Array.isArray(list) && list.length > 0) {
					for (const element of list) {
						returnData.push({ json: element, pairedItem: { item: i } });
					}
				} else {
					returnData.push({ json: container, pairedItem: { item: i } });
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
