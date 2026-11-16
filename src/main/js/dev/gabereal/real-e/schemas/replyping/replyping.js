const mongoose = require('mongoose');

const replypingSchema = new mongoose.Schema({
    guildId: {
        type: String,
        required: true,
        unique: true
    },
    protectedUsers: [{
        userId: {
            type: String,
            required: true
        },
        timeout: {
            type: Number,
            default: 10 * 60 * 1000
        }
    }],
    exemptRoles: [{
        type: String
    }],
    exemptChannels: [{
        type: String
    }]
});

module.exports = mongoose.model('AntiReply', replypingSchema);