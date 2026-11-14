const ModCase = require('../schemas/moderation/case');
const CaseCounter = require('../schemas/moderation/caseCounter');

// How each action is shown in /case and /history.
const ACTIONS = {
    warn:       { emoji: '⚠️', label: 'Warn', one: 'warn', many: 'warns' },
    clearwarns: { emoji: '🧹', label: 'Warnings cleared', one: 'warning clear', many: 'warning clears' },
    mute:       { emoji: '🔕', label: 'Mute', one: 'mute', many: 'mutes' },
    unmute:     { emoji: '🔔', label: 'Unmute', one: 'unmute', many: 'unmutes' },
    kick:       { emoji: '👢', label: 'Kick', one: 'kick', many: 'kicks' },
    ban:        { emoji: '📛', label: 'Ban', one: 'ban', many: 'bans' },
    tempban:    { emoji: '⏳', label: 'Temp ban', one: 'temp ban', many: 'temp bans' },
    unban:      { emoji: '🔓', label: 'Unban', one: 'unban', many: 'unbans' },
};

/**
 * Record a moderation action as a numbered case. Best-effort: returns the case, or null if saving
 * failed, so a database hiccup never stops the actual ban/kick/etc. from happening.
 */
async function createCase({ guild, action, user, moderator, reason, duration, evidence }) {
    try {
        const counter = await CaseCounter.findOneAndUpdate(
            { guildId: guild.id },
            { $inc: { seq: 1 } },
            { upsert: true, new: true }
        );

        return await ModCase.create({
            guildId: guild.id,
            caseId: counter.seq,
            action,
            userId: user.id,
            userTag: user.tag ?? user.username,
            moderatorId: moderator.id,
            moderatorTag: moderator.tag ?? moderator.username,
            reason: reason || 'No reason provided',
            duration,
            evidence,
        });
    } catch (err) {
        console.error(`[cases] Failed to record ${action} case in ${guild.id}:`, err.message);
        return null;
    }
}

/** "Case #12" for modlog footers and replies, or an empty string if the case wasn't saved. */
function caseLabel(modCase) {
    return modCase ? `Case #${modCase.caseId}` : '';
}

/** One-line summary of a case, used in /history. */
function formatCaseLine(modCase) {
    const { emoji, label } = ACTIONS[modCase.action] ?? { emoji: '•', label: modCase.action };
    const when = `<t:${Math.floor(modCase.createdAt.getTime() / 1000)}:R>`;
    const duration = modCase.duration ? ` (${modCase.duration})` : '';
    const reason = modCase.reason.length > 80 ? `${modCase.reason.slice(0, 77)}...` : modCase.reason;
    return `\`#${modCase.caseId}\` ${emoji} **${label}${duration}** · ${when} · by <@${modCase.moderatorId}>\n> ${reason}`;
}

module.exports = { ACTIONS, createCase, caseLabel, formatCaseLine };
