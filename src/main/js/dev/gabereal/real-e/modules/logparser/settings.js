const mongoose = require('mongoose');

// Which channels (and forum channels, for support forums) the log parser watches, per server.
const schema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    channelIds: { type: [String], default: [] },
});
const LogParserSettings = mongoose.models.LogParserSettings ?? mongoose.model('LogParserSettings', schema);

// Cache so we don't hit the database for every single message in every server.
const CACHE_MS = 60_000;
const cache = new Map(); // guildId -> { ids: Set, at }

async function getChannelIds(guildId) {
    const hit = cache.get(guildId);
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.ids;

    const doc = await LogParserSettings.findOne({ guildId }).lean();
    const ids = new Set(doc?.channelIds ?? []);
    cache.set(guildId, { ids, at: Date.now() });
    return ids;
}

async function setChannel(guildId, channelId, enabled) {
    const update = enabled ? { $addToSet: { channelIds: channelId } } : { $pull: { channelIds: channelId } };
    const doc = await LogParserSettings.findOneAndUpdate({ guildId }, update, { upsert: true, new: true });
    cache.delete(guildId);
    return doc.channelIds;
}

/** Is this message in a watched channel, or a thread/forum post inside one? */
async function isWatched(message) {
    if (!message.guildId) return false;
    const ids = await getChannelIds(message.guildId);
    if (!ids.size) return false;
    return ids.has(message.channelId) || (message.channel?.parentId && ids.has(message.channel.parentId));
}

module.exports = { getChannelIds, setChannel, isWatched };
