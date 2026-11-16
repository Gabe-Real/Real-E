const { Order, Launcher } = require('../constants');

// Which launcher made the log. First match wins.
const PATTERNS = [
    [Launcher.ATLauncher, /minecraft\.launcher\.brand=ATLauncher/i],
    [Launcher.MultiMC, /MultiMC version: (\S+)/i],
    [Launcher.Prism, /Prism Launcher version: (\S+)/i],
    [Launcher.PolyMC, /PolyMC version: (\S+)/i],
    [Launcher.Technic, /api\.technicpack\.net resolves to/i],
    [Launcher.TLauncher, /Starting TLauncher ([^\n]+)/i],
    [Launcher.TLauncher, /tlauncher\.org/i],
    [Launcher.CurseForge, /minecraft\.launcher\.brand=curseforge/i],
    [Launcher.Modrinth, /minecraft\.launcher\.brand=modrinth/i],
];

/** Compare dotted versions like "6.3" vs "7.0". */
function olderThan(version, target) {
    const a = version.split(/[.\-+]/).map(Number);
    const b = target.split('.').map(Number);
    for (let i = 0; i < b.length; i++) {
        if ((a[i] || 0) !== b[i]) return (a[i] || 0) < b[i];
    }
    return false;
}

module.exports = {
    id: 'launcher',
    order: Order.Earlier,

    process(log) {
        for (const [name, pattern] of PATTERNS) {
            const match = log.content.match(pattern);
            if (!match) continue;

            log.launcher = { name, version: match[1] ?? null };

            if (name === Launcher.Prism && match[1] && olderThan(match[1], '7.0')) {
                log.addMessage(
                    '**It looks like you\'re using an outdated version of Prism.** Older versions ' +
                    '[broke uploaded logs](https://github.com/PrismLauncher/PrismLauncher/issues/930), so the info here ' +
                    'may be incomplete. Please update Prism to 7.0+ or upload your `latest.log` file instead.'
                );
            }
            return;
        }
    },
};
