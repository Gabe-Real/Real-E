const { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType, EmbedBuilder } = require('discord.js');
const ModCase = require('../../schemas/moderation/case');
const { ACTIONS } = require('../../utils/cases');
const { sendModLog } = require('../../utils/modlog');
const { text, divider, section, gallery, buttons, v2, notice } = require('../../utils/ui');

const IMAGE_URL = /^https?:\/\/\S+\.(png|jpe?g|gif|webp)(\?\S*)?$/i;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('case')
        .setDescription('Look up or edit a moderation case')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .setContexts(InteractionContextType.Guild)
        .addSubcommand(sub =>
            sub.setName('view')
                .setDescription('Show a case')
                .addIntegerOption(o => o.setName('id').setDescription('Case number').setMinValue(1).setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('reason')
                .setDescription('Change the reason on a case')
                .addIntegerOption(o => o.setName('id').setDescription('Case number').setMinValue(1).setRequired(true))
                .addStringOption(o => o.setName('reason').setDescription('New reason').setMaxLength(500).setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('delete')
                .setDescription('Delete a case (Manage Server only)')
                .addIntegerOption(o => o.setName('id').setDescription('Case number').setMinValue(1).setRequired(true))),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
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
    }
};

/** The full case card: header with the user's avatar, details, evidence, and a button to their history. */
async function buildCaseMessage(interaction, modCase) {
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
    return v2(components);
}
