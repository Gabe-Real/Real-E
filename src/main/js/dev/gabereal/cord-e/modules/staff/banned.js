const { BannedGuild } = require('./schemas');

// In-memory copy so the join check is instant.
const banned = new Set();
let loaded = false;

async function load() {
    banned.clear();
    for (const b of await BannedGuild.find({}, { guildId: 1 }).lean()) banned.add(b.guildId);
    loaded = true;
}

async function isBanned(guildId) {
    if (!loaded) await load().catch(() => {});
    return banned.has(guildId);
}

async function ban(guildId, guildName, reason, bannedBy) {
    await BannedGuild.findOneAndUpdate({ guildId }, { guildId, guildName, reason, bannedBy }, { upsert: true });
    banned.add(guildId);
}

async function unban(guildId) {
    const result = await BannedGuild.deleteOne({ guildId });
    banned.delete(guildId);
    return result.deletedCount > 0;
}

const list = () => BannedGuild.find().sort({ createdAt: -1 }).lean();

module.exports = { isBanned, ban, unban, list, load };
