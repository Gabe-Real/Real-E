const { Order, Loader } = require('../constants');

// Which mod loader or server software the log is from. First match wins, so the order matters:
// Quilt before Fabric (Quilt logs mention Fabric), NeoForge before Forge (NeoForge logs mention Forge).
const PATTERNS = [
    [Loader.Quilt, /\| Quilt Loader\s+\| quilt_loader\s+\| (\S+)/i],
    [Loader.Quilt, /Loading .+ with Quilt Loader (\S+)/i],
    [Loader.Fabric, /Loading .+ with Fabric Loader (\S+)/i],
    [Loader.Fabric, /^\t\tfabricloader: Fabric Loader (\S+)/im],                 // crash report "Fabric Mods" list

    [Loader.NeoForge, /--fml\.neoForgeVersion,? ([^\s,]+)/i],
    [Loader.NeoForge, /NeoForge: net\.neoforged:(\S+)/i],                         // crash report system details
    [Loader.NeoForge, /\|\s*NeoForge\s*\|\s*neoforge\s*\|\s*([^\s|]+)/i],         // crash report mod list
    [Loader.NeoForge, /^\s*at\s+net\.neoforged\./im],                             // stack trace (version unknown)

    [Loader.Forge, /--fml\.forgeVersion,? ([^\s,]+)/i],
    [Loader.Forge, /Forge: net\.minecraftforge:(\S+)/i],
    [Loader.Forge, /\|\s*Forge\s*\|\s*forge\s*\|\s*([^\s|]+)/i],
    [Loader.Forge, /MinecraftForge v([^\s,]+) Initialized/i],
    [Loader.Forge, /^\s*at\s+net\.minecraftforge\./im],

    // Plugin servers. More specific patterns first.
    [Loader.Spigot, /This server is running CraftBukkit version ([^\s(]+).*Spigot/i],
    [Loader.Paper, /This server is running Paper version ([^\s(]+)/i],
    [Loader.Spigot, /This server is running Spigot version ([^\s(]+)/i],
    [Loader.Bukkit, /This server is running (?:Craft)?Bukkit version ([^\s(]+)/i],
    [Loader.Paper, /You are running paper version ([^\s(]+)/i],
    [Loader.Folia, /Loading Folia ([^\s(]+) ?(?:\([^)]*\))? for Minecraft/i],
    [Loader.Velocity, /(?:Starting Velocity |Velocity )([\w.\-]+)(?: is starting up)?/i],
    [Loader.BungeeCord, /(?:Starting BungeeCord version |BungeeCord version )(\S+)/i],
    [Loader.Waterfall, /(?:Starting Waterfall version |Waterfall version )(\S+)/i],
    [Loader.Waterfall, /Waterfall has reached end of life/i],
    [Loader.Bukkit, /Starting minecraft server version ([\d.]+)/i],
];

module.exports = {
    id: 'loader',
    order: Order.Earlier,

    process(log) {
        for (const [loader, pattern] of PATTERNS) {
            const match = log.content.match(pattern);
            if (!match) continue;

            log.setLoader(loader, match[1] ?? 'Unknown');

            if (loader === Loader.Waterfall) {
                log.abort(
                    '**It looks like you\'re using Waterfall.**\n\n' +
                    'Waterfall reached **end of life in March 2024** and is no longer updated, so we can\'t help with it. ' +
                    'We recommend switching to [Velocity](https://papermc.io/software/velocity) instead.\n\n' +
                    '- [Announcement by PaperMC](https://forums.papermc.io/threads/announcing-the-end-of-life-of-waterfall.1088/)'
                );
            }
            return;
        }
    },
};
