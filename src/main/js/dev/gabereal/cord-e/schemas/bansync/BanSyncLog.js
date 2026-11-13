const { Schema, model } = require("mongoose");

const BanSyncLogSchema = new Schema({
    networkId: { type: String, required: true },
    bannedUserId: { type: String, required: true },
    reason: { type: String, default: "No reason provided" },
    originGuildId: { type: String, required: true },
    syncedTo: [{ type: String }],
    type: { type: String, enum: ["ban", "unban"], default: "ban" },
    timestamp: { type: Date, default: Date.now },
});

module.exports = model("BanSyncLog", BanSyncLogSchema);