const { Order } = require('../../constants');
const { modrinth } = require('../../help');

/**
 * Fabric Loader 0.14+ explains dependency problems itself:
 *
 *   Some of your mods are incompatible with the game or each other!
 *   A potential solution has been determined, this may resolve your problem:
 *        - Install fabric-api, any version.
 *        - Replace mod 'Sodium' (sodium) 0.4.10 with version 0.5.3 or later.
 *   More details:
 *        - Mod 'Iris' (iris) 1.6.4 requires any version of fabric-api, which is missing!
 *
 * We show the suggested fix first, then the details.
 */
const HEADER = /(?:Some of your mods are incompatible with the game or each other!|Incompatible mods? (?:set|found)!?)/i;

function bulletsAfter(text, heading) {
    const start = text.search(heading);
    if (start === -1) return [];
    const bullets = [];
    for (const line of text.slice(start).split('\n').slice(1)) {
        const bullet = line.match(/^\s*-\s+(.+)$/);
        if (bullet) bullets.push(bullet[1].trim());
        else if (bullets.length) break;          // stop at the end of the list
        else if (line.trim()) break;
    }
    return bullets;
}

module.exports = {
    id: 'fabric-incompatible-mods',
    order: Order.Earlier,
    process(log) {
        if (!HEADER.test(log.content)) return;

        const fixes = bulletsAfter(log.content, /A potential solution has been determined[^\n]*/i);
        const details = bulletsAfter(log.content, /More details:/i)
            .concat(bulletsAfter(log.content, HEADER).filter(b => /^Mod '/.test(b)));
        const uniqueDetails = [...new Set(details)];

        const parts = ['**Some of your mods are incompatible with the game or each other.**'];
        // Link "Install fabric-api, any version." straight to a search for that mod.
        const linked = fixes.map(f => f.replace(/^Install ([\w\-.]+)/i, (_, id) => `Install [${id}](${modrinth(id)})`));
        if (fixes.length) parts.push('**Suggested fix** (Fabric worked this out for you, so start here):\n' + linked.slice(0, 8).map(f => `- ${f}`).join('\n'));
        if (uniqueDetails.length) {
            parts.push('**Details:**\n' + uniqueDetails.slice(0, 8).map(d => `- ${d}`).join('\n') +
                (uniqueDetails.length > 8 ? `\n-# ...and ${uniqueDetails.length - 8} more` : ''));
        }
        log.addProblem(parts.join('\n'));
    },
};
