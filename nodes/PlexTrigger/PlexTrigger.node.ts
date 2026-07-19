import type {
	IDataObject,
	IHttpRequestOptions,
	INodeType,
	INodeTypeDescription,
	ITriggerFunctions,
	ITriggerResponse,
	IWebhookFunctions,
	IWebhookResponseData,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';

// Plex webhook event names keyed by our option values.
const EVENT_MAP: Record<string, string> = {
	play: 'media.play',
	pause: 'media.pause',
	resume: 'media.resume',
	stop: 'media.stop',
	scrobble: 'media.scrobble',
	rate: 'media.rate',
	newItem: 'library.new',
};

// Node >=22 exposes a global WebSocket (undici); no runtime dependency needed.
const WS = (globalThis as unknown as { WebSocket?: new (url: string) => WsLike }).WebSocket;

interface WsLike {
	addEventListener(type: string, cb: (ev: { data?: unknown }) => void): void;
	close(): void;
}

export class PlexTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Plex Trigger',
		name: 'plexTrigger',
		icon: { light: 'file:plex.svg', dark: 'file:plex.dark.svg' },
		group: ['trigger'],
		version: [1],
		subtitle: '={{"Mode: " + $parameter["mode"]}}',
		description: 'Starts a workflow on Plex events (playback started/stopped, watched, new media, …)',
		defaults: { name: 'Plex Trigger' },
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
				displayName: 'Mode',
				name: 'mode',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Auto (WebSocket, Falls Back to Polling)',
						value: 'auto',
						description: 'Recommended. Real-time via WebSocket; automatically switches to polling if it drops',
					},
					{
						name: 'Polling',
						value: 'polling',
						description: 'Most compatible. Checks active sessions every few seconds',
					},
					{
						name: 'WebSocket',
						value: 'websocket',
						description: 'Real-time notification stream, no Plex Pass required',
					},
					{
						name: 'Webhook',
						value: 'webhook',
						description: 'Instant and richest events. Requires Plex Pass and pasting this node URL into Plex settings',
					},
				],
				default: 'auto',
			},
			{
				displayName: 'Events',
				name: 'events',
				type: 'multiOptions',
				options: [
					{ name: 'Media Rated', value: 'rate', description: 'An item was rated (webhook only)' },
					{ name: 'New in Library', value: 'newItem', description: 'A new item was added (webhook only)' },
					{ name: 'Playback Paused', value: 'pause', description: 'A stream was paused' },
					{ name: 'Playback Resumed', value: 'resume', description: 'A stream resumed' },
					{ name: 'Playback Started', value: 'play', description: 'A stream started' },
					{ name: 'Playback Stopped', value: 'stop', description: 'A stream stopped' },
					{ name: 'Watched (Scrobble)', value: 'scrobble', description: 'An item passed the watched threshold (webhook only)' },
				],
				default: ['play', 'stop'],
				description: 'Which events fire the trigger. Leave empty for all. Rated/New/Watched require Webhook mode.',
			},
			{
				displayName: 'Poll Interval (Seconds)',
				name: 'pollInterval',
				type: 'number',
				typeOptions: { minValue: 2 },
				default: 15,
				displayOptions: { show: { mode: ['polling'] } },
			},
			{
				displayName:
					'Copy this node\'s <b>Production URL</b> (shown above) into Plex → Settings → Webhooks (app.plex.tv). Requires an active Plex Pass.',
				name: 'webhookNotice',
				type: 'notice',
				default: '',
				displayOptions: { show: { mode: ['webhook'] } },
			},
		],
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const mode = this.getNodeParameter('mode') as string;
		if (mode !== 'webhook') return {};

		const events = this.getNodeParameter('events', []) as string[];
		const body = this.getBodyData() as IDataObject;

		let payload: IDataObject | undefined;
		const raw = body.payload;
		if (typeof raw === 'string') {
			try {
				payload = JSON.parse(raw) as IDataObject;
			} catch {
				payload = undefined;
			}
		} else if (raw && typeof raw === 'object') {
			payload = raw as IDataObject;
		} else if (body.event) {
			payload = body;
		}

		if (!payload) return {};

		if (events.length > 0) {
			const wanted = events.map((e) => EVENT_MAP[e]);
			if (typeof payload.event === 'string' && !wanted.includes(payload.event)) {
				return {};
			}
		}

		return { workflowData: [[{ json: payload }]] };
	}

	async trigger(this: ITriggerFunctions): Promise<ITriggerResponse> {
		const mode = this.getNodeParameter('mode') as string;

		// Webhook mode is handled entirely by webhook(); nothing to run here.
		if (mode === 'webhook') {
			return { closeFunction: async () => {} };
		}

		const credentials = await this.getCredentials('plexApi');
		const baseURL = (credentials.baseUrl as string).replace(/\/+$/, '');
		const token = credentials.token as string;
		const events = this.getNodeParameter('events', []) as string[];
		const wants = (e: string) => events.length === 0 || events.includes(e);

		const emit = (json: IDataObject) => this.emit([[{ json }]]);

		// ── Polling machinery (also used as the WebSocket fallback) ──────────
		const seen = new Map<string, string>(); // sessionKey -> player state
		let primed = false;
		const pollOnce = async () => {
			const res = (await this.helpers.httpRequestWithAuthentication.call(this, 'plexApi', {
				method: 'GET',
				baseURL,
				url: '/status/sessions',
				json: true,
			} as IHttpRequestOptions)) as IDataObject;
			const mc = (res?.MediaContainer ?? {}) as IDataObject;
			const list = (mc.Metadata ?? []) as IDataObject[];
			const current = new Map<string, string>();
			for (const m of list) {
				const player = (m.Player ?? {}) as IDataObject;
				const key = String(m.sessionKey ?? (m.Session as IDataObject)?.id ?? m.key ?? '');
				const state = String(player.state ?? 'playing');
				current.set(key, state);
				const prev = seen.get(key);
				if (prev === undefined) {
					if (primed && wants('play')) emit({ event: 'media.play', state, ...m });
				} else if (prev !== state) {
					if (state === 'paused' && wants('pause')) emit({ event: 'media.pause', state, ...m });
					else if (state === 'playing' && wants('resume')) emit({ event: 'media.resume', state, ...m });
				}
			}
			if (primed && wants('stop')) {
				for (const [key] of seen) {
					if (!current.has(key)) emit({ event: 'media.stop', sessionKey: key });
				}
			}
			seen.clear();
			for (const [k, v] of current) seen.set(k, v);
			primed = true;
		};

		let pollTimer: ReturnType<typeof setInterval> | undefined;
		const startPolling = (intervalSec: number) => {
			if (pollTimer) return;
			void pollOnce().catch(() => {});
			pollTimer = setInterval(() => void pollOnce().catch(() => {}), Math.max(2, intervalSec) * 1000);
		};

		// ── Pure polling mode ────────────────────────────────────────────────
		if (mode === 'polling') {
			const interval = this.getNodeParameter('pollInterval', 15) as number;
			startPolling(interval);
			return {
				closeFunction: async () => {
					if (pollTimer) clearInterval(pollTimer);
				},
				manualTriggerFunction: async () => {},
			};
		}

		// ── WebSocket mode (and Auto) ─────────────────────────────────────────
		if (!WS) {
			// No global WebSocket available → degrade to polling.
			startPolling(15);
			return {
				closeFunction: async () => {
					if (pollTimer) clearInterval(pollTimer);
				},
				manualTriggerFunction: async () => {},
			};
		}

		const wsUrl =
			baseURL.replace(/^http/, 'ws') +
			'/:/websocket/notifications?X-Plex-Token=' +
			encodeURIComponent(token);
		let ws: WsLike | undefined;
		let closed = false;

		const handleMessage = (ev: { data?: unknown }) => {
			try {
				const text = typeof ev.data === 'string' ? ev.data : String(ev.data);
				const data = JSON.parse(text) as IDataObject;
				const nc = (data.NotificationContainer ?? data) as IDataObject;
				if (nc.type === 'playing' && Array.isArray(nc.PlaySessionStateNotification)) {
					for (const n of nc.PlaySessionStateNotification as IDataObject[]) {
						const state = String(n.state ?? '');
						if (state === 'playing' && (wants('play') || wants('resume')))
							emit({ event: 'media.play', ...n });
						else if (state === 'paused' && wants('pause')) emit({ event: 'media.pause', ...n });
						else if (state === 'stopped' && wants('stop')) emit({ event: 'media.stop', ...n });
					}
				}
			} catch {
				// ignore non-JSON keep-alives
			}
		};

		const connect = () => {
			if (closed) return;
			try {
				ws = new WS(wsUrl);
			} catch (error) {
				if (mode === 'auto') startPolling(15);
				return;
			}
			ws.addEventListener('message', handleMessage);
			ws.addEventListener('error', () => {});
			ws.addEventListener('close', () => {
				if (closed) return;
				// Degrade to polling (Auto) or retry (WebSocket) after a short delay.
				if (mode === 'auto') startPolling(15);
			});
		};
		connect();

		return {
			closeFunction: async () => {
				closed = true;
				if (pollTimer) clearInterval(pollTimer);
				try {
					ws?.close();
				} catch {
					// noop
				}
			},
			manualTriggerFunction: async () => {},
		};
	}
}
