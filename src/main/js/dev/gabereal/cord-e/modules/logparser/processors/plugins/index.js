const { Order, PLUGIN_PLATFORMS } = require('../../constants');

// Plugin server problems (Paper, Spigot, Bukkit, Velocity, BungeeCord), ported from Cozy-crashes.
const onPluginServer = (log) => PLUGIN_PLATFORMS.some(p => log.getLoader(p) !== null);
const unique = (matches, group = 1) => [...new Set(matches.map(m => m[group].trim().replace(/\.jar$/i, '')))];

const missingPlugins = {
    id: 'missing-plugins',
    order: Order.Earlier,
    process(log) {
        const patterns = [
            /Missing plugin: ([\w\-.]+)/gi,
            /Plugin ([\w\-.]+) is (?:required|missing)/gi,
            /Could not load plugin ([\w\-.]+): (?:not found|missing dependency)/gi,
            /Required plugin ([\w\-.]+) was not found/gi,
            /Unknown\/missing dependency plugins: \[([^\]]+)\]/gi,
        ];
        const found = unique(patterns.flatMap(re => [...log.content.matchAll(re)]));
        if (found.length) log.addProblem(`**Missing required plugins:** ${found.map(p => `\`${p}\``).join(', ')}`);
    },
};

const pluginErrors = {
    id: 'plugin-errors',
    order: Order.Default,
    predicate: onPluginServer,
    process(log) {
        const patterns = [
            /Plugin ([^\s]+) has failed to load/gi,
            /Error (?:occurred while enabling|loading plugin) ([^\s]+)/gi,
            /Plugin ([^\s]+) threw an exception/gi,
            /Could not load '(?:plugins[\\/])?([^\s']+)' (?:plugin|in folder)/gi,
            /Plugin ([^\s]+) is not compatible/gi,
            /Plugin ([^\s]+) requires a newer version/gi,
            /Outdated plugin: ([^\s]+)/gi,
        ];
        const found = unique(patterns.flatMap(re => [...log.content.matchAll(re)]));
        if (!found.length) return;
        log.addProblem(
            `**These plugins had errors while loading:** ${found.slice(0, 10).map(p => `\`${p}\``).join(', ')}\n` +
            'Common causes: outdated plugins for your server version, missing dependencies, corrupted jars, or two plugins conflicting.'
        );
    },
};

const versionCompatibility = {
    id: 'server-version-compatibility',
    order: Order.Default,
    predicate: onPluginServer,
    process(log) {
        const patterns = [
            /This plugin was compiled for .+ but you're running .+/gi,
            /Plugin .+ requires Minecraft .+ but server is running .+/gi,
            /Unsupported server version: .+/gi,
            /Server version .+ is not supported/gi,
            /Plugin .+ is not compatible with this server version/gi,
        ];
        const issues = [...new Set(patterns.flatMap(re => [...log.content.matchAll(re)].map(m => m[0].trim())))];
        if (!issues.length) return;
        log.addProblem(
            '**Server version compatibility issues:**\n' + issues.slice(0, 6).map(i => `- ${i}`).join('\n') +
            '\nUpdate the plugins (or your server) so their versions match.'
        );
    },
};

const notMarkedSupported = {
    id: 'unsupported-loader-plugins',
    order: Order.Earlier,
    process(log) {
        for (const m of log.content.matchAll(/Could not load plugin '(.+?)' as it is not marked as supporting (\w+)!/gi)) {
            log.addProblem(`**Plugin \`${m[1]}\` isn't marked as supporting \`${m[2]}\`.** It needs an update that declares support for it.`);
        }
    },
};

module.exports = [missingPlugins, pluginErrors, versionCompatibility, notMarkedSupported];
