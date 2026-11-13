const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const AntiReply = require('../../schemas/replyping/replyping');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('replyping')
        .setDescription('Allow users to ping or not ping certain users on replying.')
        .addSubcommand(sub =>
            sub.setName('add')
                .setDescription('Add a user to the protected list')
                .addUserOption(opt => opt.setName('user').setDescription('User to protect').setRequired(true))
                .addIntegerOption(opt => opt.setName('timeout').setDescription('Timeout in minutes (max 28 days)').setMinValue(1).setMaxValue(40320).setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('remove')
                .setDescription('Remove a user from the protected list')
                .addUserOption(opt => opt.setName('user').setDescription('User to remove').setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('list')
                .setDescription('List all protected users'))
        .addSubcommand(sub =>
            sub.setName('exempt-role')
                .setDescription('Manage exempt roles')
                .addStringOption(opt => opt.setName('action').setDescription('Add or remove role').setRequired(true)
                    .addChoices(
                        { name: 'add', value: 'add' },
                        { name: 'remove', value: 'remove' }
                    ))
                .addRoleOption(opt => opt.setName('role').setDescription('Role to exempt').setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('exempt-channel')
                .setDescription('Manage exempt channels')
                .addStringOption(opt => opt.setName('action').setDescription('Add or remove channel').setRequired(true)
                    .addChoices(
                        { name: 'add', value: 'add' },
                        { name: 'remove', value: 'remove' }
                    ))
                .addChannelOption(opt => opt.setName('channel').setDescription('Channel to exempt').setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('exemptions')
                .setDescription('List all exempt roles and channels')),

    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({
                content: 'You need administrative permissions to use this command.',
                flags: MessageFlags.Ephemeral
            });
        }

        const sub = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;
        let doc = await AntiReply.findOne({ guildId });
        if (!doc) {
            doc = new AntiReply({
                guildId,
                protectedUsers: [],
                exemptRoles: [],
                exemptChannels: []
            });
        }

        if (sub === 'add') {
            const user = interaction.options.getUser('user');
            const timeout = (interaction.options.getInteger('timeout') || 10) * 60 * 1000;

            if (doc.protectedUsers.some(u => u.userId === user.id)) {
                return interaction.reply({ content: 'This user is already protected.', flags: MessageFlags.Ephemeral });
            }

            doc.protectedUsers.push({ userId: user.id, timeout });
            await doc.save();
            return interaction.reply({ content: `Added ${user.tag} to protected list with a timeout of ${timeout / 60000} minutes.`, flags: MessageFlags.Ephemeral });
        }

        if (sub === 'remove') {
            const user = interaction.options.getUser('user');
            doc.protectedUsers = doc.protectedUsers.filter(u => u.userId !== user.id);
            await doc.save();
            return interaction.reply({ content: `Removed ${user.tag} from protected list.`, flags: MessageFlags.Ephemeral });
        }

        if (sub === 'list') {
            if (doc.protectedUsers.length === 0) return interaction.reply({ content: 'No protected users set.', flags: MessageFlags.Ephemeral });
            const list = doc.protectedUsers.map(u => `<@${u.userId}>: ${u.timeout / 60000} min.`).join('\n');
            return interaction.reply({ content: `## 🔐 Protected users\n${list}`, flags: MessageFlags.Ephemeral });
        }

        if (sub === 'exempt-role') {
            const action = interaction.options.getString('action');
            const role = interaction.options.getRole('role');

            if (action === 'add') {
                if (doc.exemptRoles.includes(role.id)) {
                    return interaction.reply({ content: 'This role is already exempt.', flags: MessageFlags.Ephemeral });
                }
                doc.exemptRoles.push(role.id);
                await doc.save();
                return interaction.reply({ content: `Added ${role.name} to exempt roles.`, flags: MessageFlags.Ephemeral });
            } else if (action === 'remove') {
                doc.exemptRoles = doc.exemptRoles.filter(r => r !== role.id);
                await doc.save();
                return interaction.reply({ content: `Removed ${role.name} from exempt roles.`, flags: MessageFlags.Ephemeral });
            }
        }

        if (sub === 'exempt-channel') {
            const action = interaction.options.getString('action');
            const channel = interaction.options.getChannel('channel');

            if (action === 'add') {
                if (doc.exemptChannels.includes(channel.id)) {
                    return interaction.reply({ content: 'This channel is already exempt.', flags: MessageFlags.Ephemeral });
                }
                doc.exemptChannels.push(channel.id);
                await doc.save();
                return interaction.reply({ content: `Added ${channel.name} to exempt channels.`, flags: MessageFlags.Ephemeral });
            } else if (action === 'remove') {
                doc.exemptChannels = doc.exemptChannels.filter(c => c !== channel.id);
                await doc.save();
                return interaction.reply({ content: `Removed ${channel.name} from exempt channels.`, flags: MessageFlags.Ephemeral });
            }
        }

        if (sub === 'exemptions') {
            const rolesList = doc.exemptRoles?.length > 0
                ? doc.exemptRoles.map(roleId => `<@&${roleId}>`).join('\n')
                : 'None';

            const channelsList = doc.exemptChannels?.length > 0
                ? doc.exemptChannels.map(channelId => `<#${channelId}>`).join('\n')
                : 'None';

            return interaction.reply({
                content: `## 📋 Exemptions\n**Exempt Roles:**\n${rolesList}\n\n**Exempt Channels:**\n${channelsList}`,
                flags: MessageFlags.Ephemeral
            });
        }
    }
};