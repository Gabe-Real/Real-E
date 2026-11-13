const { SlashCommandBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const ModlogConfig = require('../../schemas/logging/modlogs');
const MsglogConfig = require('../../schemas/logging/msglogs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('logs')
        .setDescription('Log configuration')
        .addSubcommand(sub =>
            sub.setName('modlogs')
                .setDescription('Set the channel for mod action logs')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('The channel to send mod logs to')
                        .setRequired(true)
                        .addChannelTypes(ChannelType.GuildText)
                )
        )
        .addSubcommand(sub =>
            sub.setName('msglogs')
                .setDescription('Set the channel for message edit/delete logs')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('The channel to send message logs to')
                        .setRequired(true)
                        .addChannelTypes(ChannelType.GuildText)
                )
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const channel = interaction.options.getChannel('channel');

        if (sub === 'modlogs') {
            await ModlogConfig.findOneAndUpdate(
                { guildId: interaction.guild.id },
                { modlogChannelId: channel.id },
                { upsert: true }
            );

            return interaction.reply(`Modlogs will now be sent to ${channel}.`);
        }

        if (sub === 'msglogs') {
            await MsglogConfig.findOneAndUpdate(
                { guildId: interaction.guild.id },
                { msglogChannelId: channel.id },
                { upsert: true }
            );
            return interaction.reply(`Message logs will now be sent to ${channel}.`);
        }
    }
};
