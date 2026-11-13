const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, MessageFlags, InteractionContextType } = require('discord.js');
const ReactionRole = require('../../schemas/reactionroles/reactionroles');
const { memberOutranksRole, canSendInChannel } = require('../../utils/permissions');

const STYLES = {
    primary: ButtonStyle.Primary,
    secondary: ButtonStyle.Secondary,
    success: ButtonStyle.Success,
    danger: ButtonStyle.Danger,
};
const MAX_BUTTONS = 25; // 5 rows x 5 buttons

/** Validates the parsed JSON. Returns { entries } or { error }. */
function validateEntries(parsed, interaction) {
    if (!Array.isArray(parsed) || parsed.length === 0) {
        return { error: 'The JSON must be a non-empty array of roles. See `/reactionroles how-to`.' };
    }
    if (parsed.length > MAX_BUTTONS) {
        return { error: `You can have at most ${MAX_BUTTONS} roles per message.` };
    }

    const { guild, member } = interaction;
    const entries = [];
    for (const [i, entry] of parsed.entries()) {
        const where = `Entry ${i + 1}`;
        if (typeof entry !== 'object' || entry === null) return { error: `${where} is not an object.` };

        const label = typeof entry.label === 'string' ? entry.label.trim() : '';
        if (!label || label.length > 80) return { error: `${where}: \`label\` is required and must be 80 characters or fewer.` };

        const role = guild.roles.cache.get(String(entry.roleId));
        if (!role) return { error: `${where}: no role with ID \`${entry.roleId}\` exists in this server.` };
        if (role.id === guild.id || role.managed) return { error: `${where}: **${role.name}** can't be self-assigned.` };
        // Without these checks anyone with Manage Roles could create a button for a role above their own
        // (e.g. an admin role) and click it to grant it to themselves.
        if (!memberOutranksRole(member, role)) return { error: `${where}: **${role.name}** is above your highest role.` };
        if (!role.editable) return { error: `${where}: **${role.name}** is above my highest role, so I can't assign it.` };

        entries.push({
            label,
            roleId: role.id,
            emoji: typeof entry.emoji === 'string' && entry.emoji.trim() ? entry.emoji.trim() : undefined,
            style: typeof entry.style === 'string' && STYLES[entry.style.toLowerCase()] ? entry.style.toLowerCase() : 'secondary',
        });
    }
    return { entries };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('reactionroles')
        .setDescription('Manage reaction role messages')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        .setContexts(InteractionContextType.Guild)
        .addSubcommand(sub =>
            sub.setName('create')
                .setDescription('Create a reaction role message')
                .addChannelOption(opt => opt.setName('channel').setDescription('Target channel').setRequired(true)
                    .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
                .addStringOption(opt => opt.setName('title').setDescription('Title of the message').setRequired(true).setMaxLength(1900))
                .addStringOption(opt => opt.setName('json').setDescription('JSON of roles/buttons').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('delete')
                .setDescription('Delete a reaction role message')
                .addStringOption(opt => opt.setName('message_id').setDescription('Message ID to delete').setRequired(true))
        )
        .addSubcommand(sub =>
        sub.setName('how-to')
            .setDescription('How to reaction roles')),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();

        if (sub === 'create') {
            const channel = interaction.options.getChannel('channel');
            const title = interaction.options.getString('title');
            const json = interaction.options.getString('json');

            if (!canSendInChannel(interaction.member, channel)) {
                return interaction.reply({ content: 'You can\'t send messages in that channel.', flags: MessageFlags.Ephemeral });
            }

            let parsed;
            try {
                parsed = JSON.parse(json);
            } catch {
                return interaction.reply({ content: 'Invalid JSON format.', flags: MessageFlags.Ephemeral });
            }

            const { entries, error } = validateEntries(parsed, interaction);
            if (error) return interaction.reply({ content: error, flags: MessageFlags.Ephemeral });

            const buttons = entries.map(role => {
                const button = new ButtonBuilder()
                    .setCustomId(`rr:${role.roleId}`)
                    .setLabel(role.label)
                    .setStyle(STYLES[role.style]);
                if (role.emoji) button.setEmoji(role.emoji);
                return button;
            });

            const rows = [];
            for (let i = 0; i < buttons.length; i += 5) {
                rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)));
            }

            let msg;
            try {
                msg = await channel.send({ content: `**${title}**`, components: rows, allowedMentions: { parse: [] } });
            } catch (err) {
                // Most commonly an invalid emoji (e.g. a :shortcode: instead of the actual emoji character).
                return interaction.reply({ content: `Discord rejected the message: ${err.message}`, flags: MessageFlags.Ephemeral });
            }

            await ReactionRole.create({
                guildId: interaction.guild.id,
                messageId: msg.id,
                channelId: channel.id,
                roles: entries
            });

            return interaction.reply({ content: 'Reaction role message created.', flags: MessageFlags.Ephemeral });
        }

        if (sub === 'delete') {
            const messageId = interaction.options.getString('message_id');
            const data = await ReactionRole.findOne({ guildId: interaction.guild.id, messageId });

            if (!data) return interaction.reply({ content: 'Message not found in the database.', flags: MessageFlags.Ephemeral });

            try {
                const ch = await interaction.guild.channels.fetch(data.channelId);
                const msg = await ch.messages.fetch(data.messageId);
                await msg.delete();
            } catch {
                // Message or channel already gone — still remove the DB record below.
            }

            await data.deleteOne();
            return interaction.reply({ content: 'Reaction role message deleted.', flags: MessageFlags.Ephemeral });
        }

        if (sub === 'how-to') {
            return interaction.reply({ content: '## How to use reaction roles\n' +
                    'Here is an example of a correct JSON file that **would** work\n' +
                    '```json\n[\n' +
                    '  { "label": "Java", "roleId": "123456789012345678", "emoji": "☕", "style": "success" },\n' +
                    '  { "label": "Python", "roleId": "987654321098765432", "emoji": "🐍", "style": "primary" }\n' +
                    ']```\n' +
                    '**label**: Anything you like (max 80 characters), this will display as the text on the button.\n' +
                    '**roleId**: The ID of the role to give. The role must be below both your highest role and the bot\'s highest role.\n' +
                    '**emoji** (optional): The actual emoji character (e.g. `☕`) or a custom emoji (`<:name:id>`). `:shortcodes:` do not work.\n' +
                    '**style** (optional): `primary`, `secondary`, `success` or `danger`. Defaults to `secondary`.\n' +
                    'You can have up to 25 roles per message.', flags: MessageFlags.Ephemeral });
        }
    }
};
