const { PermissionFlagsBits, SlashCommandBuilder, EmbedBuilder, MessageFlags, InteractionContextType } = require('discord.js');
const { sendModLog } = require('../../utils/modlog');
const { checkModerationHierarchy } = require('../../utils/permissions');
const { createCase, caseLabel } = require('../../utils/cases');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Select a member and kick them.')
        .setContexts(InteractionContextType.Guild)
        .addUserOption(option =>
            option
                .setName('target')
                .setDescription('The member to kick')
                .setRequired(true))
        .addStringOption(option =>
            option
                .setName('reason')
                .setDescription('The reason for kicking')
                .setMaxLength(500)
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

    async execute(interaction) {
        const target = interaction.options.getUser('target');
        const reason = interaction.options.getString('reason');

        const targetMember = await interaction.guild.members.fetch(target.id).catch(() => null);
        if (!targetMember) {
            return interaction.reply({ content: 'Could not find that user in the server.', flags: MessageFlags.Ephemeral });
        }

        const problem = checkModerationHierarchy(interaction.member, targetMember);
        if (problem) return interaction.reply({ content: problem, flags: MessageFlags.Ephemeral });

        await interaction.deferReply();

        // DM first — once kicked we may no longer share a server.
        await targetMember.send(`You were kicked from **${interaction.guild.name}** for ${reason}`)
            .catch(err => console.warn(`Could not DM ${target.tag}: ${err.message}`));

        try {
            await targetMember.kick(`${reason} (by ${interaction.user.tag})`.slice(0, 512));
        } catch (err) {
            console.error(err);
            return interaction.editReply({ content: 'Failed to kick the user. Do I have permissions?' });
        }

        const modCase = await createCase({ guild: interaction.guild, action: 'kick', user: target, moderator: interaction.user, reason });
        await interaction.editReply(`Successfully **kicked** ${target.username} 💖` + (modCase ? `\n-# ${caseLabel(modCase)}` : ''));

        const embed = new EmbedBuilder()
            .setTitle('👢 User kicked')
            .setColor('Yellow')
            .addFields(
                { name: 'User', value: `${target.username} (${target.id})`, inline: false },
                { name: 'Reason', value: reason, inline: false },
                { name: 'Moderator', value: `<@${interaction.user.id}>`, inline: false }
            )
            .setTimestamp();
        if (modCase) embed.setFooter({ text: caseLabel(modCase) });

        await sendModLog(interaction.guild, embed);
    },
};
