const { SlashCommandBuilder, ChannelType, PermissionsBitField, ActionRowBuilder, StringSelectMenuBuilder, MessageFlags } = require('discord.js');
const ticket = require('../../schemas/tickets/tickets');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tickets')
        .setDescription('Manage tickets')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
        .addSubcommand(sub =>
        sub.setName('send')
            .setDescription('Send the ticket message')
            .addStringOption(option =>
                option.setName('name')
                    .setDescription('The name of the open select menu content')
                    .setRequired(true)
            )
            .addStringOption(option =>
                option.setName('message_id')
                    .setDescription('The id of the message you want to send')
                    .setRequired(true)
            )
        )
        .addSubcommand(sub =>
        sub.setName('setup')
            .setDescription('Setup the ticket category')
            .addChannelOption(option =>
            option.setName('category')
                .setDescription('The category to setup the ticket category in')
                .addChannelTypes(ChannelType.GuildCategory)
                .setRequired(true)
            )
            .addChannelOption(option =>
                option.setName('archive')
                    .setDescription('The archive channel to send ticket logs to')
                    .addChannelTypes(ChannelType.GuildText)
                    .setRequired(true)
            )
        )
        .addSubcommand(sub =>
        sub.setName('remove')
            .setDescription('Disable the ticket system')
        ),

    async execute(interaction) {
        const { options } = interaction;
        const sub = options.getSubcommand();
        const data = await ticket.findOne({ Guild: interaction.guild.id });


        switch (sub) {
            case 'send':
                if (!data) {
                    return interaction.reply({
                        content: 'The ticket system is not setup. Please use `/tickets setup` before sending a ticket message.',
                        flags: MessageFlags.Ephemeral
                    });
                }

                const name = options.getString('name');
                const messageId = options.getString('message_id');

                const select = new ActionRowBuilder()
                    .addComponents(
                        new StringSelectMenuBuilder()
                            .setCustomId('ticketsCreateSelect')
                            .setPlaceholder(`Create a ticket`)
                            .setMinValues(1)
                            .addOptions([
                                {
                                    label: `${name}`,
                                    description: 'Click to begin the ticket creation process',
                                    value: 'createTicket'
                                }
                            ])
                    );

                let content = 'Create a ticket to talk with the server staff team.';

                if (messageId) {
                    try {
                        const targetMsg = await interaction.channel.messages.fetch(messageId);
                        content = targetMsg.content || content;
                    } catch (err) {
                        console.error(err);
                        return interaction.reply({
                            content: `Could not find a message with ID \`${messageId}\` in this channel.`,
                            flags: MessageFlags.Ephemeral
                        });
                    }
                }

                const sent = await interaction.channel.send({
                    content,
                    components: [select]
                });

                await interaction.reply({
                    content: `Sent new ticket message: [jump to message](${sent.url})`,
                    flags: MessageFlags.Ephemeral
                });


                break;
            case 'remove':
                if (!data) return interaction.reply({ content: `It looks like you don't already have a ticket system setup.`, flags: MessageFlags.Ephemeral });
                else {
                    await ticket.deleteOne({ Guild: interaction.guild.id });
                    await interaction.reply({ content: `The ticket system has been deleted.`, flags: MessageFlags.Ephemeral });
                }

                break;
                case 'setup':
                    if (data) return interaction.reply({ content: `It looks like you already have a ticket system setup.`, flags: MessageFlags.Ephemeral });
                else {
                    const category = options.getChannel('category');
                    const archive = options.getChannel('archive');
                    await ticket.create({
                        Guild: interaction.guild.id,
                        Category: category.id,
                        Archive: archive.id,
                    });

                    await interaction.reply({ content: `Ticket category set to **${category}** and archive channel set to **${archive}**. `+
                            `Use /tickets send to send a ticket create message`, flags: MessageFlags.Ephemeral });
                }
        }
    }
}