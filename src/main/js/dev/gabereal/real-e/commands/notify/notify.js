const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags, InteractionContextType } = require('discord.js');
const { text, divider, v2, notice } = require('../../utils/ui');
const NotifySubscription = require('../../schemas/notify/notifySubscription');
const { fetchFeed, resolveChannelId } = require('../../utils/youtube');
const { twitchConfigured, getUser, getLiveStreams } = require('../../utils/twitch');
const { sendAlert, DEFAULT_MESSAGES } = require('../../utils/notifyPoller');

const MAX_PER_SERVER = 25;
const ALERT_CHANNELS = [ChannelType.GuildText, ChannelType.GuildAnnouncement];
const PLATFORM_LABEL = { youtube: 'YouTube', twitch: 'Twitch' };

module.exports = {
    data: new SlashCommandBuilder()
        .setName('notify')
        .setDescription('YouTube upload and Twitch live alerts.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setContexts(InteractionContextType.Guild)
        .addSubcommand(sub =>
            sub.setName('add')
                .setDescription('Get alerts for a YouTube channel or Twitch streamer')
                .addStringOption(o =>
                    o.setName('platform').setDescription('Where they post').setRequired(true)
                        .addChoices({ name: 'YouTube', value: 'youtube' }, { name: 'Twitch', value: 'twitch' }))
                .addStringOption(o =>
                    o.setName('account').setDescription('YouTube @handle/link/channel ID, or Twitch username/link').setRequired(true).setMaxLength(200))
                .addChannelOption(o =>
                    o.setName('channel').setDescription('Where to post alerts (defaults to this channel)').addChannelTypes(...ALERT_CHANNELS))
                .addRoleOption(o =>
                    o.setName('role').setDescription('Role to ping'))
                .addStringOption(o =>
                    o.setName('message').setDescription('Custom message. Use {name} {title} {url}, plus {type} (YouTube) or {game} (Twitch)').setMaxLength(500)))
        .addSubcommand(sub =>
            sub.setName('remove')
                .setDescription('Stop alerts for an account')
                .addStringOption(o => o.setName('account').setDescription('The alert to remove').setRequired(true).setAutocomplete(true)))
        .addSubcommand(sub =>
            sub.setName('list')
                .setDescription('Show all alerts set up in this server'))
        .addSubcommand(sub =>
            sub.setName('test')
                .setDescription('Send a test alert so you can see what it looks like')
                .addStringOption(o => o.setName('account').setDescription('The alert to test').setRequired(true).setAutocomplete(true))),

    async autocomplete(interaction) {
        const typed = interaction.options.getFocused().toLowerCase();
        const subs = await NotifySubscription.find({ guildId: interaction.guildId }).sort({ sourceName: 1 });
        await interaction.respond(
            subs
                .filter(s => s.sourceName.toLowerCase().includes(typed))
                .slice(0, 25)
                .map(s => ({ name: `${PLATFORM_LABEL[s.platform]}: ${s.sourceName}`.slice(0, 100), value: s.id }))
        );
    },

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        // Looking accounts up can take a few seconds, longer than Discord's 3-second reply window.
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        if (sub === 'add') return add(interaction);
        if (sub === 'remove') return remove(interaction);
        if (sub === 'list') return list(interaction);
        if (sub === 'test') return test(interaction);
    }
};

async function add(interaction) {
    const platform = interaction.options.getString('platform');
    const account = interaction.options.getString('account');
    const channel = interaction.options.getChannel('channel') ?? interaction.channel;
    const role = interaction.options.getRole('role');
    const message = interaction.options.getString('message');

    if (!ALERT_CHANNELS.includes(channel.type)) {
        return interaction.editReply('Alerts can only be posted in a text or announcement channel.');
    }

    // The bot must be able to post there.
    const me = interaction.guild.members.me;
    if (!channel.permissionsFor(me)?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])) {
        return interaction.editReply(`I can't post in ${channel}. Give me View Channel, Send Messages and Embed Links there.`);
    }

    // Don't let this become a way to ping @everyone or locked roles without permission.
    const canMentionAll = channel.permissionsFor(interaction.member)?.has(PermissionFlagsBits.MentionEveryone);
    if (role && (role.id === interaction.guildId || !role.mentionable) && !canMentionAll) {
        return interaction.editReply(`You need the **Mention @everyone** permission to set alerts that ping ${role.id === interaction.guildId ? '@everyone' : role}.`);
    }

    const existing = await NotifySubscription.countDocuments({ guildId: interaction.guildId });

    let source;
    if (platform === 'youtube') {
        const channelId = await resolveChannelId(account);
        if (!channelId) {
            return interaction.editReply('I couldn\'t find that YouTube channel. Try the @handle (like `@Gabe_Real`), the channel link, or the channel ID (starts with `UC`).');
        }
        let feed;
        try {
            feed = await fetchFeed(channelId);
        } catch {
            return interaction.editReply('I found the channel but couldn\'t read its uploads. Try again in a minute.');
        }
        const newest = feed.videos[0];
        // Start from the latest upload so we don't announce old videos.
        source = { sourceId: channelId, sourceName: feed.name, lastItemId: newest?.id, lastPublishedAt: newest?.published ?? new Date() };
    } else {
        if (!twitchConfigured()) {
            return interaction.editReply('Twitch alerts aren\'t set up on this bot yet (the owner needs to add Twitch API keys).');
        }
        const user = await getUser(account).catch(() => null);
        if (!user) return interaction.editReply('I couldn\'t find that Twitch user. Check the username.');

        // If they're live right now, mark this stream as already announced.
        const live = await getLiveStreams([user.id]).catch(() => new Map());
        source = { sourceId: user.id, sourceName: user.name, sourceLogin: user.login, lastItemId: live.get(user.id)?.id };
    }

    const already = await NotifySubscription.findOne({ guildId: interaction.guildId, platform, sourceId: source.sourceId });
    if (!already && existing >= MAX_PER_SERVER) {
        return interaction.editReply(`This server already has the maximum of ${MAX_PER_SERVER} alerts. Remove one first.`);
    }

    const settings = {
        discordChannelId: channel.id,
        roleId: role?.id ?? null,
        message: message ?? null,
        sourceName: source.sourceName,
        sourceLogin: source.sourceLogin,
        createdBy: interaction.user.id,
    };

    if (already) {
        // Re-adding an account just updates where/how it alerts, without re-announcing anything.
        Object.assign(already, settings);
        await already.save();
    } else {
        await NotifySubscription.create({ guildId: interaction.guildId, platform, ...source, ...settings });
    }

    const what = platform === 'youtube' ? 'uploads (videos, Shorts and streams)' : 'goes live';
    return interaction.editReply(
        `${already ? 'Updated' : 'Done'}! I'll post in ${channel} whenever **${source.sourceName}** ${platform === 'youtube' ? 'posts new ' + what : what}` +
        `${role ? `, pinging ${role.id === interaction.guildId ? '@everyone' : role}` : ''}.\nUse \`/notify test\` to preview it.`
    );
}

async function remove(interaction) {
    const id = interaction.options.getString('account');
    const sub = await findForGuild(interaction, id);
    if (!sub) return interaction.editReply('I couldn\'t find that alert. Pick one from the list as you type.');

    await sub.deleteOne();
    return interaction.editReply(`Removed ${PLATFORM_LABEL[sub.platform]} alerts for **${sub.sourceName}**.`);
}

async function list(interaction) {
    const subs = await NotifySubscription.find({ guildId: interaction.guildId }).sort({ platform: 1, sourceName: 1 });
    if (!subs.length) {
        return interaction.editReply(notice('📭 No alerts set up yet', 'Add one with `/notify add`'));
    }

    const block = (platform, emoji) => {
        const lines = subs.filter(s => s.platform === platform).map(s => {
            const ping = !s.roleId ? '' : s.roleId === interaction.guildId ? ' · pings @everyone' : ` · pings <@&${s.roleId}>`;
            return `**${s.sourceName}** → <#${s.discordChannelId}>${ping}${s.message ? ' · custom message' : ''}`;
        });
        return lines.length ? text(`### ${emoji} ${PLATFORM_LABEL[platform]}\n${lines.join('\n')}`) : null;
    };

    return interaction.editReply(v2([
        text(`## 🔔 Alerts in ${interaction.guild.name}\n-# ${subs.length}/${MAX_PER_SERVER} used`),
        divider(),
        block('youtube', '📺'),
        block('twitch', '🟣'),
    ].filter(Boolean)));
}

async function test(interaction) {
    const sub = await findForGuild(interaction, interaction.options.getString('account'));
    if (!sub) return interaction.editReply('I couldn\'t find that alert. Pick one from the list as you type.');

    let values;
    if (sub.platform === 'youtube') {
        const feed = await fetchFeed(sub.sourceId).catch(() => null);
        const video = feed?.videos[0];
        values = {
            name: sub.sourceName,
            title: video?.title ?? 'Example video title',
            url: video?.url ?? `https://www.youtube.com/channel/${sub.sourceId}`,
            type: video?.type ?? 'video',
        };
    } else {
        values = { name: sub.sourceName, title: 'Example stream title', game: 'Just Chatting', url: `https://twitch.tv/${sub.sourceLogin ?? sub.sourceName}` };
    }

    // Test alerts never ping, so nobody gets woken up by a preview.
    const preview = { ...sub.toObject(), roleId: null, message: `🧪 **Test alert**\n${sub.message || DEFAULT_MESSAGES[sub.platform]}` };
    try {
        const sent = await sendAlert(interaction.client, preview, values);
        if (!sent) return interaction.editReply('The alert channel no longer exists. Re-add the alert with `/notify add`.');
        return interaction.editReply(`Sent a test alert to <#${sub.discordChannelId}> (without the role ping).`);
    } catch {
        return interaction.editReply(`I couldn't post in <#${sub.discordChannelId}>. Check my permissions there.`);
    }
}

/** Find a subscription by its ID, only within this server. */
async function findForGuild(interaction, id) {
    if (!/^[a-f0-9]{24}$/i.test(id)) return null;
    return NotifySubscription.findOne({ _id: id, guildId: interaction.guildId });
}
