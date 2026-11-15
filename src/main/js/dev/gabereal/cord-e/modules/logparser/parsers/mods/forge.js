const { Order, Loader } = require('../../constants');

/**
 * Forge and NeoForge mod lists. Formats:
 *  crash report:   "\tMod List: " then rows like "\t\tjei-15.2.jar  |Just Enough Items |jei |15.2.0.27 |DONE |Manifest: ..."
 *  NeoForge log:   "Mod List:" / "Name Version (Mod Id)" then "\t\tJust Enough Items 19.5.0 (jei)"
 *  Forge log:      "Found mod file jei-1.20.1-forge-15.2.0.27.jar of type MOD" (file names only)
 */
module.exports = {
    id: 'mods-forge',
    order: Order.Default,
    predicate: (log) => log.getLoader(Loader.Forge) !== null || log.getLoader(Loader.NeoForge) !== null,

    process(log) {
        // Crash report table
        for (const row of log.content.matchAll(/^\t\t(\S+\.jar)\s*\|([^|\n]*)\|([^|\n]*)\|([^|\n]*)\|/gm)) {
            log.addMod({ file: row[1], name: row[2].trim(), id: row[3].trim(), version: row[4].trim() });
        }
        if (log.mods.size) return;

        // NeoForge-style "Name Version (Mod Id)" list
        const neoList = log.content.match(/Name Version \(Mod Id\)\s*\n/i);
        if (neoList) {
            for (const line of log.content.slice(neoList.index + neoList[0].length).split('\n')) {
                if (!line.trim()) continue;
                const mod = line.match(/^\s+(.+) (\S+) \(([\w\-.]+)\)\s*$/);
                if (!mod) break;
                log.addMod({ name: mod[1], version: mod[2], id: mod[3] });
            }
            if (log.mods.size) return;
        }

        // Fallback: just the jar names from the mod scan
        for (const found of log.content.matchAll(/Found mod file "?([^"\s]+\.jar)"? of type MOD/gi)) {
            const id = found[1].replace(/\.jar$/i, '');
            log.addMod({ id, file: found[1], version: 'unknown' });
        }
    },
};
