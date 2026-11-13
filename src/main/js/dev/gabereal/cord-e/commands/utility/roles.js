const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    MessageFlags,
} = require('discord.js');
const { memberOutranksRole } = require('../../utils/permissions');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('roles')
        .setDescription('Manage roles')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        .addSubcommand(sub =>
            sub.setName('create')
                .setDescription('Create a new role')
                .addStringOption(opt =>
                    opt.setName('name').setDescription('Role name').setRequired(true))
                .addStringOption(opt =>
                    opt.setName('color').setDescription('Hex color code or color name').setRequired(false))
                .addBooleanOption(opt =>
                    opt.setName('mentionable').setDescription('Make role mentionable').setRequired(false))
                .addBooleanOption(opt =>
                    opt.setName('hoist').setDescription('Show role separately').setRequired(false))
        )
        .addSubcommand(sub =>
            sub.setName('delete')
                .setDescription('Delete a role')
                .addRoleOption(opt =>
                    opt.setName('role').setDescription('Role to delete').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('edit')
                .setDescription('Edit a role')
                .addRoleOption(opt =>
                    opt.setName('role').setDescription('Role to edit').setRequired(true))
                .addStringOption(opt =>
                    opt.setName('name').setDescription('New role name').setRequired(false))
                .addStringOption(opt =>
                    opt.setName('color').setDescription('New color').setRequired(false))
                .addBooleanOption(opt =>
                    opt.setName('mentionable').setDescription('Set mentionable').setRequired(false))
                .addBooleanOption(opt =>
                    opt.setName('hoist').setDescription('Set hoist').setRequired(false))
        )
        .addSubcommand(sub =>
            sub.setName('all')
                .setDescription('Give role to everyone')
                .addRoleOption(opt =>
                    opt.setName('role').setDescription('Role to assign').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('nuke')
                .setDescription('Remove role from everyone')
                .addRoleOption(opt =>
                    opt.setName('role').setDescription('Role to remove').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('grant')
                .setDescription('Grant a role to a user')
                .addUserOption(opt =>
                    opt.setName('user').setDescription('User to give the role to').setRequired(true))
                .addRoleOption(opt =>
                    opt.setName('primary_role').setDescription('Role to grant').setRequired(true))
                .addRoleOption(opt =>
                    opt.setName('secondary_role').setDescription('Secondary role to grant').setRequired(false))
                .addRoleOption(opt =>
                    opt.setName('tertiary_role').setDescription('Tertiary role to grant').setRequired(false))
        )
        .addSubcommand(sub =>
            sub.setName('revoke')
                .setDescription('Revoke a role from a user')
                .addUserOption(opt =>
                    opt.setName('user').setDescription('User to remove the role from').setRequired(true))
                .addRoleOption(opt =>
                    opt.setName('role').setDescription('Role to revoke').setRequired(true))
                .addRoleOption(opt =>
                    opt.setName('secondary_role').setDescription('Secondary role to revoke').setRequired(false))
                .addRoleOption(opt =>
                    opt.setName('tertiary_role').setDescription('Tertiary role to revoke').setRequired(false))
        ),

    async execute(interaction) {
        const { guild, member, options } = interaction;
        const sub = options.getSubcommand();

        if (!guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles)) {
            return interaction.reply({ content: 'I need Manage Roles permission!', flags: MessageFlags.Ephemeral });
        }

        // Both the bot AND the invoking member must outrank the role. Checking only the bot let anyone with
        // Manage Roles grant/edit/delete roles above their own (e.g. give themselves an admin role).
        function canManageRole(role) {
            if (role.id === guild.id || role.managed) return false; // @everyone / integration roles
            return role.position < guild.members.me.roles.highest.position && memberOutranksRole(member, role);
        }

        if (sub === 'create') {
            const name = options.getString('name');
            const colorInput = options.getString('color') || null;
            const mentionable = options.getBoolean('mentionable') ?? false;
            const hoist = options.getBoolean('hoist') ?? false;

            try {
                const role = await guild.roles.create({
                    name,
                    colors: colorInput ? { primaryColor: colorInput } : undefined,
                    mentionable,
                    hoist,
                    reason: `Role created by ${member.user.tag} via /roles create`
                });
                return interaction.reply({ content: `Role **${role.name}** created successfully!`, flags: MessageFlags.Ephemeral });
            } catch (err) {
                return interaction.reply({ content: `Failed to create role: ${err.message}`, flags: MessageFlags.Ephemeral });
            }
        }

        if (sub === 'delete') {
            const role = options.getRole('role');
            if (!role) return interaction.reply({ content: 'Role not found.', flags: MessageFlags.Ephemeral });
            if (!canManageRole(role)) return interaction.reply({ content: "That role is above your highest role or mine (or is managed by an integration), so it can't be managed here.", flags: MessageFlags.Ephemeral });

            try {
                await role.delete(`Role deleted by ${member.user.tag} via /roles delete`);
                return interaction.reply({ content: `Role **${role.name}** has been deleted.`, flags: MessageFlags.Ephemeral });
            } catch (err) {
                return interaction.reply({ content: `Failed to delete role: ${err.message}`, flags: MessageFlags.Ephemeral });
            }
        }

        if (sub === 'edit') {
            const role = options.getRole('role');
            if (!role) return interaction.reply({ content: 'Role not found.', flags: MessageFlags.Ephemeral });
            if (!canManageRole(role)) return interaction.reply({ content: "That role is above your highest role or mine (or is managed by an integration), so it can't be managed here.", flags: MessageFlags.Ephemeral });

            const updates = {};
            if (options.getString('name')) updates.name = options.getString('name');
            if (options.getString('color')) updates.colors = { primaryColor: options.getString('color') };
            if (options.getBoolean('mentionable') !== null) updates.mentionable = options.getBoolean('mentionable');
            if (options.getBoolean('hoist') !== null) updates.hoist = options.getBoolean('hoist');

            try {
                await role.edit({ ...updates, reason: `Role edited by ${member.user.tag} via /roles edit` });
                return interaction.reply({ content: `Role **${role.name}** updated successfully!`, flags: MessageFlags.Ephemeral });
            } catch (err) {
                return interaction.reply({ content: `Failed to edit role: ${err.message}`, flags: MessageFlags.Ephemeral });
            }
        }

        if (sub === 'all') {
            const role = options.getRole('role');
            if (!role) return interaction.reply({ content: 'Role not found.', flags: MessageFlags.Ephemeral });
            if (!canManageRole(role)) return interaction.reply({ content: "That role is above your highest role or mine (or is managed by an integration), so it can't be managed here.", flags: MessageFlags.Ephemeral });

            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            try {
                const members = await guild.members.fetch();
                let count = 0;
                for (const [, guildMember] of members) {
                    if (!guildMember.roles.cache.has(role.id)) {
                        if (guildMember.roles.highest.position >= guild.members.me.roles.highest.position) continue;

                        try {
                            await guildMember.roles.add(role);
                            count++;
                        } catch {

                        }
                    }
                }
                return interaction.editReply({ content: `Role **${role.name}** added to ${count} members.` });
            } catch (err) {
                return interaction.editReply({ content: `Failed to add role to everyone: ${err.message}` });
            }
        }

        if (sub === 'nuke') {
            const role = options.getRole('role');
            if (!role) return interaction.reply({ content: 'Role not found.', flags: MessageFlags.Ephemeral });
            if (!canManageRole(role)) return interaction.reply({ content: "That role is above your highest role or mine (or is managed by an integration), so it can't be managed here.", flags: MessageFlags.Ephemeral });

            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            try {
                const members = await guild.members.fetch();
                let count = 0;
                for (const [, guildMember] of members) {
                    if (guildMember.roles.cache.has(role.id)) {
                        if (guildMember.roles.highest.position >= guild.members.me.roles.highest.position) continue;

                        try {
                            await guildMember.roles.remove(role);
                            count++;
                        } catch {

                        }
                    }
                }
                return interaction.editReply({ content: `Role **${role.name}** removed from ${count} members.` });
            } catch (err) {
                return interaction.editReply({ content: `Failed to remove role from everyone: ${err.message}` });
            }
        }

        if (sub === 'grant') {
            const targetUser = options.getUser('user');
            const primary = options.getRole('primary_role');
            const secondary = options.getRole('secondary_role');
            const tertiary = options.getRole('tertiary_role');

            const rolesToGrant = [primary, secondary, tertiary].filter(r => r); // ignore null
            const granted = [];
            const skipped = [];
            const failed = [];

            const memberTarget = await guild.members.fetch(targetUser.id).catch(() => null);
            if (!memberTarget) return interaction.reply({ content: 'That user is not in this server.', flags: MessageFlags.Ephemeral });

            for (const role of rolesToGrant) {
                if (!canManageRole(role)) {
                    failed.push(`${role.name} (above your role or mine)`);
                    continue;
                }

                if (memberTarget.roles.cache.has(role.id)) {
                    skipped.push(`${role.name} (already has role)`);
                    continue;
                }

                try {
                    await memberTarget.roles.add(role);
                    granted.push(`${role.name}`);
                } catch (err) {
                    failed.push(`${role.name} (${err.message})`);
                }
            }

            if (granted.length === 0 && skipped.length === 0) {
                return interaction.reply({ content: `Failed to grant any roles:\n${failed.join('\n')}`, flags: MessageFlags.Ephemeral });
            }

            const summary = [
                `**Granted roles to ${targetUser.tag}:**`,
                granted.length ? `\n${granted.join('\n')}` : '',
                skipped.length ? `\n${skipped.join('\n')}` : '',
                failed.length ? `\n${failed.join('\n')}` : ''
            ].join('');

            return interaction.reply({ content: summary, flags: MessageFlags.Ephemeral });
        }


        if (sub === 'revoke') {
            const targetUser = options.getUser('user');
            const primary = options.getRole('role');
            const secondary = options.getRole('secondary_role');
            const tertiary = options.getRole('tertiary_role');

            const rolesToRevoke = [primary, secondary, tertiary].filter(r => r); // Filter out null
            const revoked = [];
            const skipped = [];
            const failed = [];

            const memberTarget = await guild.members.fetch(targetUser.id).catch(() => null);
            if (!memberTarget) return interaction.reply({ content: 'That user is not in this server.', flags: MessageFlags.Ephemeral });

            for (const role of rolesToRevoke) {
                if (!canManageRole(role)) {
                    failed.push(`${role.name} (above your role or mine)`);
                    continue;
                }

                if (!memberTarget.roles.cache.has(role.id)) {
                    skipped.push(`${role.name} (user doesn't have role)`);
                    continue;
                }

                try {
                    await memberTarget.roles.remove(role);
                    revoked.push(`${role.name}`);
                } catch (err) {
                    failed.push(`${role.name} (${err.message})`);
                }
            }

            if (revoked.length === 0 && skipped.length === 0) {
                return interaction.reply({ content: `Failed to revoke any roles:\n${failed.join('\n')}`, flags: MessageFlags.Ephemeral });
            }

            const summary = [
                `**Revoked roles from ${targetUser.tag}:**`,
                revoked.length ? `\n${revoked.join('\n')}` : '',
                skipped.length ? `\n${skipped.join('\n')}` : '',
                failed.length ? `\n${failed.join('\n')}` : ''
            ].join('');

            return interaction.reply({ content: summary, flags: MessageFlags.Ephemeral });
        }

    }
};
