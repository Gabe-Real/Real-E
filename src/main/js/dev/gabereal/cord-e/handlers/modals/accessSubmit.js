const { submitRequest } = require('../../modules/access');

// The "Request Real-E" form (from /request or the panel button).
module.exports = {
    customId: 'access:submit',
    execute: submitRequest,
};
