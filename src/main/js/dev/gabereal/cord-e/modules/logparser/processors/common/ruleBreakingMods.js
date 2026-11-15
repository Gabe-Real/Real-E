const { Order } = require('../../constants');

// Mods we won't support. Add to this list as needed: mod id -> display name.
const BAD_MODS = {
    fabric_hider: 'Fabric Hider',
};

module.exports = {
    id: 'rule-breaking-mods',
    order: Order.Early,
    process(log) {
        const found = [...new Set(Object.keys(BAD_MODS).filter(id => log.getMod(id)).map(id => BAD_MODS[id]))];
        if (!found.length) return;
        log.abort(
            `You appear to have the following rule-breaking mods installed: ${found.sort().map(n => `**${n}**`).join(', ')}\n\n` +
            'We can\'t provide support while you\'re using mods that break our rules.'
        );
    },
};
