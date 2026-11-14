const { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType } = require('discord.js');
const ModCase = require('../../schemas/moderation/case');
const Warn = require('../../schemas/moderation/warn');
const ModNote = require('../../schemas/moderation/notes');
const { ACTIONS, formatCaseLine } = require('../../utils/cases');
const { text, divider, section, buttons, v2, notice } = require('../../utils/ui');

const PER_PAGE = 6;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('history')
        .setDescription('See every moderation case for a user')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .setContexts(InteractionContextType.Guild)
        .addUserOption(o => o.setName('user').setDescription('Who to look up').setRequired(true))
        .addBooleanOption(o => o.setName('public').setDescription('Show this to everyone in the channel? (default: only you)')),

    async execute(interaction) {
        const user = interaction.options.getUser('user');
        const isPublic = interaction.options.getBoolean('public') ?? false;
        return interaction.reply(await buildHistory(interaction.guild, user, 1, { ephemeral: !isPublic }));
    },

    /**
     * Buttons look like `history:<userId>:<page>:<mode>`.
     * mode "page" = flip the page on this message, "new" = open history as a fresh reply (from /case).
     */
    async handleButton(interaction) {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers)) {
            return interaction.reply(notice('🔒 Not allowed', 'You need **Timeout Members** to view history', { ephemeral: true }));
        }

        const [, userId, pageStr, mode] = interaction.customId.split(':');
        const user = await interaction.client.users.fetch(userId).catch(() => null);
        if (!user) return interaction.reply(notice('🔍 User not found', 'They may have deleted their account', { ephemeral: true }));

        if (mode === 'new') {
            return interaction.reply(await buildHistory(interaction.guild, user, 1, { ephemeral: true }));
        }
        return interaction.update(await buildHistory(interaction.guild, user, Number(pageStr)));
    },
};

async function buildHistory(guild, user, page, options = {}) {
    const guildId = guild.id;
    const [total, warnDoc, noteDoc, counts] = await Promise.all([
        ModCase.countDocuments({ guildId, userId: user.id }),
        Warn.findOne({ guildId, userId: user.id }),
        ModNote.findOne({ guildId, userId: user.id }),
        ModCase.aggregate([{ $match: { guildId, userId: user.id } }, { $group: { _id: '$action', n: { $sum: 1 } } }]),
    ]);

    const pages = Math.max(1, Math.ceil(total / PER_PAGE));
    page = Math.min(Math.max(1, page), pages);
    const cases = await ModCase.find({ guildId, userId: user.id })
        .sort({ createdAt: -1 })
        .skip((page - 1) * PER_PAGE)
        .limit(PER_PAGE);

    const avatar = user.displayAvatarURL({ size: 256 });
    const activeWarns = warnDoc?.warnings.length ?? 0;
    const notes = noteDoc?.notes.length ?? 0;
    const extras = `-# ${activeWarns} active warning${activeWarns === 1 ? '' : 's'} · ${notes} mod note${notes === 1 ? '' : 's'}${notes ? ' (`/notes view`)' : ''}`;

    if (total === 0) {
        return v2([section(`## 😇 ${user.username} has a clean record\n${extras}`, avatar)], options);
    }

    // "3 warns · 1 mute · 1 ban"
    const summary = counts
        .sort((a, b) => b.n - a.n)
        .map(c => `${c.n} ${c.n === 1 ? (ACTIONS[c._id]?.one ?? c._id) : (ACTIONS[c._id]?.many ?? c._id)}`)
        .join(' · ');

    const components = [
        section(`## 📂 ${user.username}'s history\n-# ${total} case${total === 1 ? '' : 's'}: ${summary}\n${extras}`, avatar),
        divider(),
        text(cases.map(formatCaseLine).join('\n\n').slice(0, 3500)),
    ];

    if (pages > 1) {
        components.push(divider(), buttons(
            { id: `history:${user.id}:${page - 1}:page`, label: 'Newer', emoji: '◀️', disabled: page <= 1 },
            { id: `history:${user.id}:${page}:noop`, label: `Page ${page}/${pages}`, disabled: true },
            { id: `history:${user.id}:${page + 1}:page`, label: 'Older', emoji: '▶️', disabled: page >= pages },
        ));
    }

    return v2(components, options);
}
