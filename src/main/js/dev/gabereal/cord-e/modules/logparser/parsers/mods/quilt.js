const { Order, Loader } = require('../../constants');

/**
 * Quilt prints a table of mods. Columns can contain "|" so, like Cozy, we split each row using the
 * column widths from the "|----|----|" separator line instead of splitting on "|".
 */
const OPENING_LINES = [/Loading \d+ mods:\n/i, /-- Mods --\n/i, /-- Mod Table --\n/i, /\tQuilt Mods: ?\n/i];

module.exports = {
    id: 'mods-quilt',
    order: Order.Default,
    predicate: (log) => log.getLoader(Loader.Quilt) !== null,

    process(log) {
        const opening = OPENING_LINES.map(re => log.content.match(re)).find(Boolean);
        if (!opening) return;

        const lines = log.content.slice(opening.index + opening[0].length).split('\n');
        const table = [];
        for (const line of lines) {
            const trimmed = line.replace(/^.*?(?=\|)/, '');   // drop any "[time] [thread/INFO]:" prefix
            if (!trimmed.startsWith('|')) break;
            table.push(trimmed.trim());
        }
        if (table.length < 3) return;

        const strip = (row) => row.replace(/^\|/, '').replace(/\|$/, '');
        const headers = strip(table[0]).split('|').map(h => h.trim().toLowerCase());
        const widths = strip(table[1]).split('|').map(w => w.length);

        for (const row of table.slice(2)) {
            if (/^\|[-:|]+\|$/.test(row)) continue;            // separator lines
            const cells = {};
            let cursor = 0;
            const body = strip(row);
            headers.forEach((header, i) => {
                cells[header] = body.slice(cursor, cursor + widths[i]).trim();
                cursor += widths[i] + 1;                       // +1 skips the "|" between columns
            });
            if (cells.id) log.addMod({ id: cells.id, name: cells.mod, version: cells.version, file: cells['file(s)'] });
        }

        const java = log.getMod('java');
        if (java) log.environment.javaVersion ??= java.version;
    },
};
