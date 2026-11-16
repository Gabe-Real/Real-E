const mongoose = require('mongoose');

// One moderation action (warn, mute, kick, ban, ...) with a number that's unique within its server.
const caseSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    caseId: { type: Number, required: true },
    action: {
        type: String,
        required: true,
        enum: ['warn', 'clearwarns', 'mute', 'unmute', 'kick', 'ban', 'tempban', 'unban'],
    },
    userId: { type: String, required: true },
    userTag: String,
    moderatorId: { type: String, required: true },
    moderatorTag: String,
    reason: { type: String, default: 'No reason provided' },
    duration: String,    // e.g. "2d" for mutes and temp bans
    evidence: String,    // screenshot / proof link
    editedBy: String,    // last moderator to change the reason
}, { timestamps: true });

caseSchema.index({ guildId: 1, caseId: 1 }, { unique: true });
caseSchema.index({ guildId: 1, userId: 1, createdAt: -1 });

module.exports = mongoose.model('ModCase', caseSchema);
