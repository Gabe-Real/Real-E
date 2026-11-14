const { MessageFlags } = require('discord.js');
const { canSendInChannel } = require('../../utils/permissions');
const { allowedMentionsFor } = require('../../commands/moderation/post');

// Handles the pop-up from `/post message`. The custom ID looks like `post:message:<channelId>`;
// index.js matches it to this handler because it starts with `post:message`.
module.exports = {
    customId: 'post:message',

    async execute(interaction) {
        const channelId = interaction.customId.split(':')[2];
        const content = interaction.fields.getTextInputValue('post_content');

        // Acknowledge first: Discord only gives us 3 seconds to respond.
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
        if (!channel) {
            return interaction.editReply('That channel doesn\'t exist any more.');
        }

        // Re-check permissions: they could have changed while the pop-up was open.
        if (!canSendInChannel(interaction.member, channel)) {
            return interaction.editReply('You don\'t have permission to send messages in that channel.');
        }

        try {
            await channel.send({ content, allowedMentions: allowedMentionsFor(interaction.member, channel) });
            await interaction.editReply(`Posted in ${channel}.`);
        } catch (err) {
            console.error('[post message]', err);
            await interaction.editReply('I couldn\'t post there. Check I have permission to send messages in that channel.');
        }
    }
};
