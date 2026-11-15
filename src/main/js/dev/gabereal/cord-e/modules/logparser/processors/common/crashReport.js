const { Order } = require('../../constants');

// latest.log says where the full crash report was saved: ask for it.
module.exports = {
    id: 'crash-reports',
    order: Order.Default,
    process(log) {
        const match = log.content.match(/Crashed! The full crash report has been saved to (\S+)/i);
        if (match) log.addMessage(`Please also provide the crash report at \`${match[1]}\``);
    },
};
