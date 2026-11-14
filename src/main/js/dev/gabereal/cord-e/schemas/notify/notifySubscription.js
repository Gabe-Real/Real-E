const mongoose = require('mongoose');

// One YouTube channel or Twitch streamer that a server wants alerts for.
const notifySubscriptionSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    platform: { type: String, enum: ['youtube', 'twitch'], required: true },
    sourceId: { type: String, required: true },     // YouTube channel ID (UC...) or Twitch user ID
    sourceName: { type: String, required: true },   // Display name, for lists and messages
    sourceLogin: String,                            // Twitch login (used to build the stream URL)
    discordChannelId: { type: String, required: true },
    roleId: String,                                 // Role to ping (optional)
    message: String,                                // Custom message template (optional)
    lastItemId: String,                             // Last video ID / stream ID we announced
    lastPublishedAt: Date,                          // YouTube: publish time of the newest video we've seen
    createdBy: String,
}, { timestamps: true });

// One entry per account per server. Adding the same account again just updates its settings.
notifySubscriptionSchema.index({ guildId: 1, platform: 1, sourceId: 1 }, { unique: true });
notifySubscriptionSchema.index({ platform: 1, sourceId: 1 });

module.exports = mongoose.model('NotifySubscription', notifySubscriptionSchema);
