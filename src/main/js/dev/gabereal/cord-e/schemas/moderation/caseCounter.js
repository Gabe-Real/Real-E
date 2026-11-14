const mongoose = require('mongoose');

// Hands out case numbers per server (1, 2, 3...). Increments atomically, so two mods
// acting at the same moment can never get the same number.
const caseCounterSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    seq: { type: Number, default: 0 },
});

module.exports = mongoose.model('ModCaseCounter', caseCounterSchema);
