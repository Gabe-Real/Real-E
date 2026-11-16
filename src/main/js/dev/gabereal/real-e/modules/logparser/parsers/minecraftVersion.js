const { Order } = require('../constants');

// Where different loaders/launchers write the Minecraft version. First match wins.
const PATTERNS = [
    /\| Minecraft\s+\| minecraft\s+\| (\S+)/i,           // Quilt mod table
    /Loading Minecraft (\S+) with/i,                     // Fabric, Quilt
    /--fml\.mcVersion,? ([^\s,]+)/i,                     // Forge, NeoForge
    /^\tMinecraft Version: (\S+)/im,                     // Any crash report
    /^\t\tminecraft: Minecraft (\S+)/im,                 // Fabric crash report mod list
    /Starting minecraft server version (\S+)/i,          // Vanilla / Bukkit servers
    / for Minecraft (\d\S*)/i,                           // Paper, Folia
    /--version,? ([^\s,]+)/i,                            // ATLauncher, MultiMC, Prism
];

// Ignore launcher instance names like "fabric-loader-0.15.0-1.20.1" unless they end in a version.
const LOOKS_LIKE_VERSION = /^(\d+\.\d+(\.\d+)?([-_ ].*)?|\d{2}w\d{2}[a-z])$/i;

module.exports = {
    id: 'minecraft-version',
    order: Order.Earlier,

    process(log) {
        for (const pattern of PATTERNS) {
            const match = log.content.match(pattern);
            if (match && LOOKS_LIKE_VERSION.test(match[1])) {
                log.minecraftVersion = match[1];
                return;
            }
        }
    },
};
