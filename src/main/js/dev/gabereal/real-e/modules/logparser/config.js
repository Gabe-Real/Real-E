// The log parser pipeline. To add a check, write a file in parsers/ or processors/ and add it here.
//  retrievers  get log text from a message (attachments, paste sites)
//  parsers     read facts out of the log (loader, Minecraft version, mods, environment)
//  processors  look for problems and add messages
// Each runs in `order` (lower first). A handler can have a `predicate(log)` to only run sometimes.

const retrievers = [
    require('./retrievers/attachment'),
    require('./retrievers/pastebin'),
];

const parsers = [
    require('./parsers/launcher'),
    require('./parsers/loader'),
    require('./parsers/minecraftVersion'),
    require('./parsers/environment'),
    ...require('./parsers/launchers'),
    require('./parsers/mods/fabric'),
    require('./parsers/mods/quilt'),
    require('./parsers/mods/forge'),
    require('./parsers/plugins'),
];

const processors = [
    // Every loader
    require('./processors/common/piracy'),
    require('./processors/common/problematicLauncher'),
    require('./processors/common/ruleBreakingMods'),
    require('./processors/common/gabeMods'),
    require('./processors/common/playerIp'),
    require('./processors/common/javaVersion'),
    require('./processors/common/mixinError'),
    require('./processors/common/duplicateMods'),
    require('./processors/common/entrypoint'),
    require('./processors/common/watchdog'),
    require('./processors/common/missingItem'),
    require('./processors/common/crashReport'),
    // Fabric / Quilt
    require('./processors/fabric/incompatibleMods'),
    require('./processors/fabric/missingApi'),
    require('./processors/quilt/unknownMods'),
    // Forge / NeoForge
    require('./processors/forge/missingDependencies'),
    require('./processors/forge/modLoadingFailed'),
    require('./processors/forge/wrongLoaderMods'),
    // Plugin servers
    ...require('./processors/plugins'),
];

const byOrder = (a, b) => a.order - b.order;

module.exports = {
    retrievers: retrievers.sort(byOrder),
    parsers: parsers.sort(byOrder),
    processors: processors.sort(byOrder),
};
