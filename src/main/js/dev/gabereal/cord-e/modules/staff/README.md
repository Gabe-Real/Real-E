# Staff module

Bot-wide roles for running Real-E (separate from any server's Discord roles), used by `/reale` and `/requests`.

| Level | Who decides | Can use |
|---|---|---|
| **Developer** | `BOT_OWNER_IDS` in `.env` (falls back to the app owner) | everything, including `/reale dev` |
| **Management** | developers, with `/reale dev` → Toggle management access | `/reale management` + staff tools, approve/deny requests |
| **Staff** | management, with `/reale management` → Toggle staff access | `/reale staff` (look-ups), view requests |

Each level can use every tier below it. Every `/reale` action is saved (View recent staff command logs).
Replies are public, except the invite link, staff logs and evaluate (and any "fill this in" errors), which only you see.

`/reale` is hidden from members without Administrator in servers. Staff without admin can use it in DMs with Real-E.

## Actions

**Staff:** check staff · server info · bots in a server · debug Real-E's permissions · one-use invite to join a server · list servers (paged) · banned servers

**Management:** staff command logs · ban/unban a server · allow a server · toggle staff

Server access (approving, revoking, the request board) lives in `/requests`.

**Developer:** toggle management · restart · set status / rich presence (or reset to the Christmas countdown) · evaluate JavaScript (secrets are hidden from the output) · bot stats

## Adding an action

Add a function to the right file in `actions/` and a `[label, value]` entry to its `choices`.
The function gets the interaction and returns a reply: `card()` for results, `oops()` for errors (always private). Add its name to `PRIVATE` in `commands/staff/reale.js` if only the user should see it.
