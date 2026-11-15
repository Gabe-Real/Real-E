const { Order } = require('../../constants');

// Mixin failures name the mod (Fabric/Quilt) or the mixin config (Forge/NeoForge) that broke.
const PATTERNS = [
    /MixinApplyError: Mixin \[\S+ from mod ([^\]]+)\] from phase \[\w+\] in config \[[^\]]+\] FAILED during APPLY/gi,
    /mod (\S+) failed injection check, \(\d+\/\d+\) succeeded/gi,
    /Mixin apply for mod (\S+) failed/gi,
    /Mixin \[([\w\-.]+?)\.mixins?\.json:[^\]]+\] from phase \[\w+\] in config \[[^\]]+\] FAILED during \w+/gi,
];

module.exports = {
    id: 'mixin-error',
    order: Order.Earlier,
    process(log) {
        const matches = PATTERNS.flatMap(re => [...log.content.matchAll(re)]);
        if (!matches.length) return;

        const mods = [...new Set(matches.map(m => m[1]))].map(m => `\`${m}\``).join(', ');
        log.addProblem(
            `**Found ${matches.length} mixin failure${matches.length === 1 ? '' : 's'} in the following mods:** ${mods}\n` +
            '**What this means:** mods use *mixins* to change how Minecraft works. These mods couldn\'t make their changes, ' +
            'which usually means they\'re out of date, made for a different Minecraft version, or clashing with another mod.\n' +
            '**How to fix it:** update these mods first. If that doesn\'t help, remove them one at a time to find the clash.'
        );
    },
};
