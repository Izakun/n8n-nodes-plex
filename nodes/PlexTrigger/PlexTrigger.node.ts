import type {
	IDataObject,
	IHttpRequestOptions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IPollFunctions,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';

export class PlexTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Plex Trigger',
		name: 'plexTrigger',
		icon: { light: 'file:plex.svg', dark: 'file:plex.dark.svg' },
		group: ['trigger'],
		version: [1],
		subtitle: '={{ "Events: " + ($parameter["events"].join(", ") || "all") }}',
		description: 'Starts a workflow when a Plex playback starts, pauses, resumes or stops',
		defaults: { name: 'Plex Trigger' },
		polling: true,
		usableAsTool: true,
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'plexApi', required: true }],
		properties: [
			{
				displayName: 'Events',
				name: 'events',
				type: 'multiOptions',
				options: [
					{ name: 'Playback Paused', value: 'pause', description: 'A stream was paused' },
					{ name: 'Playback Resumed', value: 'resume', description: 'A paused stream resumed' },
					{ name: 'Playback Started', value: 'play', description: 'A new stream started' },
					{ name: 'Playback Stopped', value: 'stop', description: 'A stream stopped' },
				],
				default: ['play', 'stop'],
				description: 'Which playback events fire the trigger (leave empty for all)',
			},
			{
				displayName:
					'Checks Plex on the schedule set above. For instant, richer events (watched, rated, new media) use Plex webhooks with a native Webhook node (requires Plex Pass).',
				name: 'notice',
				type: 'notice',
				default: '',
			},
		],
	};

	async poll(this: IPollFunctions): Promise<INodeExecutionData[][] | null> {
		const events = this.getNodeParameter('events', []) as string[];
		const wants = (e: string) => events.length === 0 || events.includes(e);
		const isManual = this.getMode() === 'manual';

		const staticData = this.getWorkflowStaticData('node') as {
			seen?: Record<string, string>;
			primed?: boolean;
		};
		const seen = staticData.seen ?? {};
		const primed = staticData.primed === true;

		const credentials = await this.getCredentials('plexApi');
		const baseURL = (credentials.baseUrl as string).replace(/\/+$/, '');

		const res = (await this.helpers.httpRequestWithAuthentication.call(this, 'plexApi', {
			method: 'GET',
			baseURL,
			url: '/status/sessions',
			json: true,
		} as IHttpRequestOptions)) as IDataObject;
		const mc = (res?.MediaContainer ?? {}) as IDataObject;
		const list = (mc.Metadata ?? []) as IDataObject[];

		const current: Record<string, string> = {};
		const out: INodeExecutionData[] = [];
		const push = (json: IDataObject) => out.push({ json });

		for (const m of list) {
			const key = String(m.sessionKey ?? (m.Session as IDataObject)?.id ?? m.key ?? '');
			const state = String((m.Player as IDataObject)?.state ?? 'playing');
			current[key] = state;
			const prev = seen[key];
			if (prev === undefined) {
				// New session. Emit an event matching its ACTUAL state (a paused stream is
				// not a "play"). In manual (test) mode we always report the current session;
				// in production we stay silent on the very first poll so already-running
				// streams don't fire on activation.
				if (isManual || primed) {
					if ((state === 'playing' || state === 'buffering') && wants('play'))
						push({ event: 'media.play', state, ...m });
					else if (state === 'paused' && wants('pause'))
						push({ event: 'media.pause', state, ...m });
				}
			} else if (prev !== state) {
				if (state === 'paused' && wants('pause')) push({ event: 'media.pause', state, ...m });
				else if ((state === 'playing' || state === 'buffering') && wants('resume'))
					push({ event: 'media.resume', state, ...m });
			}
		}
		if (primed && wants('stop')) {
			for (const key of Object.keys(seen)) {
				if (!(key in current)) push({ event: 'media.stop', sessionKey: key });
			}
		}

		staticData.seen = current;
		staticData.primed = true;

		return out.length > 0 ? [out] : null;
	}
}
