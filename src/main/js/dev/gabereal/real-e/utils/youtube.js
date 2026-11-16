// YouTube helpers. Uses the public RSS feed every channel has, so no API key or quota is needed.

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (compatible; Real-E Discord bot)',
    'Accept-Language': 'en-GB,en;q=0.9',
    // Skips YouTube's cookie-consent page, which UK/EU servers otherwise get instead of the channel page.
    Cookie: 'SOCS=CAI; CONSENT=YES+1',
};

const CHANNEL_ID = /^UC[\w-]{22}$/;

function decodeXml(text = '') {
    return text
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
        .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
        .replace(/&amp;/g, '&');
}

function pick(xml, regex) {
    const match = xml.match(regex);
    return match ? decodeXml(match[1].trim()) : null;
}

/**
 * Fetch a channel's latest uploads (videos, Shorts and streams), newest first.
 * Returns { name, videos: [{ id, title, url, published, type }] }.
 */
async function fetchFeed(channelId) {
    const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`, {
        headers: HEADERS,
        signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`YouTube feed returned ${res.status}`);
    const xml = await res.text();

    const [head, ...entries] = xml.split('<entry>');
    const name = pick(head, /<title>([\s\S]*?)<\/title>/) ?? 'Unknown channel';

    const videos = entries.map(entry => {
        const id = pick(entry, /<yt:videoId>([\s\S]*?)<\/yt:videoId>/);
        const url = pick(entry, /<link rel="alternate" href="([^"]+)"/) ?? `https://www.youtube.com/watch?v=${id}`;
        return {
            id,
            title: pick(entry, /<title>([\s\S]*?)<\/title>/) ?? 'Untitled',
            url,
            published: new Date(pick(entry, /<published>([\s\S]*?)<\/published>/)),
            type: url.includes('/shorts/') ? 'Short' : 'video',
        };
    }).filter(v => v.id && !Number.isNaN(v.published.getTime()));

    return { name, videos };
}

/**
 * Turn whatever the user typed (channel ID, @handle, or any channel URL) into a channel ID.
 * Returns null if it can't be worked out.
 */
async function resolveChannelId(input) {
    const text = input.trim();

    if (CHANNEL_ID.test(text)) return text;

    const fromUrl = text.match(/\/channel\/(UC[\w-]{22})/);
    if (fromUrl) return fromUrl[1];

    // Build a page URL for handles (@name) and custom/legacy URLs, then read the channel ID off the page.
    let pageUrl;
    if (/^@[\w.-]+$/.test(text)) pageUrl = `https://www.youtube.com/${text}`;
    else if (/^(https?:\/\/)?(www\.|m\.)?youtube\.com\//i.test(text)) pageUrl = text.startsWith('http') ? text : `https://${text}`;
    else if (/^[\w.-]+$/.test(text)) pageUrl = `https://www.youtube.com/@${text}`;
    else return null;

    try {
        const res = await fetch(pageUrl, { headers: HEADERS, signal: AbortSignal.timeout(15_000) });
        if (!res.ok) return null;
        const html = await res.text();
        const match = html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[\w-]{22})"/)
            ?? html.match(/"externalId":"(UC[\w-]{22})"/)
            ?? html.match(/<meta itemprop="(?:channelId|identifier)" content="(UC[\w-]{22})"/);
        return match ? match[1] : null;
    } catch {
        return null;
    }
}

module.exports = { fetchFeed, resolveChannelId };
