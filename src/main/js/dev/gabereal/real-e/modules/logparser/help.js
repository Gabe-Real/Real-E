// Plain-English helpers so results make sense to people who don't know modding.
const { LOADER_NAMES } = require('./constants');

/** Code packages from popular libraries -> the mod you actually need to download. Longest match wins. */
const KNOWN_PACKAGES = [
    ['net.fabricmc.fabric', 'Fabric API'],
    ['net.fabricmc.loader', 'Fabric Loader (update it in your launcher)'],
    ['net.fabricmc.language.kotlin', 'Fabric Language Kotlin'],
    ['org.quiltmc.qsl', 'Quilted Fabric API (QFAPI / QSL)'],
    ['kotlin', 'Fabric Language Kotlin (Fabric) or Kotlin for Forge (Forge/NeoForge)'],
    ['kotlinx', 'Fabric Language Kotlin (Fabric) or Kotlin for Forge (Forge/NeoForge)'],
    ['me.shedaniel.clothconfig2', 'Cloth Config API'],
    ['me.shedaniel.autoconfig', 'Cloth Config API'],
    ['me.shedaniel.rei', 'Roughly Enough Items (REI)'],
    ['dev.architectury', 'Architectury API'],
    ['software.bernie.geckolib', 'GeckoLib'],
    ['mod.azure.azurelib', 'AzureLib'],
    ['io.wispforest.owo', 'owo-lib'],
    ['dev.isxander.yacl3', 'YetAnotherConfigLib (YACL)'],
    ['dev.isxander.yacl', 'YetAnotherConfigLib (YACL)'],
    ['com.terraformersmc.modmenu', 'Mod Menu'],
    ['fuzs.forgeconfigapiport', 'Forge Config API Port'],
    ['fuzs.puzzleslib', 'Puzzles Lib'],
    ['net.blay09.mods.balm', 'Balm'],
    ['net.darkhax.bookshelf', 'Bookshelf'],
    ['com.natamus.collective', 'Collective'],
    ['com.teamresourceful.resourcefullib', 'Resourceful Lib'],
    ['com.teamresourceful.resourcefulconfig', 'Resourceful Config'],
    ['top.theillusivec4.curios', 'Curios API'],
    ['dev.emi.trinkets', 'Trinkets'],
    ['dev.onyxstudios.cca', 'Cardinal Components API'],
    ['org.ladysnake.cca', 'Cardinal Components API'],
    ['me.jellysquid.mods.sodium', 'Sodium'],
    ['net.caffeinemc.mods.sodium', 'Sodium'],
    ['net.irisshaders.iris', 'Iris Shaders'],
    ['net.coderbot.iris', 'Iris Shaders'],
    ['com.simibubi.create', 'Create'],
    ['mezz.jei', 'Just Enough Items (JEI)'],
    ['vazkii.patchouli', 'Patchouli'],
    ['terrablender', 'TerraBlender'],
    ['com.github.alexthe666.citadel', 'Citadel'],
    ['me.fzzyhmstrs.fzzy_config', 'Fzzy Config'],
    ['eu.midnightdust.lib', 'MidnightLib'],
    ['dev.ftb.mods.ftblibrary', 'FTB Library'],
    ['de.cristelknight.doapi', 'Let\'s Do API'],
    ['com.llamalad7.mixinextras', 'MixinExtras (update your mod loader)'],
];

// Package name parts that don't tell you anything about which mod it is.
const NOISE = new Set(['net', 'com', 'org', 'dev', 'io', 'me', 'de', 'fr', 'eu', 'uk', 'xyz', 'gg', 'top', 'tk', 'github', 'gitlab',
    'mod', 'mods', 'mc', 'minecraft', 'common', 'api', 'impl', 'client', 'server', 'core', 'block', 'blocks', 'item', 'items',
    'entity', 'mixin', 'mixins', 'util', 'utils', 'registry', 'init', 'fabric', 'forge', 'neoforge', 'quilt']);

const modrinth = (query) => `https://modrinth.com/mods?q=${encodeURIComponent(query)}`;

/** "for Minecraft `1.21.1` on Fabric" (whatever we know). */
function setupText(log) {
    const loader = [...log.loaders.keys()].map(l => LOADER_NAMES[l] ?? l)[0];
    return [log.minecraftVersion && `for Minecraft \`${log.minecraftVersion}\``, loader && `on ${loader}`].filter(Boolean).join(' ');
}

/** Explain one missing package: which mod it belongs to, with a link to find it. */
function describePackage(pkg) {
    const name = pkg.replace(/\.$/, '');

    if (name === 'net.minecraft' || name.startsWith('net.minecraft.') || name.startsWith('com.mojang.')) {
        return `\`${name}\` → part of **Minecraft itself**, so a mod was made for a **different Minecraft version**`;
    }
    if (/^net\.(minecraftforge|neoforged)\b/.test(name)) {
        return `\`${name}\` → part of **${name.includes('neoforged') ? 'NeoForge' : 'Forge'}**, so a mod was made for a different loader or loader version`;
    }

    const known = KNOWN_PACKAGES
        .filter(([prefix]) => name === prefix || name.startsWith(prefix + '.'))
        .sort((a, b) => b[0].length - a[0].length)[0];
    if (known) return `\`${name}\` → **${known[1]}** · [find it on Modrinth](${modrinth(known[1].replace(/\s*\(.*\)$/, ''))})`;

    // Unknown: guess from the package name, e.g. net.satisfy.foundation.block -> "foundation" by "satisfy".
    const parts = name.split('.').filter(p => !NOISE.has(p.toLowerCase()));
    if (!parts.length) return `\`${name}\``;
    const [author, project] = parts;
    const guess = project ?? author;
    return `\`${name}\` → probably a mod or library called **${guess}**${project ? ` (by *${author}*)` : ''} · [search Modrinth](${modrinth(project ? `${author} ${project}` : guess)})`;
}

module.exports = { setupText, describePackage, modrinth };
