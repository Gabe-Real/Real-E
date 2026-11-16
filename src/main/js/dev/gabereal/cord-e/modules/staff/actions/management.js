// /reale management: running Real-E: server bans, allowing servers, staff, logs.
const roles = require('../roles');
const banned = require('../banned');
const { StaffLog } = require('../schemas');
const { card, oops, ts } = require('../ui');
const access = require('../../access');

const ID = /^\d{17,20}$/;
const need = (ctx, name) => {
    const value = ctx.options.getString(name);
    return value?.trim() || null;
};

const actions = {
    async logs() {
        const logs = await StaffLog.find().sort({ createdAt: -1 }).limit(15).lean();
        return card('📜 Recent staff actions', `Last ${logs.length}`,
            logs.map(l => `${ts(l.createdAt)} · <@${l.userId}> · **${l.action}**${l.details ? `\n-# ${l.details}` : ''}`).join('\n') || '-# nothing yet');
    },

    async ban_guild(ctx) {
        const guildId = need(ctx, 'guild_id');
        if (!guildId || !ID.test(guildId)) return oops('🆔 Needs a server ID', 'Fill in `guild_id`, and the reason in `text`');
        const guild = ctx.client.guilds.cache.get(guildId);
        await banned.ban(guildId, guild?.name ?? null, need(ctx, 'text') ?? 'No reason', ctx.user.id);
        await access.disallow(guildId);
        if (guild) await guild.leave().catch(() => {});
        return card('🚫 Server banned', `${guild ? `Left **${guild.name}**. ` : ''}\`${guildId}\` can't request or add Real-E any more`);
    },

    async unban_guild(ctx) {
        const guildId = need(ctx, 'guild_id');
        if (!guildId) return oops('🆔 Needs a server ID', 'Fill in `guild_id`');
        const was = await banned.unban(guildId);
        return card(was ? '🔓 Server unbanned' : '🤷 Wasn\'t banned', was ? `\`${guildId}\` can request Real-E again` : `\`${guildId}\``);
    },

    async allow_guild(ctx) {
        const guildId = need(ctx, 'guild_id');
        if (!guildId || !ID.test(guildId)) return oops('🆔 Needs a server ID', 'Fill in `guild_id`');
        if (await banned.isBanned(guildId)) return oops('🚫 That server is banned', 'Unban it first');
        await access.allow(guildId, ctx.client.guilds.cache.get(guildId)?.name ?? null, ctx.user.id, 'manual');
        return card('✅ Server allowed', `\`${guildId}\` can now add Real-E`);
    },

    async toggle_staff(ctx) {
        const userId = need(ctx, 'user_id');
        const on = ctx.options.getBoolean('toggle');
        if (!userId || on === null) return oops('✏️ Missing details', 'Needs `user_id` and `toggle`');
        const current = await roles.levelOf(userId);
        if (current === 'dev' || current === 'management') {
            return oops('🔒 Can\'t change that', `<@${userId}> is ${roles.LABEL[current]}. Only a developer can change management`);
        }
        await roles.setLevel(userId, on ? 'staff' : 'none', ctx.user.id);
        return card(on ? '🔑 Staff access given' : '🔑 Staff access removed', `<@${userId}> \`${userId}\``);
    },
};

const choices = [
    ['📜 View recent staff command logs', 'logs'],
    ['🚫 Ban a server from using Real-E (guild_id, text)', 'ban_guild'],
    ['🔓 Unban a server (guild_id)', 'unban_guild'],
    ['✅ Allow a server without a request (guild_id)', 'allow_guild'],
    ['🔑 Toggle staff access for a user (user_id, toggle)', 'toggle_staff'],
];

module.exports = { actions, choices };
