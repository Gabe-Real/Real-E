// Supported paste sites, ported from Cozy-crashes' pastebins.yml.
//  raw:           the link itself is the raw text
//  urlTransform:  rewrite the link to the site's raw/download URL ($1, $2 = regex groups)
//  scrape:        pull the text out of the page's HTML
module.exports = {
    raw: [
        /0x0\.st\/([^/?#\s]+)/,
        /bytebin\.lucko\.me\/([^/?#\s]+)/,
        /termbin\.com\/([^/?#\s]+)/,
        /(?:cdn|media)\.discordapp\.(?:com|net)\/attachments\/\d+\/\d+\/\S+\.(?:log|txt)/,
    ],

    urlTransform: [
        { match: /mclo\.gs\/([^/?#\s]+)/, output: 'https://api.mclo.gs/1/raw/$1' },
        { match: /gnomebot\.dev\/paste\/mclogs\/([^/?#\s]+)/, output: 'https://api.mclo.gs/1/raw/$1' },
        { match: /paste\.ee\/[pd]\/([^/?#\s]+)/, output: 'https://paste.ee/d/$1' },
        { match: /pastes\.dev\/([^/?#\s]+)/, output: 'https://api.pastes.dev/$1' },
        { match: /hastebin\.com\/(?:raw\/)?([^/?#\s]+)/, output: 'https://hastebin.com/raw/$1' },
        { match: /toptal\.com\/developers\/hastebin\/(?:raw\/)?([^/?#\s]+)/, output: 'https://www.toptal.com/developers/hastebin/raw/$1' },
        { match: /hst\.sh\/(?:raw\/)?([^/?#\s]+)/, output: 'https://hst.sh/raw/$1' },
        { match: /gist\.github(?:usercontent)?\.com\/([^/?#\s]+)\/([^/?#\s]+)/, output: 'https://gist.githubusercontent.com/$1/$2/raw' },
        { match: /pastebin\.com\/(?:raw|dl|clone|embed|print)\/([^/?#\s]+)/, output: 'https://pastebin.com/raw/$1' },
        { match: /pastebin\.com\/([^/?#\s]+)/, output: 'https://pastebin.com/raw/$1' },
        { match: /pastery\.net\/([^/?#\s]+)/, output: 'https://www.pastery.net/$1/raw/' },
    ],

    scrape: [
        // ATLauncher's paste site shows the log inside the first <code> block.
        { match: /paste\.atlauncher\.com\/view\/([^/?#\s]+)/, firstElement: 'code' },
    ],
};
