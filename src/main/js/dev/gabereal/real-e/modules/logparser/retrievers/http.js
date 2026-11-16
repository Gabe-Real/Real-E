// Shared download helper for retrievers: timeouts, a size cap, and gzip support.
const zlib = require('node:zlib');

const MAX_BYTES = 15 * 1024 * 1024;
const USER_AGENT = 'Real-E Discord bot (log parser; github.com/Gabe-Real/Real-E)';

/** Download a URL as text. Returns null if it fails, is too big, or isn't text. */
async function fetchText(url, { gzip = false } = {}) {
    try {
        const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(20_000) });
        if (!res.ok) return null;

        const length = Number(res.headers.get('content-length') ?? 0);
        if (length > MAX_BYTES) return null;

        let buffer = Buffer.from(await res.arrayBuffer());
        if (buffer.length > MAX_BYTES) return null;

        // .log.gz files (old logs from the logs folder) are gzipped.
        if (gzip || (buffer[0] === 0x1f && buffer[1] === 0x8b)) {
            buffer = zlib.gunzipSync(buffer, { maxOutputLength: MAX_BYTES * 4 });
        }

        const text = buffer.toString('utf8');
        // Binary files (zips, images) are full of NUL characters; real logs aren't.
        if (text.slice(0, 2000).includes('\u0000')) return null;
        return text;
    } catch (err) {
        console.error(`[logparser] Download failed for ${url}:`, err.message);
        return null;
    }
}

module.exports = { fetchText, USER_AGENT };
