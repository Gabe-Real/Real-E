const { SlashCommandBuilder, MessageFlags, InteractionContextType } = require('discord.js');
const { canReadChannel } = require('../../utils/permissions');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('context')
        .setDescription('Get the context of a message.')
        .setContexts(InteractionContextType.Guild)
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('The channel to get the context of')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('message_id')
                .setDescription('The message_id to get the context of')
                .setRequired(true)
        ),

    async execute(interaction) {
        const channel = interaction.options.getChannel('channel');
        const messageId = interaction.options.getString('message_id');

        if (!channel.isTextBased()) {
            return interaction.reply({ content: 'That channel is not a text channel.', flags: MessageFlags.Ephemeral });
        }

        // The bot can see channels the caller can't (e.g. staff channels) — only reveal what they could read themselves.
        if (!canReadChannel(interaction.member, channel)) {
            return interaction.reply({ content: 'You don\'t have access to that channel.', flags: MessageFlags.Ephemeral });
        }

        const message = await channel.messages.fetch(messageId).catch(() => null);
        if (!message) {
            return interaction.reply({ content: 'Could not find a message with that ID in the specified channel.', flags: MessageFlags.Ephemeral });
        }

        const header = `## 🔍 Context of ${messageId}\n`;
        const footer = ` - ${channel}`;
        const body = (message.content || '*No text content*').slice(0, 2000 - header.length - footer.length);

        await interaction.reply({ content: header + body + footer, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
    }
};
