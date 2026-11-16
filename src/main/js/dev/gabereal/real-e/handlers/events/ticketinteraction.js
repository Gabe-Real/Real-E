const { ModalBuilder, TextInputBuilder, ActionRowBuilder, TextInputStyle, ChannelType, EmbedBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField, MessageFlags } = require('discord.js');
const ticket = require('../../schemas/tickets/tickets');
const { createTranscript } = require('discord-html-transcripts');

const TICKET_IDS = new Set(['ticketsCreateSelect', 'ticketModal', 'closeTicket', 'closeTicketModal', 'ticketTranscript']);

async function showCreateModal(interaction) {
    const modal = new ModalBuilder()
        .setTitle('Create your Ticket')
        .setCustomId('ticketModal');

    const why = new TextInputBuilder()
        .setCustomId('whyTicket')
        .setRequired(true)
        .setPlaceholder('What is the reason for creating this ticket?')
        .setLabel('Why are you creating this ticket?')
        .setMaxLength(900) // channel topics are capped at 1024 characters
        .setStyle(TextInputStyle.Paragraph);

    const info = new TextInputBuilder()
        .setCustomId('infoTicket')
        .setRequired(false)
        .setPlaceholder('Any additional information you would like to provide? (Leave blank if not needed)')
        .setLabel('Provide us with any additional information')
        .setMaxLength(3000) // keeps the embed description under 4096
        .setStyle(TextInputStyle.Paragraph);

    modal.addComponents(new ActionRowBuilder().addComponents(why), new ActionRowBuilder().addComponents(info));
    await interaction.showModal(modal);
}

async function createTicket(interaction) {
    const user = interaction.user;
    const data = await ticket.findOne({ Guild: interaction.guild.id });
    if (!data) return interaction.reply({ content: 'There is no ticket system set up for this server.', flags: MessageFlags.Ephemeral });

    const channelName = `ticket-${user.id}`;
    const existing = interaction.guild.channels.cache.find(c => c.name === channelName);
    if (existing) {
        return interaction.reply({ content: `You already have an open ticket: ${existing}`, flags: MessageFlags.Ephemeral });
    }

    const why = interaction.fields.getTextInputValue('whyTicket');
    const info = interaction.fields.getTextInputValue('infoTicket');
    // If the configured category was deleted, create the channel at the top level rather than failing.
    const category = interaction.guild.channels.cache.get(data.Category);

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const channel = await interaction.guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        topic: `Ticket user: ${user.username} | Ticket reason: ${why}`.slice(0, 1024),
        parent: category?.type === ChannelType.GuildCategory ? category.id : undefined,
        permissionOverwrites: [
            {
                id: interaction.guild.id,
                deny: [PermissionsBitField.Flags.ViewChannel]
            },
            {
                id: user.id,
                allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory]
            },
            {
                // Make sure the bot keeps access even if the category denies it.
                id: interaction.client.user.id,
                allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory]
            }
        ]
    });

    const embed = new EmbedBuilder()
        .setColor(0xe68675)
        .setTitle(`Ticket from ${user.id}`)
        .setDescription(`Ticket reason: ${why}\n\nAdditional information: ${info || 'None provided.'}`.slice(0, 4096))
        .setTimestamp();

    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('closeTicket')
                .setEmoji('🔐')
                .setLabel('Close Ticket')
                .setStyle(ButtonStyle.Danger),

            new ButtonBuilder()
                .setCustomId('ticketTranscript')
                .setEmoji('📜')
                .setLabel('Transcript')
                .setStyle(ButtonStyle.Primary)
        );

    await channel.send({ embeds: [embed], components: [buttons] });
    await interaction.editReply({ content: `Your ticket has been opened in ${channel}` });
}

async function showCloseModal(interaction) {
    const closeModal = new ModalBuilder()
        .setTitle('Close Ticket')
        .setCustomId('closeTicketModal');

    const reason = new TextInputBuilder()
        .setCustomId('closeReasonTicket')
        .setRequired(true)
        .setPlaceholder('Why are you closing this ticket?')
        .setLabel('Provide a closing reason')
        .setMaxLength(1500)
        .setStyle(TextInputStyle.Paragraph);

    closeModal.addComponents(new ActionRowBuilder().addComponents(reason));
    await interaction.showModal(closeModal);
}

async function closeTicket(interaction) {
    const channel = interaction.channel;
    if (!channel?.name?.startsWith('ticket-')) {
        return interaction.reply({ content: 'This isn\'t a ticket channel.', flags: MessageFlags.Ephemeral });
    }

    const userId = channel.name.replace('ticket-', '');
    const member = await interaction.guild.members.fetch(userId).catch(() => null);

    const data = await ticket.findOne({ Guild: interaction.guild.id });
    if (!data) return interaction.reply({ content: 'No ticket system is set up.', flags: MessageFlags.Ephemeral });

    const archive = interaction.guild.channels.cache.get(data.Archive);
    if (!archive) return interaction.reply({ content: 'Archive channel not found.', flags: MessageFlags.Ephemeral });

    const reason = interaction.fields.getTextInputValue('closeReasonTicket');
    await interaction.reply({ content: `🔐 Closing this ticket...` });

    const transcript = await createTranscript(channel, {
        limit: -1,
        returnBuffer: false,
        filename: `${channel.name}.html`
    });

    setTimeout(async () => {
        if (member) {
            await member.send({
                content: `💖 Your ticket, **${channel.name}**,  was closed by <@${interaction.user.id}> in **${interaction.guild.name}**\n\n` +
                    `**__Ticket closed for the following reason:__**\n${reason}`,
                files: [transcript]
            }).catch(() => {});
        }

        await archive.send({
            content: `💖 **${channel.name}** was closed by <@${interaction.user.id}>, created by ${member ? `<@${member.id}>` : `\`${userId}\` (left the server)`}\n\n` +
                `**__Ticket closed for the following reason:__**\n${reason}`,
            files: [transcript],
            allowedMentions: { parse: [] }
        }).catch(err => console.error('[tickets] Failed to archive transcript:', err.message));

        await channel.delete().catch(() => {});
    }, 5000);
}

async function sendTranscript(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const file = await createTranscript(interaction.channel, {
        limit: -1,
        returnBuffer: false,
        filename: `${interaction.channel.name}.html`
    });

    await interaction.editReply({ content: `🌍 Your transcript cache:`, files: [file] });
}

module.exports = {
    name: 'interactionCreate',
    async execute(interaction) {
        if (!interaction.customId || !TICKET_IDS.has(interaction.customId) || !interaction.inGuild()) return;

        try {
            switch (interaction.customId) {
                case 'ticketsCreateSelect': return await showCreateModal(interaction);
                case 'ticketModal': return await createTicket(interaction);
                case 'closeTicket': return await showCloseModal(interaction);
                case 'closeTicketModal': return await closeTicket(interaction);
                case 'ticketTranscript': return await sendTranscript(interaction);
            }
        } catch (err) {
            console.error(`[tickets] ${interaction.customId} failed:`, err);
            const payload = { content: 'Something went wrong with the ticket system. Please contact a staff member.', flags: MessageFlags.Ephemeral };
            try {
                if (interaction.replied || interaction.deferred) await interaction.followUp(payload);
                else await interaction.reply(payload);
            } catch {
                // interaction expired — nothing more we can do
            }
        }
    },
};
