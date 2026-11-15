const { Order, PLUGIN_PLATFORMS } = require('../constants');

// Plugins loaded by Paper / Spigot / Bukkit / Velocity / BungeeCord servers (merged from Cozy's plugin parsers).
const PATTERNS = [
    /Loading ([^\s]+) v([\w.\-]+)/gi,
    /Enabling ([^\s]+) v([\w.\-]+)/gi,
    /Plugin ([^\s]+) version ([\w.\-]+) is enabled/gi,
    /Loaded plugin ([^\s]+) ([\w.\-]+)/gi,
    /Enabling plugin ([^\s]+) ([\w.\-]+)/gi,
    /Enabled plugin ([^\s]+) version ([\w.\-]+)/gi,
    /Successfully loaded plugin ([^\s]+) ([\w.\-]+)/gi,
    /Discovered plugin ([^\s]+) version ([\w.\-]+)/gi,
];

module.exports = {
    id: 'plugins',
    order: Order.Default,
    predicate: (log) => PLUGIN_PLATFORMS.some(p => log.getLoader(p) !== null),

    process(log) {
        for (const pattern of PATTERNS) {
            for (const match of log.content.matchAll(pattern)) {
                const name = match[1].replace(/[[\]:]/g, '');
                const id = name.toLowerCase().replace(/\s+/g, '_');
                if (!log.getMod(id)) log.addMod({ id, name, version: match[2] });
            }
        }

        // "Plugins (3): A, B v1.0, C" from /plugins output
        const list = log.content.match(/Plugins \(\d+\): ([^\n]+)/i);
        if (list) {
            for (const entry of list[1].split(',').map(s => s.trim()).filter(Boolean)) {
                const m = entry.match(/^(.+?)\s+v([\w.\-]+)$/);
                const name = m ? m[1] : entry;
                const id = name.toLowerCase().replace(/\s+/g, '_');
                if (!log.getMod(id)) log.addMod({ id, name, version: m ? m[2] : 'unknown' });
            }
        }
    },
};
