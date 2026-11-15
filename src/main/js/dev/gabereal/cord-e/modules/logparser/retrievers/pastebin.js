const { Order } = require('../constants');
const { fetchText } = require('./http');
const PASTEBINS = require('./pastebins');

const URL_REGEX = /https?:\/\/[^\s<>()"']+/gi;

function decodeHtml(text) {
    return text
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
        .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
        .replace(/&amp;/g, '&');
}

/** Work out the raw text for one paste link, or null if it's not a site we know. */
async function retrieveLink(link) {
    if (PASTEBINS.raw.some(re => re.test(link))) return fetchText(link);

    for (const { match, output } of PASTEBINS.urlTransform) {
        const m = link.match(match);
        if (!m) continue;
        const target = output.replace(/\$(\d)/g, (_, i) => m[Number(i)] ?? '');
        return fetchText(target);
    }

    for (const { match, firstElement } of PASTEBINS.scrape) {
        if (!match.test(link)) continue;
        const html = await fetchText(link);
        const block = html?.match(new RegExp(`<${firstElement}[^>]*>([\\s\\S]*?)</${firstElement}>`, 'i'));
        return block ? decodeHtml(block[1]) : null;
    }

    return null;
}

module.exports = {
    id: 'pastebin',
    order: Order.Early,
    retrieveLink,

    async retrieve(message) {
        const links = [...new Set(message.content.match(URL_REGEX) ?? [])].slice(0, 5);
        const results = [];
        for (const link of links) {
            const content = await retrieveLink(link);
            if (content) results.push({ content, source: link });
        }
        return results;
    },
};
