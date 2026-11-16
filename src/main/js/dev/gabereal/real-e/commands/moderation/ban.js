const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags, InteractionContextType } = require('discord.js');
const { sendModLog } = require('../../utils/modlog');
const { checkModerationHierarchy } = require('../../utils/permissions');
const { scheduleUnban, cancelUnban } = require('../../utils/tempBans');
const { createCase, caseLabel } = require('../../utils/cases');

function parseDuration(str) {
    const regex = /^(\d+)(s|m|h|d|y)?$/i;
    const match = str.trim().match(regex);
    if (!match) return null;

    const value = parseInt(match[1], 10);
    const unit = match[2]?.toLowerCase() || 's';

    switch (unit) {
        case 's': return value * 1000;
        case 'm': return value * 60 * 1000;
        case 'h': return value * 60 * 60 * 1000;
        case 'd': return value * 24 * 60 * 60 * 1000;
        case 'y': return value * 365 * 24 * 60 * 60 * 1000;
        default: return null;
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Ban a user by ID or username, optionally for a set time')
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .setContexts(InteractionContextType.Guild)
        .addUserOption(option =>
            option.setName('target')
                .setDescription('The user to ban')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('The reason for the ban')
                .setMaxLength(500)
                .setRequired(true))
        .addStringOption(option =>
            option.setName('time')
                .setDescription('Ban duration (e.g. 10m, 1h, 2d, 1y). Leave empty for permanent.'))
        .addStringOption(option =>
            option.setName('image')
                .setDescription('Image proof of ban (e.g. a screenshot of the ban message). Leave empty for none.')),

    async execute(interaction) {
        const target = interaction.options.getUser('target');
        const reason = interaction.options.getString('reason');
        const timeStr = interaction.options.getString('time');
        const image = interaction.options.getString('image');
        const guild = interaction.guild;

        let durationMs = null;
        if (timeStr) {
            durationMs = parseDuration(timeStr);
            if (!durationMs) {
                return interaction.reply({ content: 'Invalid time format. Use values like `10m`, `1h`, `2d`, `1y`.', flags: MessageFlags.Ephemeral });
            }
        }

        // The target may not be in the server — banning by user ID still works, there's just no hierarchy to check.
        const targetMember = await guild.members.fetch(target.id).catch(() => null);
        if (targetMember) {
            const problem = checkModerationHierarchy(interaction.member, targetMember);
            if (problem) return interaction.reply({ content: problem, flags: MessageFlags.Ephemeral });
        }

        await interaction.deferReply();

        // DM before banning, while we still share a server. Best-effort: DMs may be closed.
        if (targetMember) {
            await target.send(`You have been banned from **${guild.name}**.\n**Reason:** ${reason}` +
                (durationMs ? `\n**Duration:** ${timeStr}` : '')).catch(() => null);
        }

        try {
            await guild.members.ban(target.id, { reason: `${reason} (by ${interaction.user.tag})`.slice(0, 512) });
        } catch (err) {
            console.error(err);
            return interaction.editReply({ content: 'Failed to ban the user. Do I have permissions?' });
        }
        console.log(`Banned ${target.tag} (${target.id}) for ${reason} in ${guild.id}. Duration: ${durationMs ? timeStr : 'Permanent'}`);

        if (durationMs) await scheduleUnban({ guildId: guild.id, user: target, moderatorId: interaction.user.id, durationMs });
        else await cancelUnban(guild.id, target.id); // re-banning permanently overrides an earlier temp ban

        const evidence = image && /^https?:\/\/\S+$/i.test(image) ? image : undefined;
        const modCase = await createCase({
            guild, action: durationMs ? 'tempban' : 'ban', user: target, moderator: interaction.user,
            reason, duration: durationMs ? timeStr : undefined, evidence,
        });

        await interaction.editReply({
            content: `Successfully **banned** ${target.username}. ${durationMs ? `They will be unbanned in ${timeStr}` : 'This ban is permanent'} 💖` +
                (modCase ? `\n-# ${caseLabel(modCase)}` : ''),
        });

        const embed = new EmbedBuilder()
            .setTitle('📛 User Banned')
            .setColor('Red')
            .addFields(
                { name: 'User', value: `${target.tag} (${target.id})`, inline: false },
                { name: 'Reason', value: reason, inline: false },
                { name: 'Duration', value: durationMs ? timeStr : 'Permanent', inline: true },
                { name: 'Moderator', value: `<@${interaction.user.id}>`, inline: true }
            )
            .setTimestamp();
        if (evidence) embed.setImage(evidence);
        if (modCase) embed.setFooter({ text: caseLabel(modCase) });

        await sendModLog(guild, embed);
    }
};
