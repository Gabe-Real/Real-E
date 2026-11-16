const { SlashCommandBuilder, InteractionContextType } = require('discord.js');
const { views } = require('../../modules/access');

// Anyone can ask for Real-E in their server. Opens the request form.
module.exports = {
    data: new SlashCommandBuilder()
        .setName('request')
        .setDescription('Ask to get Real-E in your server')
        .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM),

    async execute(interaction) {
        return interaction.showModal(views.requestModal());
    },
};
