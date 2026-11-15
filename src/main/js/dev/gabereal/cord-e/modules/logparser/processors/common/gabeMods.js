const { Order } = require('../../constants');

// A little thank-you when someone uses one of Gabe_Real's mods. Add more: mod id -> display name.
const GABE_MODS = {
    content: 'Plushie Pals',
};

module.exports = {
    id: 'gabe-mods',
    order: Order.Early,
    process(log) {
        const found = [...new Set(Object.keys(GABE_MODS).filter(id => log.getMod(id)).map(id => GABE_MODS[id]))];
        if (!found.length) return;
        log.addMessage(
            `Yey, you are using one of Gabe_Real's mods: ${found.sort().map(n => `**${n}**`).join(', ')}\n` +
            'Thank you for supporting me even more than just using this bot, it really does mean a lot 💖'
        );
    },
};
