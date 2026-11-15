const { Order, Launcher } = require('../../constants');

module.exports = {
    id: 'problematic-launcher',
    order: Order.Earlier,
    process(log) {
        if (log.launcher?.name !== Launcher.PolyMC) return;
        log.abort(
            '**You seem to be using PolyMC.**\n\n' +
            'In October 2022 PolyMC was taken over by its owner, who removed the existing team and replaced them with known bigots. ' +
            'It\'s barely maintained, and since it downloads and runs software from servers the owner controls, **it shouldn\'t be considered safe.**\n\n' +
            'Please switch to [Prism Launcher](https://prismlauncher.org), the continuation of PolyMC by the developers who actually built it.\n\n' +
            '- [GamingOnLinux article](https://www.gamingonlinux.com/2022/10/if-you-use-polymc-for-minecraft-you-should-switch-away-now/)'
        );
    },
};
