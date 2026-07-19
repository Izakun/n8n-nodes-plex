# n8n-nodes-plex

An [n8n](https://n8n.io) community node for **Plex Media Server**. Read your
libraries, see what's playing right now, search across your server, and fetch
metadata — all from your workflows.

[Installation](#installation) · [Credentials](#credentials) · [Operations](#operations) · [Usage example](#usage-example)

## Installation

Follow the [community nodes installation guide](https://docs.n8n.io/integrations/community-nodes/installation/):
in n8n go to **Settings → Community Nodes → Install** and enter
`n8n-nodes-plex`.

## Credentials

The node authenticates with an **X-Plex-Token**.

1. Find your token — see Plex's guide:
   [Finding an authentication token](https://support.plex.tv/articles/204059436-finding-an-authentication-token-x-plex-token/).
2. In n8n create a **Plex API** credential:
   - **Base URL** — your server, e.g. `http://plex:32400` (no trailing slash).
   - **X-Plex-Token** — the token from step 1.

The credential's *Test* button calls `/library/sections` to verify the token.

## Operations

| Resource | Operations |
|----------|------------|
| **Server** | Get Info, Get Identity, Get Media Providers, Get Preferences, Set Preference, Optimize Database, Clean Bundles |
| **Library** | Get Libraries, Get Library, Get Items, Get Recently Added, Get Collections, Scan, Empty Trash, Analyze |
| **Media** | Get Metadata, Get Related, Get Similar, Refresh, Rate, Mark Played, Mark Unplayed, Delete |
| **Session** | Get Active, Get History, Terminate |
| **Search** | Search |
| **Hub** | Get Global, Get Continue Watching, Get Promoted, Get Section Hubs |
| **Playlist** | Get Many, Get, Get Items, Delete |
| **Butler** | Get Tasks, Run All Tasks, Run Task, Stop All Tasks |
| **Updater** | Get Status, Check For Updates, Apply Update |

Read operations return each element of the Plex `MediaContainer` (`Metadata`,
`Directory`, `Hub`, `Setting`, …) as a separate n8n item. Write/action
operations (Scan, Rate, Terminate, Set Preference, Apply Update, …) return
`{ "success": true }`.

> ⚠️ Some operations are **destructive or administrative** (Media → Delete,
> Library → Empty Trash, Session → Terminate, Updater → Apply Update). Use them
> deliberately.

## Usage example

**"What's playing on Plex right now?"**

1. Add the **Plex** node with the *Plex API* credential.
2. Set **Resource** = `Session`, **Operation** = `Get Active`.
3. Execute. Each current stream is returned as an item, e.g.:

```json
{
  "title": "Interstellar",
  "type": "movie",
  "year": 2014,
  "User": { "title": "alan", "id": "123456789" },
  "Player": { "product": "Plex Web", "state": "playing", "address": "10.0.1.20" },
  "Session": { "id": "abcdef", "bandwidth": 5212, "location": "lan" }
}
```

A common follow-up: connect a **Discord** or **Telegram** node to be notified
whenever someone starts watching something.

To list your libraries first, use **Library → Get Libraries**; take the `key`
of a section and feed it into **Library → Get Items** (`Library Section ID`)
to page through its content.

## Plex Trigger

The **Plex Trigger** node starts a workflow on playback changes. It polls the
server's active sessions (`/status/sessions`) on the schedule you set on the
node and fires on **Playback Started / Paused / Resumed / Stopped**. Works on
any Plex server (no Plex Pass needed).

- Pick the events you care about (default: Started + Stopped).
- Set the poll schedule on the node (down to every minute).
- Already-running streams don't fire on activation; only changes afterwards do.
  The **Fetch Test Event** button shows what's playing right now.

Example: *Plex Trigger (Playback Started) -> Discord* -> "Someone started watching X".

> **Want instant, richer events?** Plex also supports **webhooks** (Plex Pass):
> media.play/pause/resume/stop/scrobble/rate and library.new, pushed instantly.
> Use a native **Webhook** node in n8n and paste its URL into Plex ->
> Settings -> Webhooks (app.plex.tv). Polling here is the zero-config,
> no-Plex-Pass alternative.

## Compatibility

Tested against Plex Media Server API 1.x. Node.js 20+.

## Resources

- [Plex Media Server API docs](https://developer.plex.tv/pms/)
- [n8n community nodes docs](https://docs.n8n.io/integrations/community-nodes/)

## License

[MIT](LICENSE.md)
