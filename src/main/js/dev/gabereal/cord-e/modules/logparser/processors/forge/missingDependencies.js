const { Order } = require('../../constants');
const { setupText, modrinth } = require('../../help');

/**
 * Forge and NeoForge both list missing dependencies. Formats:
 *   Mod ID: 'architectury', Requested by: 'rei', Expected range: '[9.1.12,)', Actual version: '[MISSING]'
 *   Mod rei requires architectury 9.1.12 or above
 *   Currently, architectury is not installed
 */
const TABLE = /Mod ID: '([^']+)', Requested by: '([^']+)', Expected range: '([^']+)', Actual version: '([^']+)'/gi;
const SCREEN = /Mod (\S+) requires (\S+) ([^\n]+?)\n[^\n]*?Currently, \2 is ([^\n]+)/gi;

module.exports = {
    id: 'forge-missing-dependencies',
    order: Order.Earlier,
    process(log) {
        const deps = new Map(); // missing mod -> { needed, have, by: Set }

        const add = (mod, needed, have, by) => {
            const entry = deps.get(mod) ?? { needed, have, by: new Set() };
            entry.by.add(by);
            deps.set(mod, entry);
        };

        for (const m of log.content.matchAll(TABLE)) add(m[1], m[3], m[4], m[2]);
        for (const m of log.content.matchAll(SCREEN)) add(m[2], m[3], m[4].replace(/\.$/, ''), m[1]);
        if (!deps.size) return;

        const lines = [...deps].slice(0, 10).map(([mod, d]) => {
            const have = /missing|not installed/i.test(d.have) ? '**not installed**' : `you have \`${d.have}\``;
            return `- [\`${mod}\`](${modrinth(mod)}) (needs \`${d.needed}\`, ${have}) for ${[...d.by].map(b => `\`${b}\``).join(', ')}`;
        });
        const setup = setupText(log);
        log.addProblem(
            '**Some mods are missing dependencies or have the wrong version:**\n' + lines.join('\n') + '\n' +
            `**How to fix it:** download the mods listed above${setup ? ` ${setup}` : ''}, in the version shown after "needs", ` +
            'and put them in your mods folder. Click a name to search for it on Modrinth.'
        );
    },
};
