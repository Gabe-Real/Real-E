const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags, InteractionContextType } = require('discord.js');
const Tag = require('../../schemas/tags/tags');
const QuickPrefix = require('../../schemas/tags/quickTagsSchema');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tags')
        .setDescription('Manage or view tags')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .setContexts(InteractionContextType.Guild)
        .addSubcommand(cmd =>
            cmd.setName('create').setDescription('Create a new tag')
        )
        .addSubcommand(cmd =>
            cmd.setName('edit')
                .setDescription('Edit an existing tag')
                .addStringOption(opt =>
                    opt.setName('name')
                        .setDescription('Tag name to edit')
                        .setRequired(true)
                        .setAutocomplete(true)
                )
        )
        .addSubcommand(cmd =>
            cmd.setName('delete')
                .setDescription('Delete a tag')
                .addStringOption(opt =>
                    opt.setName('name')
                        .setDescription('Tag name to delete')
                        .setRequired(true)
                        .setAutocomplete(true)
                )
        )
        .addSubcommand(cmd =>
            cmd.setName('list')
                .setDescription('List all tags in this server')
        )
        .addSubcommand(cmd =>
            cmd.setName('show')
                .setDescription('Show a tag')
                .addStringOption(opt =>
                    opt.setName('name')
                        .setDescription('Tag name to display')
                        .setRequired(true)
                        .setAutocomplete(true)
                )
        )
        .addSubcommand(cmd =>
            cmd.setName('quick')
                .setDescription('Configure the quick tag prefix')
                .addStringOption(opt =>
                    opt.setName('prefix')
                        .setDescription('Prefix to trigger quick tags (e.g. ! or .)')
                        .setRequired(true)
                )
        ),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();

        if (sub === 'create') {
            const modal = new ModalBuilder()
                .setCustomId('tag:create')
                .setTitle('Create a Tag');

            const nameInput = new TextInputBuilder()
                .setCustomId('tag_name')
                .setLabel('Tag Name')
                .setStyle(TextInputStyle.Short)
                .setMaxLength(32) // keeps the edit modal's title (45) and custom ID (100) within Discord's limits
                .setRequired(true);

            const contentInput = new TextInputBuilder()
                .setCustomId('tag_content')
                .setLabel('Tag Content')
                .setStyle(TextInputStyle.Paragraph)
                .setMaxLength(2000) // a tag must fit in one message
                .setRequired(true);

            modal.addComponents(
                new ActionRowBuilder().addComponents(nameInput),
                new ActionRowBuilder().addComponents(contentInput)
            );

            return interaction.showModal(modal);
        }

        if (sub === 'quick') {
            const prefix = interaction.options.getString('prefix');
            const guildId = interaction.guild.id;

            if (prefix.length > 3) {
                return interaction.reply({ content: 'Prefix too long. Must be 3 characters or fewer.', flags: MessageFlags.Ephemeral });
            }

            await QuickPrefix.findOneAndUpdate(
                { guildId },
                { prefix },
                { upsert: true, new: true }
            );

            return interaction.reply({ content: `Quick tag prefix set to \`${prefix}\``, flags: MessageFlags.Ephemeral });
        }

        if (sub === 'edit') {
            const name = interaction.options.getString('name').toLowerCase();
            const tag = await Tag.findOne({ guildId: interaction.guild.id, name });

            if (!tag) {
                return interaction.reply({ content: `Tag \`${name}\` not found.`, flags: MessageFlags.Ephemeral });
            }

            const customId = `tag:edit:${name}`;
            if (customId.length > 100) {
                return interaction.reply({ content: 'That tag name is too long to edit. Delete and recreate it with a shorter name.', flags: MessageFlags.Ephemeral });
            }

            const modal = new ModalBuilder()
                .setCustomId(customId)
                .setTitle(`Edit Tag: ${name}`.slice(0, 45));

            const contentInput = new TextInputBuilder()
                .setCustomId('tag_content')
                .setLabel('New Tag Content')
                .setStyle(TextInputStyle.Paragraph)
                .setMaxLength(2000)
                .setRequired(true)
                .setValue(tag.content.slice(0, 2000));

            modal.addComponents(new ActionRowBuilder().addComponents(contentInput));
            return interaction.showModal(modal);
        }

        if (sub === 'delete') {
            const name = interaction.options.getString('name').toLowerCase();
            const result = await Tag.deleteOne({ guildId: interaction.guild.id, name });

            if (result.deletedCount === 0) {
                return interaction.reply({ content: `Tag \`${name}\` not found.`, flags: MessageFlags.Ephemeral });
            }

            return interaction.reply({ content: `🗑️ Tag \`${name}\` deleted.`, flags: MessageFlags.Ephemeral });
        }

        if (sub === 'list') {
            const tags = await Tag.find({ guildId: interaction.guild.id });

            if (!tags.length) {
                return interaction.reply({ content: '## 🍃 No tags in this server yet...\n\-\# lonely yes, very sad very, nono tag', flags: MessageFlags.Ephemeral });
            }

            const embed = new EmbedBuilder()
                .setTitle('🏷️ Tags')
                .setDescription(tags.map(t => `• \`${t.name}\``).join('\n').slice(0, 4096))
                .setFooter({ text: `${tags.length} total tag(s)` });

            return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }

        if (sub === 'show') {
            const name = interaction.options.getString('name').toLowerCase();
            const tag = await Tag.findOne({ guildId: interaction.guild.id, name });

            if (!tag) {
                return interaction.reply({ content: `Tag \`${name}\` not found.`, flags: MessageFlags.Ephemeral });
            }

            return interaction.reply({ content: tag.content.slice(0, 2000), allowedMentions: { parse: ['users'] } });
        }
    },

    async autocomplete(interaction) {
        const focused = interaction.options.getFocused();
        const guildId = interaction.guild.id;

        const tags = await Tag.find({ guildId }).select('name');

        const filtered = tags
            .filter(tag => tag.name.toLowerCase().includes(focused.toLowerCase()))
            .slice(0, 25)
            .map(tag => ({
                name: tag.name,
                value: tag.name,
            }));

        await interaction.respond(filtered);
    },
};
