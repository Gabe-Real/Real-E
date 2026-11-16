const mongoose = require('mongoose');

// A server asking to use Real-E.
const requestSchema = new mongoose.Schema({
    requestId: { type: String, required: true, unique: true },   // short code shown on the board, e.g. "a3f9c2"
    requesterId: { type: String, required: true },
    guildId: { type: String, required: true },                     // the server they want Real-E in (from their invite)
    guildName: String,
    memberCount: Number,
    inviteCode: String,
    role: String,                                                   // owner / admin / moderator
    reason: String,
    status: { type: String, enum: ['pending', 'approved', 'denied'], default: 'pending' },
    note: String,                                                   // your message back to them
    decidedBy: String,
    decidedAt: Date,
}, { timestamps: true });
requestSchema.index({ status: 1, createdAt: -1 });
requestSchema.index({ guildId: 1 });

// Servers Real-E is allowed to be in. Anything else gets left automatically.
const allowedSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    guildName: String,
    addedBy: String,
    source: { type: String, enum: ['existing', 'request', 'manual'], default: 'manual' },
}, { timestamps: true });

module.exports = {
    AccessRequest: mongoose.models.AccessRequest ?? mongoose.model('AccessRequest', requestSchema),
    AllowedGuild: mongoose.models.AllowedGuild ?? mongoose.model('AllowedGuild', allowedSchema),
};
