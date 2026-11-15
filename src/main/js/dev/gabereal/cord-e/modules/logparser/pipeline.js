const Log = require('./Log');
const config = require('./config');

/**
 * Run one piece of text through every parser then every processor, like Cozy's handleLink().
 * A handler that throws is logged and skipped, so one bad regex can't break the whole result.
 */
function parseLog(content, source, { fromCommand = false } = {}) {
    const log = new Log(content, source);
    log.fromCommand = fromCommand;

    for (const stage of [config.parsers, config.processors]) {
        for (const handler of stage) {
            if (log.aborted) return log;
            try {
                if (handler.predicate && !handler.predicate(log)) continue;
                handler.process(log);
            } catch (err) {
                console.error(`[logparser] ${handler.id} failed on ${source}:`, err);
            }
        }
    }
    return log;
}

/** Get every log out of a Discord message (attachments + paste links) and parse them. */
async function parseMessage(message, options = {}) {
    const texts = [];
    for (const retriever of config.retrievers) {
        try {
            texts.push(...await retriever.retrieve(message));
        } catch (err) {
            console.error(`[logparser] Retriever ${retriever.id} failed:`, err);
        }
    }
    return texts.map(({ content, source }) => parseLog(content, source, options)).filter(log => log.isInteresting);
}

module.exports = { parseLog, parseMessage };
