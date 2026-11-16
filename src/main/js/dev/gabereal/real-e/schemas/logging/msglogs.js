const mongoose = require('mongoose');

const msglogSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    msglogChannelId: { type: String, required: true }
});

module.exports = mongoose.model('MsgLogConfig', msglogSchema);
