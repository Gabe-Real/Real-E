const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags, InteractionContextType } = require('discord.js');
const { sendModLog } = require('../../utils/modlog');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('disconnect')
        .setDescription('Disconnects a user from their voice channel.')
        .setContexts(InteractionContextType.Guild)
        .addUserOption(option =>
            option.setName('target')
                .setDescription('The user to disconnect')
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.MoveMembers),

    async execute(interaction) {
        const target = interaction.options.getMember('target');

        if (!target) {
            return interaction.reply({ content: 'User not found.', flags: MessageFlags.Ephemeral });
        }

        if (!target.voice.channel) {
            return interaction.reply({ content: 'That user is not in a voice channel.', flags: MessageFlags.Ephemeral });
        }

        try {
            await target.voice.disconnect(`Disconnected by ${interaction.user.tag}`);
        } catch (err) {
            console.error(err);
            return interaction.reply({ content: 'Failed to disconnect the user. Do I have the right permissions?', flags: MessageFlags.Ephemeral });
        }

        await interaction.reply({ content: `Successfully disconnected **${target}** from their voice channel.`, flags: MessageFlags.Ephemeral });

        const embed = new EmbedBuilder()
            .setTitle('🚧 User Disconnected')
            .setColor('Yellow')
            .addFields(
                { name: 'User', value: `${target.user.username} (${target.id})`, inline: false },
                { name: 'Moderator', value: `<@${interaction.user.id}>`, inline: false }
            )
            .setTimestamp();

        await sendModLog(interaction.guild, embed);
    }
};
