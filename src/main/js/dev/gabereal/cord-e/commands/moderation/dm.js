const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, InteractionContextType } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dm')
        .setDescription('DM a user')
        // Without this, any member could make the bot DM arbitrary text to anyone.
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .setContexts(InteractionContextType.Guild)
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to dm')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('message')
                .setDescription('The message to send')
                .setMaxLength(2000)
                .setRequired(true)
        ),

    async execute(interaction) {
        const user = interaction.options.getUser('user');
        const message = interaction.options.getString('message');

        try {
            await user.send(message);
        } catch (err) {
            console.warn(`[dm] Could not DM ${user.id}: ${err.message}`);
            return interaction.reply({ content: `Couldn't DM **${user.username}** (they may have DMs closed).`, flags: MessageFlags.Ephemeral });
        }

        console.log(`[dm] ${interaction.user.tag} (${interaction.user.id}) DMed ${user.tag} (${user.id}) from guild ${interaction.guildId}`);
        return interaction.reply({ content: `Sent your message to **${user.username}**.`, flags: MessageFlags.Ephemeral });
    }
};
