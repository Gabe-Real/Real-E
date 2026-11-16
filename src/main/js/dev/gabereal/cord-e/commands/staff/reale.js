const { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType, MessageFlags } = require('discord.js');
const roles = require('../../modules/staff/roles');
const { logAction } = require('../../modules/staff/logs');
const { card } = require('../../modules/staff/ui');
const staff = require('../../modules/staff/actions/staff');
const management = require('../../modules/staff/actions/management');
const dev = require('../../modules/staff/actions/dev');

// Each tier and the level needed to use it. Higher tiers can use everything below them.
const TIERS = { staff: { level: 'staff', ...staff }, management: { level: 'management', ...management }, dev: { level: 'dev', ...dev } };

const action = (choices) => (o) => o.setName('action').setDescription('Choose an action').setRequired(true)
    .addChoices(...choices.map(([name, value]) => ({ name, value })));
const guildId = (o) => o.setName('guild_id').setDescription('Server (start typing its name, or paste an ID)').setAutocomplete(true);
const userId = (o) => o.setName('user_id').setDescription('User ID');
const channelId = (o) => o.setName('channel_id').setDescription('Channel ID');
const textOpt = (o) => o.setName('text').setDescription('Text (use \\n for new lines)').setMaxLength(2000);
const toggle = (o) => o.setName('toggle').setDescription('On or off');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('reale')
        .setDescription('Real-E staff tools')
        // Hidden from normal members. Staff can still use it in DMs with Real-E or where they're admin.
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM)
        .addSubcommand(sub => sub.setName('staff').setDescription('Staff actions')
            .addStringOption(action(staff.choices)).addStringOption(guildId))
        .addSubcommand(sub => sub.setName('management').setDescription('Management actions')
            .addStringOption(action(management.choices)).addStringOption(guildId).addStringOption(userId)
            .addStringOption(channelId).addStringOption(textOpt).addBooleanOption(toggle))
        .addSubcommand(sub => sub.setName('dev').setDescription('Developer actions')
            .addStringOption(action(dev.choices)).addStringOption(userId).addBooleanOption(toggle).addStringOption(textOpt)
            .addStringOption(o => o.setName('status').setDescription('Online status').addChoices(
                { name: '🟢 Online', value: 'online' }, { name: '🌙 Idle', value: 'idle' },
                { name: '⛔ Do not disturb', value: 'dnd' }, { name: '⚫ Invisible', value: 'invisible' }))
            .addStringOption(o => o.setName('activity').setDescription('Activity type').addChoices(
                { name: 'Playing', value: 'playing' }, { name: 'Watching', value: 'watching' }, { name: 'Listening to', value: 'listening' },
                { name: 'Competing in', value: 'competing' }, { name: 'Custom status', value: 'custom' },
                { name: 'Reset to automatic', value: 'reset' }))),

    async execute(interaction) {
        const tier = TIERS[interaction.options.getSubcommand()];
        const name = interaction.options.getString('action');

        const level = await roles.levelOf(interaction.user.id);
        if (roles.RANK[level] < roles.RANK[tier.level]) {
            return interaction.reply(card(`🔒 ${roles.LABEL[tier.level]} only`,
                level === 'none' ? 'You don\'t have Real-E staff access' : `You're ${roles.LABEL[level]}, this needs ${roles.LABEL[tier.level]}`));
        }

        const result = await tier.actions[name](interaction);
        if (result?.modal) await interaction.showModal(result.modal);
        else await interaction.reply(result);

        // Logged after replying, so a slow database can't make Discord time out.
        const details = ['guild_id', 'user_id', 'channel_id'].map(k => interaction.options.getString(k) && `${k}: ${interaction.options.getString(k)}`).filter(Boolean).join(', ');
        await logAction(interaction.client, { userId: interaction.user.id, level, action: `${tier.level} ${name}`, details });
    },

    async autocomplete(interaction) {
        if (!(await roles.has(interaction.user.id, 'staff'))) return interaction.respond([]);
        const typed = interaction.options.getFocused().toLowerCase();
        await interaction.respond([...interaction.client.guilds.cache.values()]
            .filter(g => g.name.toLowerCase().includes(typed) || g.id.startsWith(typed))
            .sort((a, b) => b.memberCount - a.memberCount)
            .slice(0, 25)
            .map(g => ({ name: `${g.name} (${g.memberCount} members)`.slice(0, 100), value: g.id })));
    },

    // Page arrows on "List all servers": reale:servers:<page>
    async handleButton(interaction) {
        if (!(await roles.has(interaction.user.id, 'staff'))) return interaction.reply(card('🔒 Staff only'));
        const [, kind, page] = interaction.customId.split(':');
        if (kind === 'servers') {
            const payload = await staff.actions.servers(interaction, Number(page));
            return interaction.update({ components: payload.components, flags: MessageFlags.IsComponentsV2, allowedMentions: payload.allowedMentions });
        }
    },
};
