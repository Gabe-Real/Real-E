const { Schema, model } = require('mongoose');

let tickets = new Schema({
    Guild: String,
    Category: String,
    Archive: String,
});

module.exports = model('Tickets', tickets);