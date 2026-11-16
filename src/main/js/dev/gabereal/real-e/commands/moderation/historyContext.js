const { ContextMenuCommandBuilder, ApplicationCommandType, PermissionFlagsBits, InteractionContextType } = require('discord.js');
const { buildHistory } = require('./history');

// Right-click a user (or their message's author) → Apps → "Mod History".
module.exports = {
    data: new ContextMenuCommandBuilder()
        .setName('Mod History')
        .setType(ApplicationCommandType.User)
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .setContexts(InteractionContextType.Guild),

    async execute(interaction) {
        return interaction.reply(await buildHistory(interaction.guild, interaction.targetUser, 1, { ephemeral: true }));
    },
};
