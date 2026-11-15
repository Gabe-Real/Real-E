const { Order } = require('../../constants');

module.exports = {
    id: 'server-watchdog',
    order: Order.Earlier,
    process(log) {
        if (/Description:\s+Watching Server/i.test(log.content) || /java\.lang\.Error:\s+Watchdog/i.test(log.content)) {
            log.addProblem(
                '**This is a server crash caused by the Watchdog**, meaning one server tick took far too long.\n' +
                'It\'s usually a mod or plugin stuck in a loop, a huge farm, or lots of chunks generating at once. ' +
                'The thread dump in the crash report shows what the server was busy doing.'
            );
        }
    },
};
