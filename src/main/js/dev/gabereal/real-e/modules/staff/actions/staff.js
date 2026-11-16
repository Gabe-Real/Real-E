// /reale staff: read-only tools for looking after the servers Real-E is in.
const { PermissionFlagsBits } = require('discord.js');
const roles = require('../roles');
const banned = require('../banned');
const { text, divider, reply, card, oops, pager, ts } = require('../ui');
const access = require('../../access');

const PER_PAGE = 10;

// Permissions Real-E's features rely on, and what each is for.
const IMPORTANT = [
    ['ViewChannel', 'see channels'], ['SendMessages', 'reply at all'], ['EmbedLinks', 'link previews'], ['AttachFiles', 'send files'],
    ['ReadMessageHistory', 'reply to messages'], ['AddReactions', 'reactions & cordboard'], ['UseExternalEmojis', 'custom emojis'],
    ['ManageMessages', 'pins & cleanup'], ['ModerateMembers', '/mute'], ['KickMembers', '/kick'], ['BanMembers', '/ban'],
    ['ManageRoles', 'reaction roles'], ['ManageChannels', '/slowmode, tickets'], ['ManageNicknames', '/botprofile nickname'],
    ['ChangeNickname', 'own nickname'], ['CreateInstantInvite', 'staff invite links'],
];

function getGuild(ctx) {
    const id = ctx.options.getString('guild_id');
    if (!id) return { error: oops('🆔 Needs a server', 'Fill in `guild_id` (start typing a server name)') };
    const guild = ctx.client.guilds.cache.get(id);
    if (!guild) return { error: oops('🔍 Not in that server', `Real-E isn't in \`${id}\``) };
    return { guild };
}

const actions = {
    async check_staff(ctx) {
        const { dev, management, staff } = await roles.listAll();
        const list = (ids) => ids.length ? ids.map(id => `- <@${id}> \`${id}\``).join('\n') : '-# nobody';
        return card('📖 Real-E staff', `${dev.length + management.length + staff.length} people with access`,
            `### Developers\n${list(dev)}\n### Management\n${list(management)}\n### Staff\n${list(staff)}`);
    },

    async guild_info(ctx) {
        const { guild, error } = getGuild(ctx);
        if (error) return error;
        const owner = await guild.fetchOwner().catch(() => null);
        const me = guild.members.me;
        return reply([
            text(`## 🔍 ${guild.name}\n-# \`${guild.id}\``),
            divider(),
            text([
                `**Owner:** ${owner ? `<@${owner.id}> (${owner.user.tag})` : 'unknown'}`,
                `**Members:** ${guild.memberCount.toLocaleString('en-GB')}`,
                `**Channels:** ${guild.channels.cache.size} · **Roles:** ${guild.roles.cache.size}`,
                `**Boosts:** ${guild.premiumSubscriptionCount ?? 0} (tier ${guild.premiumTier})`,
                `**Created:** ${ts(guild.createdAt)}`,
                `**Real-E joined:** ${me?.joinedAt ? ts(me.joinedAt) : 'unknown'}`,
                `**Access:** ${access.isAllowed(guild.id) ? '🟩 allowed' : '🟥 not on the allowlist'}`,
            ].join('\n')),
        ]);
    },

    async guild_bots(ctx) {
        const { guild, error } = getGuild(ctx);
        if (error) return error;
        const members = await guild.members.fetch().catch(() => guild.members.cache);
        const bots = [...members.filter(m => m.user.bot).values()];
        return card(`🤖 Bots in ${guild.name}`, `${bots.length} bot${bots.length === 1 ? '' : 's'}`,
            bots.slice(0, 40).map(b => `- **${b.user.username}** \`${b.id}\`${b.id === ctx.client.user.id ? ' (that\'s me)' : ''}`).join('\n') || '-# none');
    },

    async guild_perms(ctx) {
        const { guild, error } = getGuild(ctx);
        if (error) return error;
        const me = guild.members.me;
        const perms = me.permissions;
        const admin = perms.has(PermissionFlagsBits.Administrator);
        const lines = IMPORTANT.map(([flag, why]) => `${admin || perms.has(PermissionFlagsBits[flag]) ? '✅' : '❌'} **${flag}** · ${why}`);
        const missing = admin ? 0 : IMPORTANT.filter(([flag]) => !perms.has(PermissionFlagsBits[flag])).length;
        return card(`🚧 Real-E's permissions in ${guild.name}`,
            admin ? 'Has Administrator, so everything works' : `${missing} missing · highest role: ${me.roles.highest.name} (position ${me.roles.highest.position}/${guild.roles.cache.size - 1})`,
            lines.join('\n'));
    },

    // A one-use invite so the staff member can join the server (e.g. to help out or check on it).
    async invite(ctx) {
        const { guild, error } = getGuild(ctx);
        if (error) return error;
        const me = guild.members.me;
        const channel = [guild.rulesChannel, guild.systemChannel, ...guild.channels.cache.values()]
            .find(c => c?.isTextBased?.() && !c.isThread?.() && c.permissionsFor(me)?.has(PermissionFlagsBits.CreateInstantInvite));
        if (!channel) return oops('🔗 Can\'t make an invite', `Real-E doesn't have **Create Invite** in any channel of ${guild.name}`);
        const invite = await channel.createInvite({ maxAge: 3600, maxUses: 1, unique: true, reason: `Requested by Real-E staff member ${ctx.user.username}` })
            .catch(() => null);
        if (!invite) return oops('🔗 Couldn\'t make an invite', 'Discord refused. Try again in a minute');
        return card(`🔗 Invite to ${guild.name}`, 'One use, expires in 1 hour', invite.url);
    },

    async servers(ctx, page = 1) {
        const guilds = [...ctx.client.guilds.cache.values()].sort((a, b) => a.name.localeCompare(b.name));
        const pages = Math.max(1, Math.ceil(guilds.length / PER_PAGE));
        page = Math.min(Math.max(1, page), pages);
        const lines = guilds.slice((page - 1) * PER_PAGE, page * PER_PAGE)
            .map(g => `${access.isAllowed(g.id) ? '🟩' : '🟥'} **${g.name}** · ${g.memberCount.toLocaleString('en-GB')} members\n-# \`${g.id}\``);
        const components = [text(`## 📁 Servers Real-E is in\n-# ${guilds.length} total · 🟩 allowed · 🟥 not on the allowlist`), divider(), text(lines.join('\n') || '-# none')];
        if (pages > 1) components.push(pager('reale:servers', page, pages));
        return reply(components);
    },

    async banned(ctx) {
        const list = await banned.list();
        return card('🚫 Banned servers', `${list.length} server${list.length === 1 ? '' : 's'} can't use Real-E`,
            list.map(b => `- **${b.guildName ?? 'Unknown'}** \`${b.guildId}\`\n-# ${b.reason ?? 'No reason'} · by <@${b.bannedBy}> ${ts(b.createdAt)}`).join('\n') || '-# none');
    },
};

const choices = [
    ['📖 Check staff', 'check_staff'],
    ['🔍 View information about a server Real-E is in (guild_id)', 'guild_info'],
    ['🤖 View bots in a server Real-E is in (guild_id)', 'guild_bots'],
    ['🚧 Debug Real-E\'s permissions in a server (guild_id)', 'guild_perms'],
    ['🔗 Get an invite to join a server Real-E is in (guild_id)', 'invite'],
    ['📁 List all servers Real-E is in (paginated)', 'servers'],
    ['🚫 List of banned servers', 'banned'],
];

module.exports = { actions, choices };
