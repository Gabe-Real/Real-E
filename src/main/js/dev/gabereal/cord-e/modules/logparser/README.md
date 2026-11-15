# Log parser module

A JavaScript port of the log parser from [Cozy-crashes](https://github.com/Gabe-Real/Cozy-crashes)
(itself based on [QuiltMC/cozy-discord](https://github.com/QuiltMC/cozy-discord)), with Forge and NeoForge support added.

Someone posts a Minecraft log in a watched channel (as a file or a paste link) and the bot replies with
the environment, loader, mod count and any problems it spotted, plus a button to upload it to mclo.gs.

## Using it

- `/logparser channel add|remove|list`: choose which channels are watched (Manage Server). Forum channels work too: every post inside them gets checked.
- Right-click any message → **Apps → Parse Minecraft Log**: parse a log anywhere, only you see the result.

## How it works

Same pipeline as Cozy:

1. **Retrievers** (`retrievers/`) get the text: message attachments (`.log`, `.txt`, `.log.gz`) and paste sites (`retrievers/pastebins.js`).
2. **Parsers** (`parsers/`) read facts: launcher, loader, Minecraft version, environment, mod/plugin lists.
3. **Processors** (`processors/`) look for problems and add messages.

Everything is listed in `config.js` and runs in `order` (lower first). A handler can have a `predicate(log)`
to only run for some logs (for example, only Forge logs). If a processor calls `log.abort(reason)`, nothing
after it runs and the result shows just that reason in red.

## Adding a check

Create a file in `processors/`, then add it to `config.js`:

```js
const { Order } = require('../../constants');

module.exports = {
    id: 'my-check',
    order: Order.Default,
    predicate: (log) => log.getLoader('fabric') !== null,   // optional
    process(log) {
        if (log.content.includes('something bad')) {
            log.addProblem('**Something bad happened.** Here is how to fix it.');
        }
    },
};
```

Useful on `log`: `content`, `minecraftVersion`, `getLoader(id)`, `getMod(id)`, `userMods`, `environment`,
`launcher`, `addMessage()`, `addProblem()` (also turns the result yellow), `abort()`, and `sections` for an extra block.

## Supported

| | Loader / version | Mods | Problem checks |
|---|---|---|---|
| Fabric | ✅ | ✅ latest.log + crash reports | incompatible mods + suggested fix, missing APIs, entrypoint errors |
| Quilt | ✅ | ✅ mod table | unknown files in mods folder |
| Forge | ✅ | ✅ crash report table, scanned jars | missing dependencies, mods that failed to load, non-Forge jars |
| NeoForge | ✅ | ✅ mod list, crash report table | missing dependencies, Fabric mods, mods that failed to load |
| Paper / Spigot / Bukkit / Folia / Velocity / BungeeCord | ✅ | ✅ plugins | missing plugins, plugin errors, version compatibility |

Every log also gets: Java version mismatch, mixin failures, missing classes/methods, duplicate mods,
server watchdog, crash report reminder, player IPs warning, piracy and PolyMC/TLauncher checks.
