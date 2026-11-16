const { Order } = require('../constants');
const { fetchText } = require('./http');

// Files attached directly to the message: latest.log, crash-....txt, debug.log, .log.gz etc.
const EXTENSIONS = /\.(log|txt|log\.gz)$/i;

module.exports = {
    id: 'message-attachment',
    order: Order.Earlier,

    /** Returns [{ content, source }] for every log-looking attachment. */
    async retrieve(message) {
        const results = [];
        for (const file of message.attachments.values()) {
            const looksLikeLog = EXTENSIONS.test(file.name) || (!file.name.includes('.') && file.contentType?.startsWith('text/'));
            if (!looksLikeLog || file.size > 15 * 1024 * 1024) continue;

            const content = await fetchText(file.url, { gzip: /\.gz$/i.test(file.name) });
            if (content) results.push({ content, source: file.name });
        }
        return results;
    },
};
