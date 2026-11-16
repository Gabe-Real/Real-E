const { ContainerBuilder, TextDisplayBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { Colors, LOADER_NAMES } = require('./constants');

// Components V2 lets a whole message hold 4000 characters of text.
const TEXT_BUDGET = 3800;

const code = (value) => `\`${String(value).replace(/`/g, 'ˋ')}\``;

/** The "Environment" block: same info and order as Cozy's embed. */
function environmentText(log) {
    const env = log.environment;
    const groups = [
        [`**Minecraft Version:** ${code(log.minecraftVersion ?? 'Unknown')}`,
            env.javaVersion && `**Java Version:** ${code(env.javaVersion)}`,
            env.jvmVersion && `**JVM Version:** ${code(env.jvmVersion)}`],
        [env.jvmArgs && `**Java Args:** ${code(env.jvmArgs.length > 300 ? env.jvmArgs.slice(0, 297) + '...' : env.jvmArgs)}`],
        [env.os && `**OS:** ${env.os}`,
            env.cpu && `**CPU:** ${code(env.cpu)}`,
            env.gpu && `**GPU:** ${code(env.gpu)}`,
            env.systemMemory && `**System Memory:** ${code(env.systemMemory)}`],
        [env.gameMemory && `**Game Memory:** ${code(env.gameMemory)}`,
            env.shaderpack && `**Shaderpack:** ${code(env.shaderpack)}`],
        [log.launcher && `**Launcher:** ${log.launcher.name}${log.launcher.version ? ` (${code(log.launcher.version)})` : ''}`],
    ];

    const loaderLines = [...log.loaders].map(([id, version]) => log.isPluginPlatform
        ? `**Platform:** ${LOADER_NAMES[id] ?? id}\n**Version:** ${code(version)}`
        : `**Loader:** ${LOADER_NAMES[id] ?? id} (${code(version)})`);
    const count = log.userMods.length;
    groups.push([...loaderLines, `**${log.isPluginPlatform ? 'Plugins' : 'Mods'}:** ${count || 'None'}`]);

    return groups.map(g => g.filter(Boolean).join('\n')).filter(Boolean).join('\n\n');
}

function trim(text, max) {
    return text.length > max ? text.slice(0, max - 6) + '\n[...]' : text;
}

/** One coloured box per log, laid out like Cozy's embeds: green = fine, yellow = problems found, red = aborted. */
function logContainer(log, budget) {
    const color = log.aborted ? Colors.Red : log.hasProblems ? Colors.Yellow : Colors.Green;
    const kind = log.content.startsWith('---- Crashed! ----') ? 'Crash Log' : 'Log File';
    const status = log.aborted ? ': Aborted' : log.hasProblems ? ': Problems Found' : '';

    const header = `### ${kind}${status}`;
    let remaining = budget - header.length;

    const blocks = [];
    if (log.aborted) {
        blocks.push(`__**Messages**__\n\n__**Log parsing aborted**__\n${log.abortReason}`);
    } else {
        const env = trim(`__**Environment Info**__\n\n${environmentText(log)}`, Math.max(200, Math.floor(remaining / 2)));
        remaining -= env.length;
        blocks.push(env);
        if (log.messages.length) {
            const messages = trim(`__**Messages**__\n\n${log.messages.join('\n\n')}`, Math.max(200, remaining));
            remaining -= messages.length;
            blocks.push(messages);
        }
    }

    for (const section of log.sections) {
        if (remaining < 200) break;
        const text = trim(`__**${section.title}**__\n\n${section.text}`, remaining);
        remaining -= text.length;
        blocks.push(text);
    }

    return new ContainerBuilder()
        .setAccentColor(color)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${header}\n${blocks.join('\n\n')}`));
}

/**
 * Build the reply for one log. `uploadId` adds the "Upload to mclo.gs" button,
 * `mclogsUrl` swaps it for a link once uploaded.
 */
function renderLog(log, { uploadId, mclogsUrl } = {}) {
    const components = [logContainer(log, TEXT_BUDGET)];

    if (mclogsUrl) {
        components.push(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(mclogsUrl).setLabel('View on mclo.gs')
        ));
    } else if (uploadId) {
        components.push(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`logparser:upload:${uploadId}`).setStyle(ButtonStyle.Secondary).setLabel('Upload to mclo.gs')
        ));
    }

    return { components, flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [], repliedUser: false } };
}

module.exports = { renderLog };
