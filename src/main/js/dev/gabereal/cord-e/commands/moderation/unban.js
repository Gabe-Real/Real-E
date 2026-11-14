const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags, InteractionContextType } = require('discord.js');
const { sendModLog } = require('../../utils/modlog');
const { cancelUnban } = require('../../utils/tempBans');
const { createCase, caseLabel } = require('../../utils/cases');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unban')
        .setDescription('Unban a user from the server')
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .setContexts(InteractionContextType.Guild)
        .addStringOption(option =>
            option.setName('userid').setDescription('The ID of the user to unban').setRequired(true)
        )
        .addStringOption(option =>
            option.setName('reason').setDescription('The reason for the unban').setMaxLength(500).setRequired(false)
        ),

    async execute(interaction) {
        const userId = interaction.options.getString('userid').trim();
        const reason = interaction.options.getString('reason') || 'No reason provided';
        const guild = interaction.guild;

        if (!/^\d{17,20}$/.test(userId)) {
            return interaction.reply({ content: 'That doesn\'t look like a valid user ID.', flags: MessageFlags.Ephemeral });
        }

        // Fetch just this ban. Fetching the whole list only returns the first 1000 bans.
        const banInfo = await guild.bans.fetch({ user: userId, force: true }).catch(() => null);
        if (!banInfo) {
            return interaction.reply({ content: 'That user is not banned.', flags: MessageFlags.Ephemeral });
        }

        try {
            await guild.members.unban(userId, reason);
        } catch (err) {
            console.error(err);
            return interaction.reply({ content: 'Failed to unban the user. Do I have permissions?', flags: MessageFlags.Ephemeral });
        }
        await cancelUnban(guild.id, userId);

        // Best-effort: usually fails, since an unbanned user rarely shares a server with the bot.
        await banInfo.user.send(`You have been unbanned from **${guild.name}**.\n**Reason:** ${reason}`).catch(() => null);

        const modCase = await createCase({ guild, action: 'unban', user: banInfo.user, moderator: interaction.user, reason });
        await interaction.reply({
            content: `Successfully **unbanned** <@${userId}>. They are now free to join back 💖` + (modCase ? `\n-# ${caseLabel(modCase)}` : ''),
            allowedMentions: { parse: [] },
        });

        const embed = new EmbedBuilder()
            .setTitle('🔓 User Unbanned')
            .setColor('Green')
            .addFields(
                { name: 'User', value: `${banInfo.user.username} (${userId})`, inline: false },
                { name: 'Reason', value: reason, inline: false },
                { name: 'Moderator', value: `<@${interaction.user.id}>`, inline: false }
            )
            .setTimestamp();
        if (modCase) embed.setFooter({ text: caseLabel(modCase) });

        await sendModLog(guild, embed);
    }
};
