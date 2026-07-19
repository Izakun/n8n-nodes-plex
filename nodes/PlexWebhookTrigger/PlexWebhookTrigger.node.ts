import type {
	IDataObject,
	IHookFunctions,
	IHttpRequestOptions,
	INodeType,
	INodeTypeDescription,
	IWebhookFunctions,
	IWebhookResponseData,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';

const PLEX_TV = 'https://plex.tv/api/v2/user/webhooks';

const EVENT_MAP: Record<string, string> = {
	play: 'media.play',
	pause: 'media.pause',
	resume: 'media.resume',
	stop: 'media.stop',
	scrobble: 'media.scrobble',
	rate: 'media.rate',
	newItem: 'library.new',
};

async function plexHeaders(ctx: IHookFunctions): Promise<Record<string, string>> {
	const credentials = await ctx.getCredentials('plexApi');
	return {
		'X-Plex-Token': credentials.token as string,
		'X-Plex-Client-Identifier': 'n8n-nodes-plex',
		Accept: 'application/json',
	};
}

async function getWebhookUrls(ctx: IHookFunctions): Promise<string[]> {
	const res = await ctx.helpers.httpRequest({
		method: 'GET',
		url: PLEX_TV,
		headers: await plexHeaders(ctx),
		json: true,
	} as IHttpRequestOptions);
	const list = Array.isArray(res) ? (res as unknown[]) : [];
	return list
		.map((w) => (typeof w === 'string' ? w : (w as { url?: string }).url))
		.filter((u): u is string => typeof u === 'string' && u.length > 0);
}

async function setWebhookUrls(ctx: IHookFunctions, urls: string[]): Promise<void> {
	const params = new URLSearchParams();
	if (urls.length === 0) params.append('urls[]', '');
	else for (const u of urls) params.append('urls[]', u);
	const headers = await plexHeaders(ctx);
	headers['Content-Type'] = 'application/x-www-form-urlencoded';
	await ctx.helpers.httpRequest({
		method: 'POST',
		url: PLEX_TV,
		headers,
		body: params.toString(),
	} as IHttpRequestOptions);
}

export class PlexWebhookTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Plex Webhook Trigger',
		name: 'plexWebhookTrigger',
		icon: { light: 'file:plex.svg', dark: 'file:plex.dark.svg' },
		group: ['trigger'],
		version: [1],
		subtitle: '={{ "Events: " + ($parameter["events"].join(", ") || "all") }}',
		description: 'Starts a workflow instantly on Plex webhook events (requires Plex Pass)',
		defaults: { name: 'Plex Webhook Trigger' },
		usableAsTool: true,
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'plexApi', required: true }],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'plex',
				isFullPath: false,
			},
		],
		properties: [
			{
				displayName:
					'When you activate this workflow, the webhook is registered automatically in your Plex account (via plex.tv) and removed on deactivation — no manual setup. Requires an active Plex Pass and that your n8n instance is reachable from the internet (a public Webhook URL).',
				name: 'setup',
				type: 'notice',
				default: '',
			},
			{
				displayName: 'Events',
				name: 'events',
				type: 'multiOptions',
				options: [
					{ name: 'Media Rated', value: 'rate' },
					{ name: 'New in Library', value: 'newItem' },
					{ name: 'Playback Paused', value: 'pause' },
					{ name: 'Playback Resumed', value: 'resume' },
					{ name: 'Playback Started', value: 'play' },
					{ name: 'Playback Stopped', value: 'stop' },
					{ name: 'Watched (Scrobble)', value: 'scrobble' },
				],
				default: ['play', 'stop'],
				description: 'Which Plex events fire the trigger (leave empty for all)',
			},
		],
	};

	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				const url = this.getNodeWebhookUrl('default') as string;
				return (await getWebhookUrls(this)).includes(url);
			},
			async create(this: IHookFunctions): Promise<boolean> {
				const url = this.getNodeWebhookUrl('default') as string;
				const urls = await getWebhookUrls(this);
				if (!urls.includes(url)) await setWebhookUrls(this, [...urls, url]);
				return true;
			},
			async delete(this: IHookFunctions): Promise<boolean> {
				const url = this.getNodeWebhookUrl('default') as string;
				const urls = await getWebhookUrls(this);
				const filtered = urls.filter((u) => u !== url);
				if (filtered.length !== urls.length) await setWebhookUrls(this, filtered);
				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const events = this.getNodeParameter('events', []) as string[];
		const body = this.getBodyData() as IDataObject;

		// Plex posts multipart/form-data; n8n exposes the fields under `body.data`
		// (JSON posts land directly on `body`). The `payload` field is a JSON string.
		const data = ((body.data as IDataObject) ?? body) as IDataObject;
		const raw = data.payload ?? body.payload;

		let payload: IDataObject | undefined;
		if (typeof raw === 'string') {
			try {
				payload = JSON.parse(raw) as IDataObject;
			} catch {
				payload = undefined;
			}
		} else if (raw && typeof raw === 'object') {
			payload = raw as IDataObject;
		} else if (typeof data.event === 'string') {
			payload = data;
		}

		if (!payload) return { webhookResponse: 'OK' };

		if (events.length > 0) {
			const wanted = events.map((e) => EVENT_MAP[e]);
			if (typeof payload.event === 'string' && !wanted.includes(payload.event)) {
				return { webhookResponse: 'OK' };
			}
		}

		return { workflowData: [[{ json: payload }]], webhookResponse: 'OK' };
	}
}
