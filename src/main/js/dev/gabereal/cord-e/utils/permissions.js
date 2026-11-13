const { PermissionFlagsBits } = require('discord.js');

/** Whether `member` can view and read the history of `channel` (checked against channel overwrites). */
function canReadChannel(member, channel) {
    return Boolean(
        channel.permissionsFor(member)?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory])
    );
}

/** Whether `member` can send messages in `channel`. */
function canSendInChannel(member, channel) {
    return Boolean(
        channel.permissionsFor(member)?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages])
    );
}

/**
 * Whether `member` may hand out / edit / delete `role`. Mirrors Discord's own rule for users:
 * the role must sit below the member's highest role (the guild owner is exempt).
 */
function memberOutranksRole(member, role) {
    if (member.guild.ownerId === member.id) return true;
    return role.position < member.roles.highest.position;
}

/**
 * Check whether `member` (a moderator) may act on `target`. Returns an error string, or null if allowed.
 * Checks both the moderator's and the bot's role hierarchy.
 */
function checkModerationHierarchy(moderator, target) {
    const guild = target.guild;
    if (target.id === guild.ownerId) return 'You can\'t do that to the server owner.';
    if (target.id === moderator.id) return 'You can\'t do that to yourself.';
    if (moderator.id !== guild.ownerId && target.roles.highest.position >= moderator.roles.highest.position) {
        return 'That user\'s highest role is equal to or above yours.';
    }
    if (target.roles.highest.position >= guild.members.me.roles.highest.position) {
        return 'That user\'s highest role is equal to or above mine, so I can\'t act on them.';
    }
    return null;
}

module.exports = { canReadChannel, canSendInChannel, memberOutranksRole, checkModerationHierarchy };
