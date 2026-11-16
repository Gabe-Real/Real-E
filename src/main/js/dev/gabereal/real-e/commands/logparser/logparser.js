const { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType, ChannelType } = require('discord.js');
const { getChannelIds, setChannel } = require('../../modules/logparser/settings');
const { handleUploadButton } = require('../../modules/logparser');
const { text, divider, v2, notice } = require('../../utils/ui');

const WATCHABLE = [ChannelType.GuildText, ChannelType.GuildForum, ChannelType.GuildAnnouncement, ChannelType.PublicThread];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('logparser')
        .setDescription('Minecraft log parser settings')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setContexts(InteractionContextType.Guild)
        .addSubcommandGroup(group =>
            group.setName('channel')
                .setDescription('Which channels get logs parsed automatically')
                .addSubcommand(sub =>
                    sub.setName('add')
                        .setDescription('Parse every log posted in a channel (forums: every post inside it)')
                        .addChannelOption(o => o.setName('channel').setDescription('Defaults to this channel').addChannelTypes(...WATCHABLE)))
                .addSubcommand(sub =>
                    sub.setName('remove')
                        .setDescription('Stop parsing logs in a channel')
                        .addChannelOption(o => o.setName('channel').setDescription('Defaults to this channel').addChannelTypes(...WATCHABLE)))
                .addSubcommand(sub =>
                    sub.setName('list')
                        .setDescription('Show which channels are watched'))),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const channel = interaction.options.getChannel('channel') ?? interaction.channel;

        if (sub === 'add' || sub === 'remove') {
            if (!WATCHABLE.includes(channel.type)) {
                return interaction.reply(notice('🚫 Can\'t watch that channel', 'Pick a text, announcement or forum channel', { ephemeral: true }));
            }
            await setChannel(interaction.guildId, channel.id, sub === 'add');
            return interaction.reply(sub === 'add'
                ? notice('🧾 Log parser on', `Logs posted in ${channel} will be checked automatically`, { ephemeral: true })
                : notice('🧾 Log parser off', `I'll stop checking logs in ${channel}`, { ephemeral: true }));
        }

        const ids = [...await getChannelIds(interaction.guildId)];
        if (!ids.length) {
            return interaction.reply(notice('🧾 No channels watched yet', 'Add one with `/logparser channel add`. Right-clicking a message → Apps → **Parse Minecraft Log** works anywhere', { ephemeral: true }));
        }
        return interaction.reply(v2([
            text(`## 🧾 Log parser channels\n-# ${ids.length} watched`),
            divider(),
            text(ids.map(id => `- <#${id}>`).join('\n')),
        ], { ephemeral: true }));
    },

    // "Upload to mclo.gs" buttons on log results (custom ID: logparser:upload:<id>).
    handleButton: handleUploadButton,
};
