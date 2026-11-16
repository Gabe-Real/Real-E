// Every message and pop-up the access system shows, in Real-E's Components V2 style.
const {
    ActionRowBuilder, ButtonBuilder, ButtonStyle, SectionBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize,
    ModalBuilder, TextInputBuilder, TextInputStyle, LabelBuilder, StringSelectMenuBuilder, MessageFlags,
} = require('discord.js');
const { AccessRequest } = require('./schemas');

const PER_PAGE = 5;
const STATUS = {
    pending: { label: 'Pending', emoji: '🟨', description: 'Waiting for a decision.' },
    approved: { label: 'Approved', emoji: '🟩', description: 'Allowed. They get an invite link for their server.' },
    denied: { label: 'Denied', emoji: '🟥', description: 'Not allowed. They get your note (if any).' },
};

const text = (s) => new TextDisplayBuilder().setContent(s);
const divider = () => new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);
const v2 = (components, ephemeral = false) => ({
    components,
    flags: MessageFlags.IsComponentsV2 | (ephemeral ? MessageFlags.Ephemeral : 0),
    allowedMentions: { parse: [] },
});
const ts = (date) => `<t:${Math.floor(new Date(date).getTime() / 1000)}:R>`;

/** The owner's board: status tabs with counts, the requests with ✏️ buttons, paging. */
async function board(status = 'pending', page = 1) {
    const counts = Object.fromEntries(await Promise.all(Object.keys(STATUS).map(async s => [s, await AccessRequest.countDocuments({ status: s })])));
    const pages = Math.max(1, Math.ceil(counts[status] / PER_PAGE));
    page = Math.min(Math.max(1, page), pages);
    const requests = await AccessRequest.find({ status }).sort({ createdAt: status === 'pending' ? 1 : -1 }).skip((page - 1) * PER_PAGE).limit(PER_PAGE);

    const tabs = new ActionRowBuilder().addComponents(Object.entries(STATUS).map(([key, s]) =>
        new ButtonBuilder()
            .setCustomId(`requests:tab:${key}:1`)
            .setLabel(`${s.label} / ${counts[key]}`)
            .setEmoji(s.emoji)
            .setStyle(key === status ? ButtonStyle.Success : ButtonStyle.Secondary)));

    const components = [text('## 📨 Real-E requests'), tabs, divider()];

    if (!requests.length) {
        const empty = { pending: 'No one\'s waiting, all caught up', approved: 'You haven\'t approved anyone yet', denied: 'You haven\'t denied anyone yet' };
        components.push(text(`## 🍃 Nothing here\n-# ${empty[status]}`));
    } else {
        for (const r of requests) {
            const reason = r.reason?.length > 150 ? r.reason.slice(0, 147) + '...' : r.reason;
            const lines = [
                `${STATUS[r.status].emoji} **${r.guildName ?? 'Unknown server'}**${r.memberCount ? ` · ${r.memberCount.toLocaleString('en-GB')} members` : ''}`,
                `-# \`${r.requestId}\` · by <@${r.requesterId}>${r.role ? ` (${r.role})` : ''} · ${ts(r.createdAt)}`,
                reason ? `> ${reason.replace(/\n/g, '\n> ')}` : null,
                r.note ? `-# Note: ${r.note}` : null,
            ].filter(Boolean).join('\n');

            components.push(new SectionBuilder()
                .addTextDisplayComponents(text(lines))
                .setButtonAccessory(new ButtonBuilder().setCustomId(`requests:review:${r.requestId}`).setEmoji('✏️').setStyle(ButtonStyle.Secondary)));
        }
    }

    components.push(divider());
    const footer = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`requests:tab:${status}:${page - 1}`).setEmoji('◀️').setStyle(ButtonStyle.Secondary).setDisabled(page <= 1),
        new ButtonBuilder().setCustomId(`requests:page:${page}`).setLabel(`Page ${page}/${pages}`).setStyle(ButtonStyle.Secondary).setDisabled(true),
        new ButtonBuilder().setCustomId(`requests:tab:${status}:${page + 1}`).setEmoji('▶️').setStyle(ButtonStyle.Secondary).setDisabled(page >= pages),
        new ButtonBuilder().setCustomId('requests:allowlist').setLabel('Allowed servers').setEmoji('🗂️').setStyle(ButtonStyle.Secondary),
    );
    components.push(footer);
    return components;
}

/** The pop-up people fill in to ask for Real-E. */
function requestModal() {
    return new ModalBuilder()
        .setCustomId('access:submit')
        .setTitle('Request Real-E')
        .addTextDisplayComponents(text('Real-E is a private bot. Tell me a bit about your server and I\'ll get back to you by DM, so make sure your DMs are open.'))
        .addLabelComponents(
            new LabelBuilder()
                .setLabel('Server invite link')
                .setDescription('A permanent invite to the server you want Real-E in')
                .setTextInputComponent(new TextInputBuilder().setCustomId('invite').setStyle(TextInputStyle.Short).setPlaceholder('https://discord.gg/...').setMaxLength(100).setRequired(true)),
            new LabelBuilder()
                .setLabel('Your role there')
                .setStringSelectMenuComponent(new StringSelectMenuBuilder().setCustomId('role').setPlaceholder('Pick one...').addOptions(
                    { label: 'Owner', value: 'Owner', emoji: '👑' },
                    { label: 'Admin', value: 'Admin', emoji: '🛡️' },
                    { label: 'Moderator', value: 'Moderator', emoji: '🔨' },
                    { label: 'Member', value: 'Member', emoji: '👤', description: 'You\'ll need an admin to add the bot' },
                )),
            new LabelBuilder()
                .setLabel('Why do you want Real-E?')
                .setTextInputComponent(new TextInputBuilder().setCustomId('reason').setStyle(TextInputStyle.Paragraph).setPlaceholder('What would you use it for?').setMinLength(10).setMaxLength(500).setRequired(true)),
        );
}

function noteInput(note) {
    const input = new TextInputBuilder().setCustomId('note').setStyle(TextInputStyle.Paragraph).setMaxLength(300).setRequired(false);
    if (note) input.setValue(note);
    return input;
}

/** The ✏️ pop-up: change a request's status and leave a note for the requester. */
function reviewModal(request) {
    return new ModalBuilder()
        .setCustomId(`access:review:${request.requestId}`)
        .setTitle(`Review: ${(request.guildName ?? 'request').slice(0, 36)}`)
        .addTextDisplayComponents(text(
            `**${request.guildName}**${request.memberCount ? ` · ${request.memberCount.toLocaleString('en-GB')} members` : ''}\n` +
            `-# Requested by <@${request.requesterId}>${request.role ? ` (${request.role})` : ''}\n> ${(request.reason ?? '').slice(0, 300)}`))
        .addLabelComponents(
            new LabelBuilder()
                .setLabel('Status')
                .setStringSelectMenuComponent(new StringSelectMenuBuilder().setCustomId('status').addOptions(
                    Object.entries(STATUS).map(([value, s]) => ({ label: s.label, value, emoji: s.emoji, description: s.description, default: value === request.status })))),
            new LabelBuilder()
                .setLabel('Note to them (optional)')
                .setDescription('Sent with the approval or denial')
                .setTextInputComponent(noteInput(request.note)),
        );
}

/** Public panel with a button, for posting in your server. */
function panel() {
    return v2([
        text('## 📨 Want Real-E in your server?\nReal-E is a private bot, only in a few partnered servers for now.\nPress the button to send a request, and you\'ll get a DM once it\'s been looked at.\n-# Make sure your DMs are open so you get the reply'),
        new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('requests:new').setLabel('Request Real-E').setEmoji('📨').setStyle(ButtonStyle.Primary)),
    ]);
}

module.exports = { board, requestModal, reviewModal, panel, text, divider, v2, ts, STATUS };
