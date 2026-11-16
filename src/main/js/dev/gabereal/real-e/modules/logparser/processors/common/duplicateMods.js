const { Order } = require('../../constants');

// The same mod installed twice (usually two versions of one jar).
const PATTERNS = [
    /Duplicate mandatory mod ids \[([^\]]+)\]/gi,       // Quilt
    /Mod ID:? '([^']+)' from mod files:/gi,             // Forge / NeoForge "Found duplicate mods"
    /Found duplicate mods?[^\n]*\n\s*-?\s*Mod ID:? '?([\w\-.]+)/gi,
    /duplicate mods? found:? ([\w\-.]+)/gi,             // Fabric
];

module.exports = {
    id: 'duplicate-mods',
    order: Order.Earlier,
    process(log) {
        const ids = [...new Set(PATTERNS.flatMap(re => [...log.content.matchAll(re)].map(m => m[1])))];
        if (!ids.length) return;
        log.addProblem(`**You have the same mod installed more than once:** ${ids.map(id => `\`${id}\``).join(', ')}\nDelete the older copy from your mods folder.`);
    },
};
