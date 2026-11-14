// Small helpers for Components V2 messages, so every command has the same tidy look:
// a "## emoji Title" heading, grey "-#" subtext, dividers, and no old-style embeds.
const {
    TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, SectionBuilder, ThumbnailBuilder,
    MediaGalleryBuilder, MediaGalleryItemBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags,
} = require('discord.js');

/** A block of markdown text. */
const text = (content) => new TextDisplayBuilder().setContent(content);

/** A thin divider line. Pass true for extra space around it. */
const divider = (large = false) => new SeparatorBuilder()
    .setDivider(true)
    .setSpacing(large ? SeparatorSpacingSize.Large : SeparatorSpacingSize.Small);

/** Text with a small picture (e.g. an avatar) on the right. */
const section = (content, imageUrl) => new SectionBuilder()
    .addTextDisplayComponents(text(content))
    .setThumbnailAccessory(new ThumbnailBuilder().setURL(imageUrl));

/** One or more images shown full width. */
const gallery = (...urls) => new MediaGalleryBuilder()
    .addItems(...urls.map(url => new MediaGalleryItemBuilder().setURL(url)));

/** A row of buttons. Each: { id, label, emoji, style, disabled } or { url, label } for a link. */
const buttons = (...defs) => new ActionRowBuilder().addComponents(defs.map(d => {
    const b = new ButtonBuilder().setLabel(d.label);
    if (d.url) b.setStyle(ButtonStyle.Link).setURL(d.url);
    else b.setCustomId(d.id).setStyle(d.style ?? ButtonStyle.Secondary);
    if (d.emoji) b.setEmoji(d.emoji);
    if (d.disabled) b.setDisabled(true);
    return b;
}));

/** "## emoji Title" with optional grey subtext and body. */
const heading = (title, sub, body) => text(`## ${title}${sub ? `\n-# ${sub}` : ''}${body ? `\n${body}` : ''}`);

/**
 * Wrap components into a message payload. Mentions are off by default so a history or case
 * lookup can never ping anyone. Use `ephemeral: true` only on the first reply, not on edits.
 */
function v2(components, { ephemeral = false, allowedMentions = { parse: [] } } = {}) {
    let flags = MessageFlags.IsComponentsV2;
    if (ephemeral) flags |= MessageFlags.Ephemeral;
    return { components, flags, allowedMentions };
}

/** Quick one-block message: heading + optional subtext/body. */
const notice = (title, sub, options) => v2([heading(title, sub)], options);

module.exports = { text, divider, section, gallery, buttons, heading, v2, notice, ButtonStyle };
