const { SlashCommandBuilder, MessageFlags, InteractionContextType } = require('discord.js');
const { canReadChannel } = require('../../utils/permissions');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('source')
        .setDescription('Get a jump link to a message in a specified channel.')
        .setContexts(InteractionContextType.Guild)
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('The channel the message is in')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('message_id')
                .setDescription('The ID of the message')
                .setRequired(true)
        ),

    async execute(interaction) {
        const channel = interaction.options.getChannel('channel');
        const messageId = interaction.options.getString('message_id');

        if (!channel.isTextBased()) {
            return interaction.reply({ content: 'That channel is not a text channel.', flags: MessageFlags.Ephemeral });
        }

        if (!canReadChannel(interaction.member, channel)) {
            return interaction.reply({ content: 'You don\'t have access to that channel.', flags: MessageFlags.Ephemeral });
        }

        try {
            const message = await channel.messages.fetch(messageId);
            const link = `https://discord.com/channels/${interaction.guild.id}/${channel.id}/${message.id}`;

            return interaction.reply({ content: `## 🔍 Source of ${messageId}\n${link}`, flags: MessageFlags.Ephemeral });
        } catch (err) {
            return interaction.reply({ content: 'Could not find a message with that ID in the specified channel.', flags: MessageFlags.Ephemeral });
        }
    }
};
