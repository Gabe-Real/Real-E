const { MessageFlags, TextDisplayBuilder } = require('discord.js');
const roles = require('../../modules/staff/roles');
const { logAction } = require('../../modules/staff/logs');
const { card } = require('../../modules/staff/ui');

// The announcement pop-up from /reale management action: announce.
module.exports = {
    customId: 'staff:announce',

    async execute(interaction) {
        if (!(await roles.has(interaction.user.id, 'management'))) return interaction.reply(card('🔒 Management only'));

        const channel = interaction.fields.getSelectedChannels('channel')?.first();
        const title = interaction.fields.getTextInputValue('title').trim();
        const body = interaction.fields.getTextInputValue('body').trim();
        const role = interaction.fields.getSelectedRoles('ping')?.first() ?? null;

        const target = channel && await interaction.client.channels.fetch(channel.id).catch(() => null);
        if (!target?.isSendable?.()) return interaction.reply(card('🚫 Can\'t post there', 'Give Real-E permission to send messages in that channel'));

        const ping = !role ? '' : role.id === interaction.guildId ? '@everyone\n' : `<@&${role.id}>\n`;
        await target.send({
            components: [new TextDisplayBuilder().setContent(`${ping}## ${title}\n${body}\n-# ${interaction.user.username} · Real-E team`.slice(0, 4000))],
            flags: MessageFlags.IsComponentsV2,
            allowedMentions: role ? (role.id === interaction.guildId ? { parse: ['everyone'] } : { roles: [role.id] }) : { parse: [] },
        });

        await logAction(interaction.client, { userId: interaction.user.id, level: 'management', action: 'announcement sent', details: `#${target.name}: ${title}` });
        return interaction.reply(card('📝 Announcement posted', `In <#${target.id}>`));
    },
};
