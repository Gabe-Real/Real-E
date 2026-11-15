/**
 * Minecraft log parser module, a JavaScript port of Cozy-crashes' module-log-parser
 * (https://github.com/Gabe-Real/Cozy-crashes), with added Forge/NeoForge support.
 *
 * Post a log (file or paste link) in a watched channel and the bot replies with what it found.
 * Set channels with /logparser channel add. Right-click any message → Apps → "Parse Minecraft Log" works anywhere.
 */
const { Events, MessageFlags } = require('discord.js');
const { parseMessage } = require('./pipeline');
const { renderLog } = require('./render');
const { uploadToMclogs } = require('./mclogs');
const { isWatched } = require('./settings');

const MAX_LOGS_PER_MESSAGE = 5;

// Parsed logs kept briefly so the "Upload to mclo.gs" button can find them. Oldest dropped first.
const uploads = new Map(); // id -> log
const MAX_STORED = 200;

function remember(log) {
    const id = Math.random().toString(36).slice(2, 12);
    uploads.set(id, log);
    if (uploads.size > MAX_STORED) uploads.delete(uploads.keys().next().value);
    return id;
}

/** Reply to a message with a result for each log in it. Returns how many logs were found. */
async function replyWithResults(message, send) {
    const logs = await parseMessage(message, { fromCommand: send !== undefined });
    if (!logs.length) return 0;

    const reply = send ?? ((payload) => message.reply(payload));
    for (const log of logs.slice(0, MAX_LOGS_PER_MESSAGE)) {
        await reply(renderLog(log, { uploadId: remember(log) }));
    }
    if (logs.length > MAX_LOGS_PER_MESSAGE) {
        await reply({ content: `-# Found ${logs.length} logs, but I only show the first ${MAX_LOGS_PER_MESSAGE}. Please post fewer at once.`, allowedMentions: { parse: [] } });
    }
    return logs.length;
}

/** "Upload to mclo.gs" button: upload, then swap the button for a link on the same message. */
async function handleUploadButton(interaction) {
    const id = interaction.customId.split(':')[2];
    const log = uploads.get(id);
    if (!log) {
        return interaction.reply({ content: '## ⌛ That log has expired\n-# Post it again to get a fresh upload button', flags: MessageFlags.Ephemeral });
    }

    await interaction.deferUpdate();
    const url = await uploadToMclogs(log.content);
    if (!url) {
        return interaction.followUp({ content: '## 📌 Couldn\'t upload to mclo.gs\n-# Please try again in a bit', flags: MessageFlags.Ephemeral });
    }
    uploads.delete(id);
    return interaction.editReply(renderLog(log, { mclogsUrl: url }));
}

/** Start watching configured channels. Call once when the bot starts. */
function setupLogParser(client) {
    client.on(Events.MessageCreate, async (message) => {
        if (message.author.bot || (!message.attachments.size && !message.content.includes('http'))) return;
        try {
            if (!(await isWatched(message))) return;
            await message.channel.sendTyping().catch(() => {});
            await replyWithResults(message);
        } catch (err) {
            console.error('[logparser] Failed to handle message:', err);
        }
    });
    console.log('[logparser] Log parser ready.');
}

module.exports = { setupLogParser, replyWithResults, handleUploadButton };
