const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, InteractionContextType } = require('discord.js');
const StarboardConfig = require('../../schemas/cordboard/cordboardConfig');
const StarboardPost = require('../../schemas/cordboard/cordboardPost');

const DUPLICATE_KEY = 11000;

/** Strip the emoji variation selector so "☕" and "☕️" compare equal. */
const normalize = (s) => s.replace(/️/g, '').trim();

/**
 * Whether a reaction's emoji matches the configured one. Custom emojis are stored as `<:name:id>`,
 * which never equals `reaction.emoji.name`, so they need matching by ID.
 */
function emojiMatches(reactionEmoji, configured) {
    const custom = configured.match(/^<a?:\w+:(\d+)>$/);
    if (custom) return reactionEmoji.id === custom[1];
    return !reactionEmoji.id && normalize(reactionEmoji.name ?? '') === normalize(configured);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pinboard')
        .setDescription('Configure the pinboard system')
        .setContexts(InteractionContextType.Guild)
        .addSubcommand(sub =>
            sub.setName('config')
                .setDescription('Configure pinboard settings')
                .addIntegerOption(opt =>
                    opt.setName('threshold')
                        .setDescription('Number of emojis needed before posting')
                        .setMinValue(1)
                        .setRequired(true))
                .addStringOption(opt =>
                    opt.setName('emoji')
                        .setDescription('Emoji to track (e.g. ☕)')
                        .setRequired(true))
                .addChannelOption(opt =>
                    opt.setName('channel')
                        .setDescription('Channel to send the messages')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true)))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;

        if (sub === 'config') {
            const threshold = interaction.options.getInteger('threshold');
            const emoji = interaction.options.getString('emoji').trim();
            const channel = interaction.options.getChannel('channel');

            await StarboardConfig.findOneAndUpdate(
                { guildId },
                { threshold, emoji, channelId: channel.id },
                { upsert: true }
            );

            await interaction.reply({ content: '📝 Pinboard configuration saved!', flags: MessageFlags.Ephemeral });
        }
    },

    async onReaction(reaction, user, client) {
        if (user.bot) return;

        if (reaction.partial) await reaction.fetch();
        if (reaction.message.partial) await reaction.message.fetch();

        const message = reaction.message;
        const guildId = message.guildId;
        if (!guildId) return; // DM reaction

        const conf = await StarboardConfig.findOne({ guildId });
        if (!conf?.emoji || !emojiMatches(reaction.emoji, conf.emoji)) return;

        // Don't re-pin the pinboard's own posts.
        if (message.channelId === conf.channelId) return;

        const count = reaction.count;
        if (count < conf.threshold) return;

        const starboardChannel = message.guild.channels.cache.get(conf.channelId);
        if (!starboardChannel) return;

        const attachment = message.attachments.find(att => att.contentType?.startsWith('image/'));
        const replied = message.reference ? await message.channel.messages.fetch(message.reference.messageId).catch(() => null) : null;

        const embed = new EmbedBuilder()
            .setColor('White')
            .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
            .setDescription(
                (replied ? `**Replying to ${replied.author.tag}:** ${replied.content}\n\n` : '') +
                (message.content || (attachment ? '*Attachment*' : '*No content*'))
            )
            .addFields({ name: 'Information', value: `${conf.emoji} ${count} in https://discord.com/channels/${message.guild.id}/${message.channel.id}`, inline: true })
            .setImage(attachment?.url ?? null)
            .setTimestamp()
            .setFooter({ text: `Message ID: ${message.id}` });

        const jumpButton = new ButtonBuilder()
            .setLabel('Jump to Message')
            .setEmoji('⭐')
            .setStyle(ButtonStyle.Link)
            .setURL(message.url);

        const row = new ActionRowBuilder().addComponents(jumpButton);

        const existing = await StarboardPost.findOne({ messageId: message.id });
        if (existing) {
            if (!existing.starboardMsgId) return; // another reaction is creating the post right now
            try {
                const msg = await starboardChannel.messages.fetch(existing.starboardMsgId);
                await msg.edit({ embeds: [embed], components: [row] });
            } catch (err) {
                console.error('Failed to edit Pinboard message:', err.message);
            }
            return;
        }

        // Claim the message first: the unique index on messageId means only one of several near-simultaneous
        // reactions wins, so the post can't be sent twice.
        try {
            await StarboardPost.create({ messageId: message.id, originalChannelId: message.channel.id, guildId });
        } catch (err) {
            if (err.code === DUPLICATE_KEY) return;
            throw err;
        }

        try {
            const sent = await starboardChannel.send({ embeds: [embed], components: [row] });
            await StarboardPost.updateOne({ messageId: message.id }, { starboardMsgId: sent.id });
        } catch (err) {
            await StarboardPost.deleteOne({ messageId: message.id }); // release the claim so a later reaction can retry
            throw err;
        }
    },
};
