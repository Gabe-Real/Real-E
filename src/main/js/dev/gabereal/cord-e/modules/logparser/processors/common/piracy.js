const { Order, Launcher } = require('../../constants');

// Cracked launchers / accounts. Discord's rules mean we can't help with these.
const DEV_ENVIRONMENT = ['Loaded Quilt development mappings for mixin remapper!', 'at net.fabricmc.devlaunchinjector.Main.main(Main.java'];
const ALT_AUTH = [/\[authlib-injector\]/i, /authlib-injector\.(log|jar)/i, /Yggdrasil Public Key Transformer/i, /Authentication server: https?:\/\/\S/i];
const OFFLINE = /Failed to verify authentication\n.+?401\n/;

const FOOTER = '\n\nPlease bear in mind that neither this server\'s staff, nor the developers of this bot, can do anything about the Discord Terms of Service.';

module.exports = {
    id: 'piracy',
    order: Order.Earlier,
    predicate: (log) => !DEV_ENVIRONMENT.some(text => log.content.includes(text)),
    process(log) {
        if (log.launcher?.name === Launcher.TLauncher) {
            return log.abort(
                '**You seem to be using TLauncher.**\n\nTLauncher is widely known as a piracy tool. As all communities on ' +
                'Discord must follow its Terms of Service, we can\'t provide support while you use this launcher.' + FOOTER
            );
        }
        if (ALT_AUTH.some(re => re.test(log.content))) {
            return log.abort(
                '**You seem to be using an alternative Minecraft authentication provider.**\n\nThe only legal way to play is ' +
                'with a paid account from Mojang. As all communities on Discord must follow its Terms of Service, we can\'t help with this.' + FOOTER
            );
        }
        if (OFFLINE.test(log.content)) {
            log.abort(
                '**You seem to be running Minecraft in offline mode, or with invalid credentials.**\n\nWe can\'t provide support ' +
                'until you switch to a legitimate Minecraft account.' + FOOTER
            );
        }
    },
};
