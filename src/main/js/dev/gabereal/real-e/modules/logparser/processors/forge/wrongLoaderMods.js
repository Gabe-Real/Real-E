const { Order } = require('../../constants');

// Mods made for a different loader sitting in a Forge/NeoForge mods folder.
const FABRIC_IN_NEOFORGE = /Mod file (?:[^\n]*[\\/])?([^\\/\n]+\.jar) is a Fabric mod and cannot be loaded/gi;
const NOT_VALID = /File (?:[^\n]*[\\/])?([^\\/\n]+\.jar) is not a valid mod file/gi;
const MISSING_TOML = /Mod file (?:[^\n]*[\\/])?([^\\/\n]+?\.jar) is missing (?:neoforge\.)?mods\.toml file/gi;

module.exports = {
    id: 'forge-wrong-loader-mods',
    order: Order.Default,
    process(log) {
        const fabric = [...new Set([...log.content.matchAll(FABRIC_IN_NEOFORGE)].map(m => m[1]))];
        const invalid = [...new Set([...log.content.matchAll(NOT_VALID), ...log.content.matchAll(MISSING_TOML)].map(m => m[1]))]
            .filter(f => !fabric.includes(f));

        if (fabric.length) {
            log.addProblem('**These are Fabric mods, which can\'t run on (Neo)Forge:**\n' +
                fabric.slice(0, 10).map(f => `- \`${f}\``).join('\n') +
                '\nRemove them, or find the Forge/NeoForge version on [Modrinth](https://modrinth.com/) or [CurseForge](https://curseforge.com/).');
        }
        if (invalid.length) {
            log.addProblem('**These files aren\'t valid (Neo)Forge mods** (they\'re missing a `mods.toml`):\n' +
                invalid.slice(0, 10).map(f => `- \`${f}\``).join('\n') +
                '\nThey\'re usually made for another loader (like Fabric), the wrong Minecraft version, or downloaded from an untrusted site.');
        }
    },
};
