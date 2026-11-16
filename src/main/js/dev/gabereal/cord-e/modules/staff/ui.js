// Shared bits for /reale replies (Components V2, Real-E style).
const { TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');

const text = (s) => new TextDisplayBuilder().setContent(s.slice(0, 4000));
const divider = () => new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);
const reply = (components, { ephemeral = true } = {}) => ({
    components,
    flags: MessageFlags.IsComponentsV2 | (ephemeral ? MessageFlags.Ephemeral : 0),
    allowedMentions: { parse: [] },
});
/** "## Title" + "-# sub" + optional body, as a private reply. */
const card = (title, sub, body) => reply([text(`## ${title}${sub ? `\n-# ${sub}` : ''}`), ...(body ? [divider(), text(body)] : [])]);
/** A private error/"fill this in" reply. Never posted publicly, even from commands that reply publicly. */
const oops = (title, sub) => ({ ...card(title, sub), private: true });
const pager = (prefix, page, pages) => new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`${prefix}:${page - 1}`).setEmoji('◀️').setStyle(ButtonStyle.Secondary).setDisabled(page <= 1),
    new ButtonBuilder().setCustomId(`${prefix}:noop:${page}`).setLabel(`Page ${page}/${pages}`).setStyle(ButtonStyle.Secondary).setDisabled(true),
    new ButtonBuilder().setCustomId(`${prefix}:${page + 1}`).setEmoji('▶️').setStyle(ButtonStyle.Secondary).setDisabled(page >= pages),
);
const ts = (date, style = 'R') => `<t:${Math.floor(new Date(date).getTime() / 1000)}:${style}>`;

module.exports = { text, divider, reply, card, oops, pager, ts };
