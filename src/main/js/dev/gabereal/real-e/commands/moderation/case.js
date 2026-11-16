const { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType, EmbedBuilder } = require('discord.js');
const ModCase = require('../../schemas/moderation/case');
const { ACTIONS, formatCaseLine, caseSelectMenu } = require('../../utils/cases');
const { sendModLog } = require('../../utils/modlog');
const { text, divider, section, gallery, buttons, v2, notice } = require('../../utils/ui');

const IMAGE_URL = /^https?:\/\/\S+\.(png|jpe?g|gif|webp)(\?\S*)?$/i;
const PER_PAGE = 6;

// The case number option, with autocomplete so you can search by number, user or reason.
const idOption = (o) => o.setName('id').setDescription('Case number (start typing to search)').setMinValue(1).setRequired(true).setAutocomplete(true);

module.exports = {
    data: new SlashCommandBuilder()
        .setName('case')
        .setDescription('Look up or edit a moderation case')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .setContexts(InteractionContextType.Guild)
        .addSubcommand(sub =>
            sub.setName('view')
                .setDescription('Show a case')
                .addIntegerOption(idOption))
        .addSubcommand(sub =>
            sub.setName('reason')
                .setDescription('Change the reason on a case')
                .addIntegerOption(idOption)
                .addStringOption(o => o.setName('reason').setDescription('New reason').setMaxLength(500).setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('delete')
                .setDescription('Delete a case (Manage Server only)')
                .addIntegerOption(idOption))
        .addSubcommand(sub =>
            sub.setName('list')
                .setDescription('Browse every case in this server')
                .addUserOption(o => o.setName('user').setDescription('Only cases against this user'))
                .addUserOption(o => o.setName('moderator').setDescription('Only cases by this moderator'))
                .addStringOption(o => o.setName('action').setDescription('Only this type of action')
                    .addChoices(...Object.entries(ACTIONS).map(([value, a]) => ({ name: `${a.emoji} ${a.label}`, value }))))
                .addBooleanOption(o => o.setName('public').setDescription('Show this to everyone in the channel? (default: only you)'))),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();

        if (sub === 'list') {
            const filters = {
                userId: interaction.options.getUser('user')?.id,
                moderatorId: interaction.options.getUser('moderator')?.id,
                action: interaction.options.getString('action') ?? undefined,
            };
            const isPublic = interaction.options.getBoolean('public') ?? false;
            return interaction.reply(await buildCaseList(interaction.guild, filters, 1, { ephemeral: !isPublic }));
        }

        const caseId = interaction.options.getInteger('id');
        const modCase = await ModCase.findOne({ guildId: interaction.guildId, caseId });

        if (!modCase) {
            return interaction.reply(notice(`🔍 Case #${caseId} not found`, 'Check the number with `/history`', { ephemeral: true }));
        }

        if (sub === 'view') {
            return interaction.reply(await buildCaseMessage(interaction, modCase));
        }

        if (sub === 'reason') {
            const oldReason = modCase.reason;
            modCase.reason = interaction.options.getString('reason');
            modCase.editedBy = interaction.user.id;
            await modCase.save();

            await interaction.reply(v2([
                text(`## ✏️ Case #${caseId} updated`),
                divider(),
                text(`**Old reason:** ${oldReason}\n**New reason:** ${modCase.reason}`),
            ], { ephemeral: true }));

            await sendModLog(interaction.guild, new EmbedBuilder()
                .setTitle(`✏️ Case #${caseId} Reason Changed`)
                .setColor('Blurple')
                .addFields(
                    { name: 'Old reason', value: oldReason.slice(0, 1024) },
                    { name: 'New reason', value: modCase.reason.slice(0, 1024) },
                    { name: 'Moderator', value: `<@${interaction.user.id}>` }
                )
                .setTimestamp());
            return;
        }

        if (sub === 'delete') {
            // Deleting history is more serious than editing it, so it needs more than the default permission.
            if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
                return interaction.reply(notice('🔒 Not allowed', 'You need **Manage Server** to delete cases', { ephemeral: true }));
            }

            await modCase.deleteOne();
            await interaction.reply(notice(`🗑️ Case #${caseId} deleted`, `Was a ${ACTIONS[modCase.action]?.one ?? modCase.action} on ${modCase.userTag ?? modCase.userId}`, { ephemeral: true }));

            await sendModLog(interaction.guild, new EmbedBuilder()
                .setTitle(`🗑️ Case #${caseId} Deleted`)
                .setColor('Red')
                .addFields(
                    { name: 'Was', value: `${ACTIONS[modCase.action]?.label ?? modCase.action} on ${modCase.userTag ?? modCase.userId} (${modCase.userId})` },
                    { name: 'Reason', value: modCase.reason.slice(0, 1024) },
                    { name: 'Deleted by', value: `<@${interaction.user.id}>` }
                )
                .setTimestamp());
        }
    },

    /** Suggest cases as you type: matches the number, the user's name, or the reason. */
    async autocomplete(interaction) {
        const typed = String(interaction.options.getFocused()).toLowerCase().replace('#', '').trim();
        const recent = await ModCase.find({ guildId: interaction.guildId }).sort({ caseId: -1 }).limit(300);
        const matches = recent.filter(c => !typed
            || String(c.caseId).startsWith(typed)
            || (c.userTag ?? '').toLowerCase().includes(typed)
            || c.reason.toLowerCase().includes(typed));

        await interaction.respond(matches.slice(0, 25).map(c => ({
            name: `#${c.caseId} · ${ACTIONS[c.action]?.label ?? c.action} · ${c.userTag ?? c.userId} · ${c.reason}`.slice(0, 100),
            value: c.caseId,
        })));
    },

    /** Page buttons on /case list: `case:list:<page>:<userId>:<moderatorId>:<action>` ("-" = no filter). */
    async handleButton(interaction) {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers)) {
            return interaction.reply(notice('🔒 Not allowed', 'You need **Timeout Members** to browse cases', { ephemeral: true }));
        }
        const [, kind, page, userId, moderatorId, action] = interaction.customId.split(':');
        if (kind !== 'list') return;
        const unset = (v) => (v === '-' ? undefined : v);
        const filters = { userId: unset(userId), moderatorId: unset(moderatorId), action: unset(action) };
        return interaction.update(await buildCaseList(interaction.guild, filters, Number(page)));
    },

    /** "Open a case..." dropdown on /history and /case list. */
    async handleSelect(interaction) {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers)) {
            return interaction.reply(notice('🔒 Not allowed', 'You need **Timeout Members** to view cases', { ephemeral: true }));
        }
        const caseId = Number(interaction.values[0]);
        const modCase = await ModCase.findOne({ guildId: interaction.guildId, caseId });
        if (!modCase) return interaction.reply(notice(`🔍 Case #${caseId} not found`, 'It may have been deleted', { ephemeral: true }));
        return interaction.reply(await buildCaseMessage(interaction, modCase, { ephemeral: true }));
    },
};

/** A page of cases matching the filters, with arrows and an "open a case" dropdown. */
async function buildCaseList(guild, filters, page, options = {}) {
    const query = { guildId: guild.id };
    if (filters.userId) query.userId = filters.userId;
    if (filters.moderatorId) query.moderatorId = filters.moderatorId;
    if (filters.action) query.action = filters.action;

    const total = await ModCase.countDocuments(query);
    const pages = Math.max(1, Math.ceil(total / PER_PAGE));
    page = Math.min(Math.max(1, page), pages);

    // Describe the filters in the subtext, e.g. "against @user · by @mod · bans only".
    const filterText = [
        filters.userId && `against <@${filters.userId}>`,
        filters.moderatorId && `by <@${filters.moderatorId}>`,
        filters.action && `${ACTIONS[filters.action]?.many ?? filters.action} only`,
    ].filter(Boolean).join(' · ');

    if (total === 0) {
        return v2([text(`## 🗂️ No cases found\n-# ${filterText || 'Nothing has been logged in this server yet'}`)], options);
    }

    const cases = await ModCase.find(query).sort({ caseId: -1 }).skip((page - 1) * PER_PAGE).limit(PER_PAGE);
    const components = [
        text(`## 🗂️ Cases in ${guild.name}\n-# ${total} case${total === 1 ? '' : 's'}${filterText ? ` · ${filterText}` : ''}`),
        divider(),
        text(cases.map(c => formatCaseLine(c, { showUser: !filters.userId })).join('\n\n').slice(0, 3500)),
        caseSelectMenu(cases),
    ];

    if (pages > 1) {
        const f = `${filters.userId ?? '-'}:${filters.moderatorId ?? '-'}:${filters.action ?? '-'}`;
        components.push(buttons(
            { id: `case:list:${page - 1}:${f}`, label: 'Newer', emoji: '◀️', disabled: page <= 1 },
            { id: `case:page:${page}:${f}`, label: `Page ${page}/${pages}`, disabled: true },
            { id: `case:list:${page + 1}:${f}`, label: 'Older', emoji: '▶️', disabled: page >= pages },
        ));
    }

    return v2(components, options);
}

/** The full case card: header with the user's avatar, details, evidence, and a button to their history. */
async function buildCaseMessage(interaction, modCase, options = {}) {
    const { emoji, label } = ACTIONS[modCase.action] ?? { emoji: '•', label: modCase.action };
    const user = await interaction.client.users.fetch(modCase.userId).catch(() => null);
    const avatar = user?.displayAvatarURL({ size: 256 }) ?? 'https://cdn.discordapp.com/embed/avatars/0.png';

    const details = [
        `**User:** <@${modCase.userId}> · ${modCase.userTag ?? 'unknown'} · \`${modCase.userId}\``,
        `**Moderator:** <@${modCase.moderatorId}>`,
        modCase.duration && `**Duration:** ${modCase.duration}`,
        `**Reason:** ${modCase.reason}`,
        modCase.evidence && !IMAGE_URL.test(modCase.evidence) && `**Evidence:** ${modCase.evidence}`,
    ].filter(Boolean).join('\n');

    const components = [
        section(`## ${emoji} Case #${modCase.caseId} · ${label}\n-# <t:${Math.floor(modCase.createdAt.getTime() / 1000)}:F>`, avatar),
        divider(),
        text(details),
    ];

    if (modCase.evidence && IMAGE_URL.test(modCase.evidence)) components.push(gallery(modCase.evidence));
    if (modCase.editedBy) components.push(text(`-# Reason last edited by <@${modCase.editedBy}>`));

    components.push(buttons({ id: `history:${modCase.userId}:1:new`, label: 'View history', emoji: '📂' }));
    return v2(components, options);
}
