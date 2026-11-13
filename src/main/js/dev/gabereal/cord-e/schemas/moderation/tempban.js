const mongoose = require('mongoose');

const tempBanSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    userId: { type: String, required: true },
    userTag: String,
    moderatorId: String,
    unbanAt: { type: Date, required: true, index: true },
});

tempBanSchema.index({ guildId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('TempBan', tempBanSchema);
