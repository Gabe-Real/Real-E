const { Schema, model } = require("mongoose");

const BanSyncNetworkSchema = new Schema({
    networkId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    guilds: [
        {
            guildId: { type: String, required: true },
            logChannelId: { type: String, default: null },
        },
    ],
    createdAt: { type: Date, default: Date.now },
});

module.exports = model("BanSyncNetwork", BanSyncNetworkSchema);