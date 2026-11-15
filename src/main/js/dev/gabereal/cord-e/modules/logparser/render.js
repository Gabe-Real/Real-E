const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
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

/** One coloured box per log: green = fine, yellow = problems found, red = aborted. */
function logContainer(log, budget) {
    const color = log.aborted ? Colors.Red : log.hasProblems ? Colors.Yellow : Colors.Green;
    const kind = log.isCrashReport ? '💥 Crash Report' : '📄 Log File';
    const status = log.aborted ? ': Aborted' : log.hasProblems ? ': Problems Found' : '';
    const source = log.source.startsWith('http') ? `<${log.source}>` : log.source;

    const header = `## ${kind}${status}\n-# ${source}`;
    const env = `### 🖥️ Environment\n${environmentText(log)}`;
    const body = log.aborted
        ? `### ⛔ Log parsing aborted\n${log.abortReason}`
        : log.messages.length ? `### 💬 Messages\n${log.messages.join('\n\n')}` : null;

    const container = new ContainerBuilder().setAccentColor(color);
    let remaining = budget - header.length;
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(header));

    // When aborted, the environment isn't relevant (Cozy shows it, but it's mostly noise).
    if (!log.aborted) {
        const envText = trim(env, Math.max(200, Math.floor(remaining / 2)));
        remaining -= envText.length;
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(envText));
    }

    if (body) {
        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
        const bodyText = trim(body, Math.max(200, remaining));
        remaining -= bodyText.length;
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(bodyText));
    }

    for (const section of log.sections) {
        if (remaining < 200) break;
        const text = trim(`### ${section.title}\n${section.text}`, remaining);
        remaining -= text.length;
        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(text));
    }

    return container;
}

/**
 * Build the reply for one log. `uploadId` adds the "Upload to mclo.gs" button,
 * `mclogsUrl` swaps it for a link once uploaded.
 */
function renderLog(log, { uploadId, mclogsUrl } = {}) {
    const components = [logContainer(log, TEXT_BUDGET)];

    if (mclogsUrl) {
        components.push(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(mclogsUrl).setLabel('View on mclo.gs').setEmoji('🏓')
        ));
    } else if (uploadId) {
        components.push(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`logparser:upload:${uploadId}`).setStyle(ButtonStyle.Secondary).setLabel('Upload to mclo.gs').setEmoji('📤')
        ));
    }

    return { components, flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [], repliedUser: false } };
}

module.exports = { renderLog };
