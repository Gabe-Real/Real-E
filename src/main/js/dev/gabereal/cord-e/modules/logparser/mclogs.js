const { USER_AGENT } = require('./retrievers/http');

/** Upload a log to mclo.gs (it also hides IP addresses). Returns the link, or null if it failed. */
async function uploadToMclogs(content) {
    try {
        const res = await fetch('https://api.mclo.gs/1/log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': USER_AGENT },
            body: new URLSearchParams({ content }),
            signal: AbortSignal.timeout(20_000),
        });
        const data = await res.json();
        return data.success ? data.url : null;
    } catch (err) {
        console.error('[logparser] mclo.gs upload failed:', err.message);
        return null;
    }
}

module.exports = { uploadToMclogs };
