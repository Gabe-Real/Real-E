const { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType, MessageFlags } = require('discord.js');
const { text, divider, section, gallery, v2 } = require('../../utils/ui');

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

// Pulls an image option and checks it's a picture Discord will accept. Returns { url } or { error }.
function getImage(interaction) {
    const file = interaction.options.getAttachment('image');
    if (!IMAGE_TYPES.includes(file.contentType?.split(';')[0])) {
        return { error: 'That needs to be a **PNG, JPG, GIF or WEBP** image' };
    }
    if (file.size > MAX_IMAGE_BYTES) {
        return { error: 'That image is too big, keep it under **8 MB**' };
    }
    return { url: file.url };
}

// Turns Discord's errors into something readable.
function explain(err) {
    if (err.status === 429 || /rate limit/i.test(err.message)) return 'Discord only lets bots change their profile a few times in a short space of time. Try again in a few minutes';
    if (err.code === 50013) return 'I\'m missing the **Change Nickname** permission in this server';
    if (err.code === 50035) return 'Discord didn\'t accept that. Images must be a valid picture, and bios can be up to 190 characters';
    return 'Something went wrong talking to Discord. Try again in a moment';
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('botprofile')
        .setDescription('Give the bot its own look in this server')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setContexts(InteractionContextType.Guild)
        .addSubcommand(sub =>
            sub.setName('avatar')
                .setDescription('Set the bot\'s profile picture for this server only')
                .addAttachmentOption(o => o.setName('image').setDescription('PNG, JPG, GIF or WEBP (GIFs animate)').setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('banner')
                .setDescription('Set the bot\'s profile banner for this server only')
                .addAttachmentOption(o => o.setName('image').setDescription('Ideally 680×240 or larger, same ratio').setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('bio')
                .setDescription('Set the bot\'s "About Me" for this server only')
                .addStringOption(o => o.setName('text').setDescription('Up to 190 characters').setMaxLength(190).setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('nickname')
                .setDescription('Set the bot\'s display name in this server')
                .addStringOption(o => o.setName('name').setDescription('Leave empty to go back to the normal name').setMaxLength(32)))
        .addSubcommand(sub =>
            sub.setName('reset')
                .setDescription('Go back to the bot\'s normal look in this server')
                .addStringOption(o => o.setName('what').setDescription('What to reset (default: everything)')
                    .addChoices(
                        { name: 'Everything', value: 'all' },
                        { name: 'Avatar', value: 'avatar' },
                        { name: 'Banner', value: 'banner' },
                        { name: 'Bio', value: 'bio' },
                        { name: 'Nickname', value: 'nick' },
                    )))
        .addSubcommand(sub =>
            sub.setName('view')
                .setDescription('See how the bot currently looks in this server')),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const guild = interaction.guild;

        if (sub === 'view') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            return interaction.editReply(await profileCard(guild, '👀 How I look here', 'Change it with `/botprofile`'));
        }

        let changes;
        let title;

        if (sub === 'avatar' || sub === 'banner') {
            const image = getImage(interaction);
            if (image.error) {
                return interaction.reply(v2([text(`## 🖼️ Can't use that\n-# ${image.error}`)], { ephemeral: true }));
            }
            changes = { [sub]: image.url };
            title = sub === 'avatar' ? '🖼️ Avatar updated' : '🎨 Banner updated';
        } else if (sub === 'bio') {
            changes = { bio: interaction.options.getString('text') };
            title = '📝 Bio updated';
        } else if (sub === 'nickname') {
            const name = interaction.options.getString('name');
            changes = { nick: name || null };
            title = name ? '🏷️ Nickname updated' : '🏷️ Nickname cleared';
        } else if (sub === 'reset') {
            const what = interaction.options.getString('what') ?? 'all';
            const all = { avatar: null, banner: null, bio: null, nick: null };
            changes = what === 'all' ? all : { [what]: null };
            title = what === 'all' ? '♻️ Back to normal' : `♻️ ${{ avatar: 'Avatar', banner: 'Banner', bio: 'Bio', nick: 'Nickname' }[what]} reset`;
        }

        // Uploading images can take a few seconds, longer than Discord's 3-second reply window.
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            await guild.members.editMe({ ...changes, reason: `/botprofile ${sub} by ${interaction.user.tag}` });
        } catch (err) {
            console.error('[botprofile]', err);
            return interaction.editReply(v2([text(`## ⚠️ Couldn't change that\n-# ${explain(err)}`)]));
        }

        return interaction.editReply(await profileCard(guild, title, `Only in **${guild.name}**. Everywhere else I look the same as normal`, changes.bio));
    },
};

/** Preview of the bot's look in this server: avatar, name, bio (if just set) and banner. */
async function profileCard(guild, title, sub, bio) {
    const me = await guild.members.fetchMe({ force: true });
    const custom = [
        me.avatar && 'avatar',
        me.banner && 'banner',
        me.nickname && 'nickname',
    ].filter(Boolean);

    const lines = [
        `**Name:** ${me.displayName}${me.nickname ? ' *(server nickname)*' : ''}`,
        bio ? `**Bio:** ${bio}` : null,
        `-# Custom here: ${custom.length ? custom.join(', ') : 'nothing yet, using the normal profile'}`,
    ].filter(Boolean).join('\n');

    const components = [
        section(`## ${title}\n-# ${sub}`, me.displayAvatarURL({ size: 256 })),
        divider(),
        text(lines),
    ];

    const banner = me.displayBannerURL?.({ size: 1024 }) ?? null;
    if (banner) components.push(gallery(banner));

    return v2(components);
}
