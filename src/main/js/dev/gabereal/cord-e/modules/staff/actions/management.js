// /reale management: running Real-E: messages, servers, bans, staff.
const {
    ModalBuilder, LabelBuilder, MessageFlags, TextInputBuilder, TextInputStyle, ChannelSelectMenuBuilder, RoleSelectMenuBuilder, ChannelType,
} = require('discord.js');
const roles = require('../roles');
const banned = require('../banned');
const { setLogChannel } = require('../logs');
const { StaffLog } = require('../schemas');
const { text, divider, reply, card, ts } = require('../ui');
const access = require('../../access');

const ID = /^\d{17,20}$/;
const need = (ctx, name) => {
    const value = ctx.options.getString(name);
    return value?.trim() || null;
};

const actions = {
    async send_message(ctx) {
        const channelId = need(ctx, 'channel_id');
        const content = need(ctx, 'text');
        if (!channelId || !content) return card('✏️ Missing details', 'Needs `channel_id` and `text`');
        const channel = await ctx.client.channels.fetch(channelId).catch(() => null);
        if (!channel?.isSendable?.()) return card('🚫 Can\'t post there', `Real-E can't send messages in \`${channelId}\``);
        await channel.send({ content: content.replace(/\\n/g, '\n'), allowedMentions: { parse: [] } });
        return card('📢 Sent', `Posted in <#${channel.id}>${channel.guild ? ` (${channel.guild.name})` : ''}`);
    },

    // Opens a pop-up; handlers/modals/staffAnnounce.js posts it.
    async announce(ctx) {
        if (!ctx.inGuild()) return card('🏠 Use this in a server', 'The channel picker shows the channels of the server you run it in');
        return {
            modal: new ModalBuilder()
                .setCustomId('staff:announce')
                .setTitle('Send an announcement')
                .addLabelComponents(
                    new LabelBuilder().setLabel('Channel').setChannelSelectMenuComponent(
                        new ChannelSelectMenuBuilder().setCustomId('channel').setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)),
                    new LabelBuilder().setLabel('Title').setTextInputComponent(
                        new TextInputBuilder().setCustomId('title').setStyle(TextInputStyle.Short).setMaxLength(100).setPlaceholder('Real-E update')),
                    new LabelBuilder().setLabel('Message').setDescription('Markdown, emojis and new lines all work').setTextInputComponent(
                        new TextInputBuilder().setCustomId('body').setStyle(TextInputStyle.Paragraph).setMaxLength(3500)),
                    new LabelBuilder().setLabel('Ping a role (optional)').setRoleSelectMenuComponent(
                        new RoleSelectMenuBuilder().setCustomId('ping').setRequired(false)),
                ),
        };
    },

    async dm(ctx) {
        const userId = need(ctx, 'user_id');
        const content = need(ctx, 'text');
        if (!userId || !content) return card('✏️ Missing details', 'Needs `user_id` and `text`');
        try {
            const user = await ctx.client.users.fetch(userId);
            await user.send({
                components: [text(`## 📩 Message from the Real-E team\n${content.replace(/\\n/g, '\n')}\n-# Sent by ${ctx.user.username}`)],
                flags: MessageFlags.IsComponentsV2,
                allowedMentions: { parse: [] },
            });
            return card('📩 DM sent', `To ${user.tag}`);
        } catch {
            return card('📪 Couldn\'t DM them', 'Their DMs are probably closed');
        }
    },

    async log_channel(ctx) {
        const channelId = need(ctx, 'channel_id');
        if (!channelId) return card('✏️ Missing details', 'Needs `channel_id` (or `none` to turn logging off)');
        if (channelId.toLowerCase() === 'none') {
            await setLogChannel(null);
            return card('📜 Staff log channel off', 'Actions are still saved, see the staff command logs');
        }
        const channel = await ctx.client.channels.fetch(channelId).catch(() => null);
        if (!channel?.isSendable?.()) return card('🚫 Can\'t post there', `Real-E can't send messages in \`${channelId}\``);
        await setLogChannel(channel.id);
        return card('📜 Staff log channel set', `Every /reale action will be posted in <#${channel.id}>`);
    },

    async logs() {
        const logs = await StaffLog.find().sort({ createdAt: -1 }).limit(15).lean();
        return card('📜 Recent staff actions', `Last ${logs.length}`,
            logs.map(l => `${ts(l.createdAt)} · <@${l.userId}> · **${l.action}**${l.details ? `\n-# ${l.details}` : ''}`).join('\n') || '-# nothing yet');
    },

    async leave(ctx) {
        const guildId = need(ctx, 'guild_id');
        const guild = guildId && ctx.client.guilds.cache.get(guildId);
        if (!guild) return card('🔍 Not in that server', guildId ? `\`${guildId}\`` : 'Fill in `guild_id`');
        await access.disallow(guild.id);
        await guild.leave();
        return card('🚪 Left server', `**${guild.name}** · removed from the allowlist too`);
    },

    async ban_guild(ctx) {
        const guildId = need(ctx, 'guild_id');
        if (!guildId || !ID.test(guildId)) return card('🆔 Needs a server ID', 'Fill in `guild_id`, and the reason in `text`');
        const guild = ctx.client.guilds.cache.get(guildId);
        await banned.ban(guildId, guild?.name ?? null, need(ctx, 'text') ?? 'No reason', ctx.user.id);
        await access.disallow(guildId);
        if (guild) await guild.leave().catch(() => {});
        return card('🚫 Server banned', `${guild ? `Left **${guild.name}**. ` : ''}\`${guildId}\` can't request or add Real-E any more`);
    },

    async unban_guild(ctx) {
        const guildId = need(ctx, 'guild_id');
        if (!guildId) return card('🆔 Needs a server ID', 'Fill in `guild_id`');
        const was = await banned.unban(guildId);
        return card(was ? '🔓 Server unbanned' : '🤷 Wasn\'t banned', was ? `\`${guildId}\` can request Real-E again` : `\`${guildId}\``);
    },

    async allow_guild(ctx) {
        const guildId = need(ctx, 'guild_id');
        if (!guildId || !ID.test(guildId)) return card('🆔 Needs a server ID', 'Fill in `guild_id`');
        if (await banned.isBanned(guildId)) return card('🚫 That server is banned', 'Unban it first');
        await access.allow(guildId, ctx.client.guilds.cache.get(guildId)?.name ?? null, ctx.user.id, 'manual');
        return card('✅ Server allowed', `\`${guildId}\` can now add Real-E`);
    },

    async toggle_staff(ctx) {
        const userId = need(ctx, 'user_id');
        const on = ctx.options.getBoolean('toggle');
        if (!userId || on === null) return card('✏️ Missing details', 'Needs `user_id` and `toggle`');
        const current = await roles.levelOf(userId);
        if (current === 'dev' || current === 'management') {
            return card('🔒 Can\'t change that', `<@${userId}> is ${roles.LABEL[current]}. Only a developer can change management`);
        }
        await roles.setLevel(userId, on ? 'staff' : 'none', ctx.user.id);
        return card(on ? '🔑 Staff access given' : '🔑 Staff access removed', `<@${userId}> \`${userId}\``);
    },

    async requests() {
        return reply(await access.views.board('pending', 1));
    },
};

const choices = [
    ['📢 Send a message to a channel (channel_id, text)', 'send_message'],
    ['📝 Send a formatted announcement to a channel (dropdown, popup)', 'announce'],
    ['📩 Directly message a user (user_id, text)', 'dm'],
    ['💖 Set staff log channel (channel_id)', 'log_channel'],
    ['📜 View recent staff command logs', 'logs'],
    ['🚪 Leave a specific server (guild_id)', 'leave'],
    ['🚫 Ban a server from using Real-E (guild_id, text)', 'ban_guild'],
    ['🔓 Unban a server (guild_id)', 'unban_guild'],
    ['✅ Allow a server without a request (guild_id)', 'allow_guild'],
    ['🔑 Toggle staff access for a user (user_id, toggle)', 'toggle_staff'],
    ['📨 Review access requests', 'requests'],
];

module.exports = { actions, choices };
