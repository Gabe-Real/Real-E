const { Order, Loader } = require('../../constants');

module.exports = {
    id: 'unknown-mods',
    order: Order.Earlier,
    predicate: (log) => log.getLoader(Loader.Quilt) !== null,
    process(log) {
        const mods = [...log.content.matchAll(/Unknown file in mods folder: <mods>[\\/]([^\n]+)\n/gi)].map(m => m[1]);
        if (!mods.length) return;
        log.sections.push({
            title: 'Unknown Mods',
            text: '**These files in your mods folder aren\'t mods Quilt can load.** This usually means mods for another loader ' +
                '(like Forge) got mixed in. Use separate instances for different loaders.\n' + mods.slice(0, 15).map(m => `\`${m}\``).join(', '),
        });
        log.hasProblems = true;
    },
};
