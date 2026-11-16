# Staff module

Bot-wide roles for running Real-E (separate from any server's Discord roles), used by `/reale` and `/requests`.

| Level | Who decides | Can use |
|---|---|---|
| **Developer** | `BOT_OWNER_IDS` in `.env` (falls back to the app owner) | everything, including `/reale dev` |
| **Management** | developers, with `/reale dev` → Toggle management access | `/reale management` + staff tools, approve/deny requests |
| **Staff** | management, with `/reale management` → Toggle staff access | `/reale staff` (look-ups), view requests |

Each level can use every tier below it. Every `/reale` action is saved (View recent staff command logs) and,
if a staff log channel is set, posted there too.

`/reale` is hidden from members without Administrator in servers. Staff without admin can use it in DMs with Real-E.

## Actions

**Staff:** check staff · server info · bots in a server · debug Real-E's permissions · invite link · list servers (paged) · most popular servers · banned servers · access requests

**Management:** send a message to a channel · announcement pop-up (channel dropdown, title, message, role ping) · DM a user · staff log channel · staff command logs · leave a server · ban/unban a server · allow a server · toggle staff · access requests

**Developer:** toggle management · restart · set status / rich presence (or reset to the Christmas countdown) · evaluate JavaScript (secrets are hidden from the output) · bot stats

## Adding an action

Add a function to the right file in `actions/` and a `[label, value]` entry to its `choices`.
The function gets the interaction and returns a reply (use `card()` from `ui.js`), or `{ modal }` to open a pop-up.
