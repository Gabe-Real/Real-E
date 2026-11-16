# Real-E

*(formerly Cord-E)*

A private Discord moderation and utility bot made by **Gabe_Real**, running in a handful of my own and partnered servers.

[![License: GPL-3.0-or-later](https://img.shields.io/badge/license-GPL--3.0--or--later-blue)](LICENSE)
[![discord.js](https://img.shields.io/badge/discord.js-v14-5865F2?logo=discord&logoColor=white)](https://discord.js.org)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.17-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org)

> **Want Real-E in your server?** It's invite-only. Run `/request` in a server that has it, or ask in
> [my Discord](https://discord.gabereal.co.uk). If you add it without approval, it'll leave by itself.

---

## Features

### Moderation
- **Ban, kick, mute and warn**, including temp bans that survive restarts and bans for users who aren't in the server
- **Case system**: every action gets a numbered case. Look cases up with `/case`, see a user's record with `/history`, or right-click a user → **Mod History**
- **Warnings** with automatic punishments when someone hits a threshold
- **Mod notes**, mod logs and message logs
- **Tickets** with HTML transcripts
- **Ban sync** across a network of servers
- Banned reactions, reply-ping protection and slowmode

### Minecraft log parser
Post a `latest.log`, crash report or paste link (mclo.gs, pastebin, gist and more) in a watched channel and Real-E replies with:
- Loader, Minecraft version, Java, mods and system info
- Problems in plain English, with what they mean and how to fix them: missing dependencies, incompatible mods, mixin failures, wrong Java version and more
- Support for **Fabric, Quilt, Forge, NeoForge** and **Paper/Spigot/Velocity** servers
- A one-click **upload to mclo.gs** button

You can also right-click any message → **Apps → Parse Minecraft Log**. Ported from my Kotlin bot [Cozy-crashes](https://github.com/Gabe-Real/Cozy-crashes).

### YouTube & Twitch alerts
`/notify` posts when a channel uploads (videos, Shorts and streams) or a streamer goes live, with an optional role ping and custom message. YouTube needs no API key.

### Utility
Reaction roles, role management, welcome messages, tags (including quick tags), a pinboard, `/post` with a pop-up editor,
user/avatar/banner info, Minecraft skins and UUIDs, QR codes, image tools, dictionary/thesaurus/Steam lookups,
moving members between voice channels, and **per-server bot profiles** (`/botprofile`).

### Access & staff
- `/request` and `/requests`: servers ask for access and staff approve or deny them. Approved servers get an invite locked to their server
- `/reale`: bot-wide **staff → management → developer** tools for looking after the servers Real-E is in

---

## Self-hosting

Real-E is open source, so you're welcome to run your own copy (see [License](#license)).

**You'll need:** [Node.js](https://nodejs.org) 18.17 or newer, a [MongoDB](https://www.mongodb.com/atlas) database, and a bot from the [Discord Developer Portal](https://discord.com/developers/applications) with the **Server Members** and **Message Content** intents turned on.

```bash
git clone https://github.com/Gabe-Real/Real-E.git
cd Real-E
npm install
cp .env.example .env      # then fill it in
npm start
```

`npm start` deploys the slash commands and then starts the bot. To deploy commands on their own, use `npm run deploy`.

### Configuration (`.env`)

| Variable | Required | What it's for |
|---|---|---|
| `TOKEN` | ✅ | Your bot's token |
| `CLIENT_ID` | ✅ | Your bot's user ID |
| `MONGODB_URI` | ✅ | MongoDB connection string |
| `TESTING_GUILD_ID` | ✅ | Server commands deploy to while testing (always allowed) |
| `DEPLOY_GLOBAL` | | `true` to deploy commands to every server |
| `BOT_OWNER_IDS` | | Developer user IDs for `/reale dev`, comma separated (defaults to the app owner) |
| `TWITCH_CLIENT_ID` / `TWITCH_CLIENT_SECRET` | | For Twitch alerts ([create an app](https://dev.twitch.tv/console)) |
| `ACCESS_REQUEST_URL` | | Where unapproved servers are pointed to |
| `INVITE_PERMISSIONS` | | Permissions in approved invite links (default `8`, Administrator) |

> On the first start, every server the bot is already in is added to the allowlist. Approved invites need **Public Bot**
> turned on in the Developer Portal. Keep the install link set to *None* so it isn't publicly addable.

---

## Project structure

```
index.js                  Starts everything: loads commands, events and modules
start.js                  Deploys commands, then runs index.js
deploy-commands.js        Registers slash commands with Discord
src/main/js/dev/gabereal/cord-e/
├── commands/             One folder per category, one file per command
├── handlers/             Events, buttons and modal (pop-up) handlers
├── modules/              Bigger self-contained features
│   ├── logparser/        Minecraft log parser (retrievers → parsers → processors)
│   ├── access/           Access requests and the server allowlist
│   └── staff/            Bot staff roles and /reale tools
├── schemas/              MongoDB models
└── utils/                Shared helpers (cases, modlog, permissions, UI, ...)
```

Each module has its own `README.md` explaining how it works and how to extend it.

---

## Contributing

Found a bug or have an idea? [Open an issue](https://github.com/Gabe-Real/Real-E/issues). Pull requests are welcome too,
but please open an issue first for anything big so we can chat about it.

---

## License

Real-E is licensed under the [GNU General Public License v3.0 or later](LICENSE). You can use, change and share it,
but any version you distribute has to stay open source under the same licence and keep the credit.

The log parser is based on [QuiltMC/cozy-discord](https://github.com/QuiltMC/cozy-discord) via my fork
[Cozy-crashes](https://github.com/Gabe-Real/Cozy-crashes).
