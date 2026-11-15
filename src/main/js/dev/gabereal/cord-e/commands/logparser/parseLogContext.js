const { ContextMenuCommandBuilder, ApplicationCommandType, InteractionContextType, MessageFlags } = require('discord.js');
const { replyWithResults } = require('../../modules/logparser');
const { notice } = require('../../utils/ui');

// Right-click a message → Apps → "Parse Minecraft Log". Works in any channel, and only you see the result.
module.exports = {
    data: new ContextMenuCommandBuilder()
        .setName('Parse Minecraft Log')
        .setType(ApplicationCommandType.Message)
        .setContexts(InteractionContextType.Guild),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        let first = true;
        const send = async (payload) => {
            if (first) {
                first = false;
                return interaction.editReply(payload);
            }
            return interaction.followUp({ ...payload, flags: payload.flags | MessageFlags.Ephemeral });
        };

        const found = await replyWithResults(interaction.targetMessage, send);
        if (!found) {
            return interaction.editReply(notice('🔍 No Minecraft log found', 'Attach a `latest.log` / crash report, or link a paste site like mclo.gs'));
        }
    },
};
