const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } = require('discord.js');
const ms = require('ms');
const ModLog = require('../../schemas/logging/modlogs');
const { createCase, caseLabel } = require('../../utils/cases');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mute')
        .setDescription('Mute a user for a period of time or unmute them')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addSubcommand(sub =>
            sub.setName('user')
                .setDescription('Mute a user')
                .addUserOption(o => o.setName('target').setDescription('User to mute').setRequired(true))
                .addStringOption(o => o.setName('time').setDescription('Mute time (e.g., 10m, 2h, 1d)').setRequired(true))
                .addStringOption(o => o.setName('reason').setDescription('Reason for mute').setRequired(false))
        )
        .addSubcommand(sub =>
            sub.setName('clear')
                .setDescription('Unmute a user')
                .addUserOption(o => o.setName('target').setDescription('User to unmute').setRequired(true))
        ),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const guildId = interaction.guild.id; // <-- the missing piece that was crashing everything
        const targetUser = interaction.options.getUser('target');
        const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

        if (!member) {
            return interaction.reply({ content: 'Could not find that member.', flags: MessageFlags.Ephemeral });
        }

        // Best-effort modlog sender. Never let a logging failure break the command.
        const sendModLog = async (embed) => {
            try {
                const modlogData = await ModLog.findOne({ guildId });
                if (!modlogData?.modlogChannelId) return;

                const modlogChannel = await interaction.guild.channels
                    .fetch(modlogData.modlogChannelId)
                    .catch(() => null);

                if (modlogChannel?.isTextBased()) {
                    await modlogChannel.send({ embeds: [embed] });
                }
            } catch (err) {
                console.error('[mute] Failed to send modlog:', err);
            }
        };

        if (sub === 'user') {
            const timeStr = interaction.options.getString('time');
            const reason = interaction.options.getString('reason') || 'No reason provided.';
            const duration = ms(timeStr);

            if (!duration || duration < 1000 || duration > 28 * 24 * 60 * 60 * 1000) {
                return interaction.reply({
                    content: 'Invalid time. Must be between 1s and 28d (e.g. `10m`, `2h`, `1d`).',
                    flags: MessageFlags.Ephemeral
                });
            }

            if (!member.moderatable) {
                return interaction.reply({
                    content: 'I cannot mute that user. Do I have the permission, and is my role above theirs?',
                    flags: MessageFlags.Ephemeral
                });
            }

            await member.timeout(duration, reason);

            // DM is best-effort — the user may have DMs closed, which would otherwise throw and crash the command.
            await targetUser
                .send(`You were muted in **${interaction.guild.name}** for ${timeStr}.\nReason: ${reason}`)
                .catch(() => null);

            // Reply first so the interaction is always answered, even if the modlog lookup is slow.
            const modCase = await createCase({ guild: interaction.guild, action: 'mute', user: targetUser, moderator: interaction.user, reason, duration: timeStr });
            await interaction.reply({
                content: `Successfully **muted** ${targetUser.username} for ${timeStr} 💖` + (modCase ? `\n-# ${caseLabel(modCase)}` : ''),
                allowedMentions: { users: [] }
            });

            const embed = new EmbedBuilder()
                .setTitle('🔕 User Muted')
                .setColor('Yellow')
                .addFields(
                    { name: 'User', value: `${targetUser.username} (${targetUser.id})`, inline: false },
                    { name: 'Reason', value: reason, inline: false },
                    { name: 'Duration', value: timeStr, inline: false },
                    { name: 'Moderator', value: `<@${interaction.user.id}>`, inline: false }
                )
                .setTimestamp();
            if (modCase) embed.setFooter({ text: caseLabel(modCase) });

            await sendModLog(embed);
        }

        if (sub === 'clear') {
            if (!member.isCommunicationDisabled()) {
                return interaction.reply({ content: 'This user is not muted.', flags: MessageFlags.Ephemeral });
            }

            await member.timeout(null, 'Manual unmute via /mute clear');

            await targetUser
                .send(`You were unmuted in **${interaction.guild.name}**.`)
                .catch(() => null);

            const modCase = await createCase({ guild: interaction.guild, action: 'unmute', user: targetUser, moderator: interaction.user, reason: 'Manual unmute' });
            await interaction.reply({
                content: `Successfully **unmuted** ${targetUser.username}. 💖` + (modCase ? `\n-# ${caseLabel(modCase)}` : ''),
                allowedMentions: { users: [] }
            });

            const embed = new EmbedBuilder()
                .setTitle('🔔 User Unmuted')
                .setColor('Green')
                .addFields(
                    { name: 'User', value: `${targetUser.username} (${targetUser.id})`, inline: false },
                    { name: 'Moderator', value: `<@${interaction.user.id}>`, inline: false }
                )
                .setTimestamp();
            if (modCase) embed.setFooter({ text: caseLabel(modCase) });

            await sendModLog(embed);
        }
    }
};