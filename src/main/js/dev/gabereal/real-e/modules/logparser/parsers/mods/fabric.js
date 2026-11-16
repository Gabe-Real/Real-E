const { Order, Loader } = require('../../constants');

/**
 * Fabric mod lists. Two formats:
 *  latest.log:    "Loading 42 mods:" then "\t- modid 1.2.3" lines (nested "|--" lines are bundled sub-mods, skipped)
 *  crash report:  "\tFabric Mods: " then "\t\tmodid: Mod Name 1.2.3" lines
 */
module.exports = {
    id: 'mods-fabric',
    order: Order.Default,
    predicate: (log) => log.getLoader(Loader.Fabric) !== null,

    process(log) {
        const listStart = log.content.match(/Loading \d+ mods:\n/i);
        if (listStart) {
            const after = log.content.slice(listStart.index + listStart[0].length);
            for (const line of after.split('\n')) {
                if (!/^\s/.test(line)) break;                       // list ends at the first un-indented line
                const mod = line.match(/^\s*- ([\w\-.]+) (\S+)/);   // top-level entries only
                if (mod) log.addMod({ id: mod[1], version: mod[2] });
            }
        }

        const crashList = log.content.match(/\tFabric Mods: ?\n/i);
        if (crashList) {
            const after = log.content.slice(crashList.index + crashList[0].length);
            for (const line of after.split('\n')) {
                const mod = line.match(/^\t\t([\w\-.]+): (.+) (\S+)$/);
                if (!mod) break;
                log.addMod({ id: mod[1], name: mod[2], version: mod[3] });
            }
        }

        const java = log.getMod('java');
        if (java) log.environment.javaVersion ??= java.version;
    },
};
