const { SlashCommandBuilder, InteractionContextType } = require('discord.js');
const access = require('../../modules/access');
const { views, isOwner, allowlistView } = access;
const { text, v2 } = views;

const ownerOnly = (interaction) => interaction.reply(v2([text('## 🔒 Owner only\n-# Only Real-E\'s owner can manage access requests')], true));

module.exports = {
    data: new SlashCommandBuilder()
        .setName('requests')
        .setDescription('Manage who can use Real-E (owner only)')
        .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM)
        .addSubcommand(sub => sub.setName('board').setDescription('Review access requests'))
        .addSubcommand(sub => sub.setName('panel').setDescription('Post a "Request Real-E" button in this channel'))
        .addSubcommand(sub => sub.setName('allowlist').setDescription('Servers Real-E is allowed in'))
        .addSubcommand(sub =>
            sub.setName('allow')
                .setDescription('Allow a server without a request (e.g. a partner)')
                .addStringOption(o => o.setName('server_id').setDescription('The server\'s ID').setRequired(true).setMinLength(17).setMaxLength(20)))
        .addSubcommand(sub =>
            sub.setName('revoke')
                .setDescription('Remove a server\'s access (Real-E leaves it)')
                .addStringOption(o => o.setName('server').setDescription('Start typing a server name').setRequired(true).setAutocomplete(true))),

    async execute(interaction) {
        if (!isOwner(interaction.user.id)) return ownerOnly(interaction);
        const sub = interaction.options.getSubcommand();

        if (sub === 'board') return interaction.reply(v2(await views.board('pending', 1), true));

        if (sub === 'panel') {
            if (!interaction.channel?.isSendable?.()) return interaction.reply(v2([text('## 🚫 I can\'t post here')], true));
            await interaction.channel.send(views.panel());
            return interaction.reply(v2([text('## 📨 Panel posted\n-# Anyone can press the button to send a request')], true));
        }

        if (sub === 'allowlist') return interaction.reply(v2(await allowlistView(interaction.client), true));

        if (sub === 'allow') {
            const id = interaction.options.getString('server_id').trim();
            if (!/^\d{17,20}$/.test(id)) return interaction.reply(v2([text('## 🔢 That isn\'t a server ID\n-# Right-click the server icon → Copy Server ID (needs Developer Mode)')], true));
            const name = interaction.client.guilds.cache.get(id)?.name ?? null;
            await access.allow(id, name, interaction.user.id, 'manual');
            return interaction.reply(v2([text(`## ✅ Server allowed\n-# ${name ? `**${name}**` : `\`${id}\``} can now use Real-E`)], true));
        }

        if (sub === 'revoke') {
            const id = interaction.options.getString('server');
            const name = await access.revoke(interaction.client, id);
            return interaction.reply(v2([text(`## 🚪 Access removed\n-# ${name ? `Left **${name}**` : `\`${id}\` is no longer allowed`}`)], true));
        }
    },

    // Server picker for /requests revoke: allowed servers + servers Real-E is in.
    async autocomplete(interaction) {
        if (!isOwner(interaction.user.id)) return interaction.respond([]);
        const typed = interaction.options.getFocused().toLowerCase();
        const guilds = [...interaction.client.guilds.cache.values()];
        await interaction.respond(guilds
            .filter(g => g.name.toLowerCase().includes(typed) || g.id.startsWith(typed))
            .slice(0, 25)
            .map(g => ({ name: `${g.name} (${g.memberCount} members)`.slice(0, 100), value: g.id })));
    },

    /**
     * Buttons:
     *   requests:new                  "Request Real-E" panel button (anyone)
     *   requests:open                 open the board (from the owner's DM notification)
     *   requests:tab:<status>:<page>  switch tab / page
     *   requests:review:<id>          ✏️ on a request
     *   requests:allowlist            allowed servers
     */
    async handleButton(interaction) {
        const [, action, a, b] = interaction.customId.split(':');

        if (action === 'new') return interaction.showModal(views.requestModal());
        if (!isOwner(interaction.user.id)) return ownerOnly(interaction);

        if (action === 'open') return interaction.reply(v2(await views.board('pending', 1), true));
        if (action === 'tab') return interaction.update(v2(await views.board(a, Number(b))));
        if (action === 'allowlist') return interaction.reply(v2(await allowlistView(interaction.client), true));

        if (action === 'review') {
            const { AccessRequest } = require('../../modules/access/schemas');
            const request = await AccessRequest.findOne({ requestId: a });
            if (!request) return interaction.reply(v2([text('## 🔍 Request not found')], true));
            return interaction.showModal(views.reviewModal(request));
        }
    },
};
