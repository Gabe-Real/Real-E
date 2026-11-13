const { SlashCommandBuilder, PermissionFlagsBits, Colors, EmbedBuilder, ChannelType, MessageFlags, InteractionContextType } = require('discord.js');
const { canSendInChannel } = require('../../utils/permissions');

const POSTABLE_CHANNELS = [ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.PublicThread, ChannelType.PrivateThread, ChannelType.AnnouncementThread];

const styleColors = {
    info: Colors.Blurple,
    success: Colors.Green,
    warning: Colors.Yellow,
    error: Colors.Red,
    custom: Colors.White
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('post')
        .setDescription('Make the bot say something.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .setContexts(InteractionContextType.Guild)
        .addSubcommand(sub =>
        sub.setName('message')
            .setDescription('Post a message')
            .addChannelOption(option =>
                option.setName('channel')
                    .setDescription('The channel to post to')
                    .addChannelTypes(...POSTABLE_CHANNELS)
                    .setRequired(true)
            )
            .addStringOption(option =>
                option.setName('content')
                    .setDescription('The message content to post')
                    .setMaxLength(2000)
                    .setRequired(true)
            )
        )
        .addSubcommand(sub =>
        sub.setName('embed')
            .setDescription('Post an embed')
            .addChannelOption(option =>
                option.setName('channel')
                    .setDescription('The channel to post to (defaults to this channel)')
                    .addChannelTypes(...POSTABLE_CHANNELS)
            )
            .addStringOption(option =>
                option.setName('style')
                    .setDescription('Choose a style preset')
                    .addChoices(
                        { name: 'Info', value: 'info' },
                        { name: 'Success', value: 'success' },
                        { name: 'Warning', value: 'warning' },
                        { name: 'Error', value: 'error' },
                        { name: 'Custom', value: 'custom' }
                    )
            )
            .addStringOption(option =>
                option.setName('title').setDescription('Title of the embed').setMaxLength(256)
            )
            .addStringOption(option =>
                option.setName('description').setDescription('Description text').setMaxLength(4000)
            )
            .addStringOption(option =>
                option.setName('color').setDescription('Hex color (e.g., #3498db)').setMaxLength(7)
            )
            .addStringOption(option =>
                option.setName('thumbnail').setDescription('Thumbnail image URL')
            )
            .addStringOption(option =>
                option.setName('image').setDescription('Main image URL')
            )
            .addBooleanOption(option =>
                option.setName('timestamp').setDescription('Add a timestamp?')
            )
            .addStringOption(option =>
                option.setName('footer').setDescription('Footer text').setMaxLength(2048)
            )
        ),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const channel = interaction.options.getChannel('channel') ?? interaction.channel;

        // The command's default permission is checked guild-wide; make sure the moderator can
        // actually post in the *target* channel so this can't be used to bypass channel permissions.
        if (!canSendInChannel(interaction.member, channel)) {
            return interaction.reply({ content: 'You don\'t have permission to send messages in that channel.', flags: MessageFlags.Ephemeral });
        }

        if (sub === 'message') {
            const message = interaction.options.getString('content');

            await channel.send(message);
            await interaction.reply({ content: `Done!`, flags: MessageFlags.Ephemeral });

        } else if (sub === 'embed') {
            const style = interaction.options.getString('style') ?? 'info';
            const title = interaction.options.getString('title');
            const description = interaction.options.getString('description');
            const colorInput = interaction.options.getString('color');
            const thumbnail = interaction.options.getString('thumbnail');
            const image = interaction.options.getString('image');
            const timestamp = interaction.options.getBoolean('timestamp');
            const footer = interaction.options.getString('footer');

            if (!title && !description && !image && !thumbnail && !footer) {
                return interaction.reply({ content: 'An embed needs at least a title, description, image or footer.', flags: MessageFlags.Ephemeral });
            }

            let color = styleColors[style];
            if (colorInput) {
                if (!/^#?[0-9a-f]{6}$/i.test(colorInput)) {
                    return interaction.reply({ content: 'Invalid colour. Use a hex code like `#3498db`.', flags: MessageFlags.Ephemeral });
                }
                color = parseInt(colorInput.replace('#', ''), 16);
            }

            const embed = new EmbedBuilder().setColor(color);
            if (title) embed.setTitle(title);
            if (description) embed.setDescription(description);
            if (thumbnail) embed.setThumbnail(thumbnail);
            if (image) embed.setImage(image);
            if (timestamp) embed.setTimestamp();
            if (footer) embed.setFooter({ text: footer });

            await channel.send({ embeds: [embed] });
            await interaction.reply({ content: 'Done!', flags: MessageFlags.Ephemeral });
        }
    }
};
