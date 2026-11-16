const mongoose = require('mongoose');

// People who can use /reale. Devs aren't stored here: they come from BOT_OWNER_IDS in .env.
const staffSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    level: { type: String, enum: ['staff', 'management'], required: true },
    addedBy: String,
}, { timestamps: true });

// Every /reale action, for "View recent staff command logs".
const logSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    level: String,
    action: { type: String, required: true },
    details: String,
}, { timestamps: true });
logSchema.index({ createdAt: -1 });

// Servers that are never allowed to use Real-E (can't request it, and it leaves if added).
const bannedGuildSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    guildName: String,
    reason: String,
    bannedBy: String,
}, { timestamps: true });

// Global bot settings for staff tools.
const settingsSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true },   // always "global"
    logChannelId: String,                                  // where staff actions are posted
});

const model = (name, schema) => mongoose.models[name] ?? mongoose.model(name, schema);

module.exports = {
    BotStaff: model('BotStaff', staffSchema),
    StaffLog: model('StaffLog', logSchema),
    BannedGuild: model('BannedGuild', bannedGuildSchema),
    StaffSettings: model('StaffSettings', settingsSchema),
};
