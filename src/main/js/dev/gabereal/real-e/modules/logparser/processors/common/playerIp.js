const { Order } = require('../../constants');

// Server logs show "[/1.2.3.4:5678] logged in with entity id". Warn so people can delete and re-post.
const IPV4 = /\[\/((?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}):\d+\] logged in with entity id/g;
const IPV6 = /\[\/\[?((?:[0-9a-f]{1,4}:){7}[0-9a-f]{1,4})\]?:\d+\] logged in with entity id/gi;

module.exports = {
    id: 'player-ip',
    order: Order.Early,
    predicate: (log) => !log.fromCommand,
    process(log) {
        const ips = [...log.content.matchAll(IPV4), ...log.content.matchAll(IPV6)]
            .map(m => m[1])
            .filter(ip => !ip.startsWith('127.') && ip !== '0:0:0:0:0:0:0:1');
        if (ips.length) {
            log.addMessage('**This log appears to contain players\' IP addresses.** Please consider deleting it and posting it again with the IP addresses removed.');
        }
    },
};
