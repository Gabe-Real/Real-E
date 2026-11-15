// Shared constants for the log parser module.

/** When a handler runs relative to others. Lower runs first (same idea as Cozy's Order). */
const Order = {
    Earlier: -200,
    Early: -100,
    Default: 0,
    Late: 100,
    Later: 200,
};

/** Loader / platform IDs, and how they're shown. */
const Loader = {
    Fabric: 'fabric',
    Quilt: 'quilt',
    Forge: 'forge',
    NeoForge: 'neoforge',
    Paper: 'paper',
    Spigot: 'spigot',
    Bukkit: 'bukkit',
    Folia: 'folia',
    Velocity: 'velocity',
    BungeeCord: 'bungeecord',
    Waterfall: 'waterfall',
};

const LOADER_NAMES = {
    fabric: 'Fabric', quilt: 'Quilt', forge: 'Forge', neoforge: 'NeoForge',
    paper: 'Paper', spigot: 'Spigot', bukkit: 'Bukkit', folia: 'Folia',
    velocity: 'Velocity', bungeecord: 'BungeeCord', waterfall: 'Waterfall',
};

/** Server software that runs plugins instead of mods. */
const PLUGIN_PLATFORMS = ['paper', 'spigot', 'bukkit', 'folia', 'velocity', 'bungeecord', 'waterfall'];

/** Entries in mod lists that aren't really "mods" the user installed. Not counted. */
const BUILTIN_MODS = new Set(['minecraft', 'java', 'fabricloader', 'quilt_loader', 'forge', 'neoforge', 'mixinextras']);

const Launcher = {
    ATLauncher: 'ATLauncher',
    MultiMC: 'MultiMC',
    Prism: 'Prism Launcher',
    PolyMC: 'PolyMC',
    Technic: 'Technic',
    TLauncher: 'TLauncher',
    CurseForge: 'CurseForge',
    Modrinth: 'Modrinth App',
};

const Colors = {
    Green: 0x57F287,
    Yellow: 0xFEE75C,
    Red: 0xED4245,
};

module.exports = { Order, Loader, LOADER_NAMES, PLUGIN_PLATFORMS, BUILTIN_MODS, Launcher, Colors };
