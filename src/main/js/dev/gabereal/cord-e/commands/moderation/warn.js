const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags, InteractionContextType } = require('discord.js');
const Warn = require('../../schemas/moderation/warn');
const WarnConfig = require('../../schemas/moderation/warnConfig');
const { sendModLog } = require('../../utils/modlog');
const { createCase, caseLabel } = require('../../utils/cases');

const THRESHOLD_MUTE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Apply the configured threshold action. Returns a short description of what happened.
 * DMs are best-effort and sent *before* the action; a closed DM must never stop the action itself.
 */
async function applyThresholdAction(member, config, guildName) {
    const reason = `Reached ${config.warningThreshold} warnings`;
    const notify = (text) => member.send(text).catch(() => null);

    switch (config.action) {
        case 'kick':
            if (!member.kickable) return 'kick failed (missing permission or role hierarchy)';
            await notify(`You were kicked from **${guildName}** for reaching the warning threshold`);
            await member.kick(reason);
            return 'kicked';
        case 'ban':
            if (!member.bannable) return 'ban failed (missing permission or role hierarchy)';
            await notify(`You were banned from **${guildName}** for reaching the warning threshold`);
            await member.ban({ reason });
            return 'banned';
        case 'mute':
            if (!member.moderatable) return 'mute failed (missing permission or role hierarchy)';
            await member.timeout(THRESHOLD_MUTE_MS, reason);
            await notify(`You were muted in **${guildName}** for reaching the warning threshold`);
            return 'muted for 7 days';
        default:
            return 'no action configured';
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('warn')
        .setDescription('Warn users or manage warning settings')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .setContexts(InteractionContextType.Guild)
        .addSubcommand(sub =>
            sub.setName('user')
                .setDescription('Warn a user')
                .addUserOption(o => o.setName('target').setDescription('User to warn').setRequired(true))
                .addStringOption(o => o.setName('reason').setDescription('Reason for warning').setMaxLength(500).setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('config')
                .setDescription('Configure warning system')
                .addIntegerOption(o => o.setName('threshold').setDescription('Warnings until action').setMinValue(1).setMaxValue(100))
                .addStringOption(o =>
                    o.setName('action')
                        .setDescription('Action at threshold')
                        .addChoices(
                            { name: 'Kick', value: 'kick' },
                            { name: 'Mute', value: 'mute' },
                            { name: 'Ban', value: 'ban' },
                            { name: 'None', value: 'none' }
                        )
                )
        )
        .addSubcommand(sub =>
            sub.setName('view')
                .setDescription('View warnings for a user')
                .addUserOption(o => o.setName('target').setDescription('User to check').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('clear')
                .setDescription('Clear all warnings for a user')
                .addUserOption(o => o.setName('target').setDescription('User to clear').setRequired(true))
        ),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;

        if (sub === 'config') {
            const threshold = interaction.options.getInteger('threshold');
            const action = interaction.options.getString('action');

            let config = await WarnConfig.findOne({ guildId });
            if (!config) config = new WarnConfig({ guildId });

            if (threshold !== null) config.warningThreshold = threshold;
            if (action) config.action = action;

            await config.save();

            return interaction.reply({
                content: `Warn config updated:\nThreshold: ${config.warningThreshold}\nAction: ${config.action}`,
                flags: MessageFlags.Ephemeral
            });
        }

        if (sub === 'user') {
            const user = interaction.options.getUser('target');
            const reason = interaction.options.getString('reason');
            const moderatorId = interaction.user.id;

            // Several API calls follow (DM, possibly kick/ban) — defer so the 3s interaction window can't expire.
            await interaction.deferReply();

            let record = await Warn.findOne({ guildId, userId: user.id });
            if (!record) record = new Warn({ guildId, userId: user.id, warnings: [] });

            record.warnings.push({ reason, moderatorId });
            await record.save();

            const modCase = await createCase({ guild: interaction.guild, action: 'warn', user, moderator: interaction.user, reason });

            await sendModLog(interaction.guild, new EmbedBuilder()
                .setFooter(modCase ? { text: caseLabel(modCase) } : null)
                .setTitle('⚠️ User Warned')
                .setColor('Yellow')
                .addFields(
                    { name: 'User', value: `${user.username} (${user.id})`, inline: false },
                    { name: 'Reason', value: reason, inline: false },
                    { name: 'Total Warnings', value: `${record.warnings.length}`, inline: true },
                    { name: 'Moderator', value: `<@${moderatorId}>`, inline: true }
                )
                .setTimestamp());

            const config = await WarnConfig.findOne({ guildId }) || { warningThreshold: 3, action: 'kick' };

            await user.send(`You were warned in **${interaction.guild.name}** for ${reason}`)
                .catch(() => console.warn(`${user.tag} could not be DMed`));

            let thresholdNote = '';
            if (config.action !== 'none' && record.warnings.length >= config.warningThreshold) {
                const member = await interaction.guild.members.fetch(user.id).catch(() => null);
                const outcome = member
                    ? await applyThresholdAction(member, config, interaction.guild.name)
                        .catch(err => { console.error('[warn] threshold action failed:', err); return `${config.action} failed`; })
                    : 'user is no longer in the server';

                thresholdNote = `\nWarning threshold reached: ${outcome}.`;

                // Record the automatic punishment as its own case, done by the bot.
                const autoAction = { kick: 'kick', ban: 'ban', mute: 'mute' }[config.action];
                if (member && autoAction && !outcome.includes('failed')) {
                    const autoCase = await createCase({
                        guild: interaction.guild, action: autoAction, user, moderator: interaction.client.user,
                        reason: `Reached ${config.warningThreshold} warnings (auto)`, duration: autoAction === 'mute' ? '7d' : undefined,
                    });
                    if (autoCase) thresholdNote += ` (${caseLabel(autoCase)})`;
                }

                await sendModLog(interaction.guild, new EmbedBuilder()
                    .setTitle('🚨 Warning Threshold Reached')
                    .setColor('Red')
                    .addFields(
                        { name: 'User', value: `${user.username} (${user.id})`, inline: false },
                        { name: 'Reason', value: 'Warning Threshold Reached', inline: false },
                        { name: 'Action', value: outcome, inline: true }
                    )
                    .setTimestamp());

                record.warnings = [];
                await record.save();
            }

            return interaction.editReply({
                content: `Successfully **warned** ${user.username}. 💖${thresholdNote}` + (modCase ? `\n-# ${caseLabel(modCase)}` : ''),
            });
        }

        if (sub === 'view') {
            const user = interaction.options.getUser('target');
            const record = await Warn.findOne({ guildId, userId: user.id });

            if (!record || record.warnings.length === 0) {
                return interaction.reply({ content: `${user.tag} has no warnings.`, flags: MessageFlags.Ephemeral });
            }

            const list = record.warnings
                .map((warn, i) =>
                    `<@${warn.moderatorId}> at <t:${Math.floor(new Date(warn.date).getTime() / 1000)}:d>\n> **${i + 1}.** ${warn.reason}`
                )
                .join('\n');

            const content = `## ⚠️ ${user.tag}'s warnings:\n${list}`.slice(0, 2000);

            return interaction.reply({ content, allowedMentions: { parse: [] } });
        }

        if (sub === 'clear') {
            const user = interaction.options.getUser('target');
            const result = await Warn.findOneAndDelete({ guildId, userId: user.id });

            if (!result) {
                return interaction.reply({ content: `No warnings found for ${user.tag}.`, flags: MessageFlags.Ephemeral });
            }

            const modCase = await createCase({
                guild: interaction.guild, action: 'clearwarns', user, moderator: interaction.user,
                reason: `Cleared ${result.warnings.length} warning${result.warnings.length === 1 ? '' : 's'}`,
            });
            await interaction.reply({
                content: `🧹 Cleared all warnings for ${user.tag}.` + (modCase ? `\n-# ${caseLabel(modCase)}` : ''),
                flags: MessageFlags.Ephemeral,
            });

            await sendModLog(interaction.guild, new EmbedBuilder()
                .setTitle('🧹 Warnings Cleared')
                .setColor('Green')
                .addFields(
                    { name: 'User', value: `${user.tag} (${user.id})`, inline: false },
                    { name: 'Moderator', value: `<@${interaction.user.id}>`, inline: true }
                )
                .setTimestamp());
        }
    }
};
