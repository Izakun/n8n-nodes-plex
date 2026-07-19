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

| Resource | Operation | Description |
|----------|-----------|-------------|
| Server   | Get Info | Server capabilities (`GET /`) |
| Server   | Get Identity | Machine identifier & version (`GET /identity`) |
| Library  | Get Libraries | List all library sections (`GET /library/sections`) |
| Library  | Get Items | All items in a section (`GET /library/sections/{id}/all`) |
| Session  | Get Active | Current playback sessions (`GET /status/sessions`) |
| Session  | Get History | Playback history (`GET /status/sessions/history/all`) |
| Search   | Search | Search across libraries (`GET /hubs/search`) |
| Media    | Get Metadata | Item details by rating key (`GET /library/metadata/{ratingKey}`) |

Responses are returned unwrapped: each element of the Plex `MediaContainer`
(`Metadata`, `Directory`, or `Hub`) becomes a separate n8n item.

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

## Compatibility

Tested against Plex Media Server API 1.x. Node.js 20+.

## Resources

- [Plex Media Server API docs](https://developer.plex.tv/pms/)
- [n8n community nodes docs](https://docs.n8n.io/integrations/community-nodes/)

## License

[MIT](LICENSE.md)
