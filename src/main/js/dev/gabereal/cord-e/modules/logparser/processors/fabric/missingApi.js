const { Order } = require('../../constants');

/**
 * Older Fabric/Quilt format, listing the affected jars underneath:
 *   3 mods requires version [>=0.5.0] of fabric, which is missing!
 *    - <mods>/somemod.jar
 */
const PATTERN = /(?:\d+ mods|[\w\s']+) requires (?:version \[[^\]]+\]|any version) of (\S+), which is missing!\s*((?:\n?\s*- <mods>\/.*(?:\n|$))+)/gi;

module.exports = {
    id: 'missing-api',
    order: Order.Earlier,
    process(log) {
        const matches = [...log.content.matchAll(PATTERN)];
        if (!matches.length) return;

        const problems = matches.map(m => {
            const mods = m[2].split('\n')
                .map(l => l.trim().match(/^- <mods>\/(.+)$/)?.[1])
                .filter(Boolean)
                .map(f => `- \`${f}\``)
                .join('\n');
            return `**» Missing:** \`${m[1]}\`\nNeeded by:\n${mods}`;
        });
        log.addProblem(
            '**Some mods are missing required APIs or mods:**\n' + problems.join('\n\n') + '\n' +
            '**How to fix it:** download the missing mod for your Minecraft version and put it in your mods folder.'
        );
    },
};
