const { Order } = require('../../constants');
const { setupText } = require('../../help');

/**
 * Crash reports have a "-- MOD modid --" section for every mod that failed to load, with the cause.
 * Older Forge also logs "Failed to create mod instance. ModID: modid".
 */
const SECTION = /-- MOD ([\w\-.]+) --\nDetails:\n(?:\t[^\n]*\n)*?\tCaused by \d+: ([^\n]+)/gi;
const SECTION_SIMPLE = /-- MOD ([\w\-.]+) --/gi;
const INSTANCE = /Failed to create mod instance\. ModID: ([\w\-.]+)/gi;

module.exports = {
    id: 'forge-mod-loading-failed',
    order: Order.Default,
    process(log) {
        const failed = new Map();
        for (const m of log.content.matchAll(SECTION)) failed.set(m[1], m[2].trim());
        for (const m of log.content.matchAll(SECTION_SIMPLE)) if (!failed.has(m[1])) failed.set(m[1], null);
        for (const m of log.content.matchAll(INSTANCE)) if (!failed.has(m[1])) failed.set(m[1], null);

        // Forge's own entries aren't the culprit.
        for (const id of ['minecraft', 'forge', 'neoforge']) failed.delete(id);
        if (!failed.size) return;

        const lines = [...failed].slice(0, 8).map(([id, cause]) => {
            const short = cause && cause.length > 150 ? cause.slice(0, 147) + '...' : cause;
            return `- \`${id}\`${short ? `: \`${short}\`` : ''}`;
        });
        const setup = setupText(log);
        log.addProblem(
            '**These mods failed to load:**\n' + lines.join('\n') + '\n' +
            `**How to fix it:** update these mods and make sure they\'re made${setup ? ` ${setup}` : ' for your Minecraft version and loader'}. ` +
            'If one keeps failing, remove it to check it\'s the cause, then report it to the mod\'s author.'
        );
    },
};
