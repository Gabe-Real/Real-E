const { EmbedBuilder } = require('discord.js');
const ModLog = require('../schemas/logging/modlogs');

/**
 * Sends an embed to the guild's configured modlog channel. Best-effort: never throws,
 * so a logging failure can't break the moderation action that triggered it.
 * @param {import('discord.js').Guild} guild
 * @param {import('discord.js').EmbedBuilder} embed
 */
async function sendModLog(guild, embed) {
    try {
        const config = await ModLog.findOne({ guildId: guild.id });
        if (!config?.modlogChannelId) return;

        const channel = await guild.channels.fetch(config.modlogChannelId).catch(() => null);
        if (channel?.isTextBased()) await channel.send({ embeds: [embed] });
    } catch (err) {
        console.warn(`[ModLog] Failed to send modlog in ${guild.id}:`, err.message);
    }
}

/**
 * Logs a moderation action to the configured modlog channel.
 * @param {Object} options
 * @param {import('discord.js').Guild} options.guild - The guild object.
 * @param {import('discord.js').ColorResolvable} options.colour - The colour of the embed
 * @param {import('discord.js').User} options.targetUser - The user affected.
 * @param {import('discord.js').User} options.moderator - The moderator who took the action.
 * @param {string} options.emoji - The emoji to put on the title
 * @param {string} options.action - The action name (e.g., 'Ban', 'Warn', 'Mute').
 * @param {string} [options.reason] - The reason for the action.
 * @param {Array<{ name: string, value: string, inline?: boolean }>} [options.extraFields] - Additional fields.
 */
async function logModAction({ guild, colour, targetUser, moderator, emoji, action, reason = 'No reason provided', extraFields = [] }) {
    const embed = new EmbedBuilder()
        .setTitle(`${emoji} ${action}`)
        .setColor(colour)
        .addFields(
            { name: 'User', value: `${targetUser.tag} (${targetUser.id})`, inline: false },
            { name: 'Reason', value: reason.slice(0, 1024), inline: false },
            { name: 'Moderator', value: `<@${moderator.id}>`, inline: true },
            ...extraFields
        )
        .setTimestamp();

    await sendModLog(guild, embed);
}

module.exports = { sendModLog, logModAction };
