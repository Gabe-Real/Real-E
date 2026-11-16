const { reviewRequest } = require('../../modules/access');

// The ✏️ review form on the /requests board. Custom ID: access:review:<requestId>
module.exports = {
    customId: 'access:review',
    execute: reviewRequest,
};
