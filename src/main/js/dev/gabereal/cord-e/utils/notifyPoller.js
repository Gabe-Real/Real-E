const NotifySubscription = require('../schemas/notify/notifySubscription');
const { fetchFeed } = require('./youtube');
const { twitchConfigured, getLiveStreams } = require('./twitch');

const YOUTUBE_INTERVAL_MS = 5 * 60 * 1000;
const TWITCH_INTERVAL_MS = 2 * 60 * 1000;
const MAX_VIDEOS_PER_CHECK = 3;              // Never dump a whole backlog into a channel
const MAX_VIDEO_AGE_MS = 2 * 24 * 60 * 60 * 1000;

const DEFAULT_MESSAGES = {
    youtube: '**{name}** just posted a new {type}: **{title}**\n{url}',
    twitch: '**{name}** is now live on Twitch: **{title}**\n{url}',
};

function fillTemplate(template, values) {
    return template.replace(/\{(\w+)\}/g, (match, key) => (key in values ? values[key] : match));
}

/** Build and send an alert for one subscription. `values` fills the {placeholders}. */
async function sendAlert(client, sub, values) {
    const channel = await client.channels.fetch(sub.discordChannelId).catch(() => null);
    if (!channel?.isTextBased()) return false;

    const text = fillTemplate(sub.message || DEFAULT_MESSAGES[sub.platform], values);
    const isEveryone = sub.roleId && sub.roleId === sub.guildId;
    const ping = !sub.roleId ? '' : isEveryone ? '@everyone ' : `<@&${sub.roleId}> `;

    await channel.send({
        content: (ping + text).slice(0, 2000),
        allowedMentions: isEveryone ? { parse: ['everyone'] } : { roles: sub.roleId ? [sub.roleId] : [] },
    });
    return true;
}

async function checkYouTube(client) {
    const subs = await NotifySubscription.find({ platform: 'youtube' });
    const byChannel = new Map();
    for (const sub of subs) {
        if (!client.guilds.cache.has(sub.guildId)) continue;
        if (!byChannel.has(sub.sourceId)) byChannel.set(sub.sourceId, []);
        byChannel.get(sub.sourceId).push(sub);
    }

    // One feed request per YouTube channel, however many servers follow it.
    for (const [channelId, channelSubs] of byChannel) {
        let feed;
        try {
            feed = await fetchFeed(channelId);
        } catch (err) {
            console.error(`[notify] YouTube feed failed for ${channelId}:`, err.message);
            continue;
        }

        for (const sub of channelSubs) {
            const since = sub.lastPublishedAt ?? new Date(0);
            const fresh = feed.videos
                .filter(v => v.published > since && Date.now() - v.published.getTime() < MAX_VIDEO_AGE_MS)
                .sort((a, b) => a.published - b.published)  // oldest first, so they post in order
                .slice(-MAX_VIDEOS_PER_CHECK);

            for (const video of fresh) {
                try {
                    await sendAlert(client, sub, { name: feed.name, title: video.title, url: video.url, type: video.type });
                } catch (err) {
                    console.error(`[notify] Couldn't send YouTube alert in ${sub.guildId}:`, err.message);
                }
            }

            const newest = feed.videos.reduce((max, v) => (v.published > max ? v.published : max), since);
            if (newest > since || feed.name !== sub.sourceName) {
                sub.lastPublishedAt = newest;
                sub.lastItemId = feed.videos.find(v => v.published.getTime() === newest.getTime())?.id ?? sub.lastItemId;
                sub.sourceName = feed.name;
                await sub.save();
            }
        }
    }
}

async function checkTwitch(client) {
    if (!twitchConfigured()) return;

    const subs = (await NotifySubscription.find({ platform: 'twitch' })).filter(s => client.guilds.cache.has(s.guildId));
    if (!subs.length) return;

    const live = await getLiveStreams([...new Set(subs.map(s => s.sourceId))]);

    for (const sub of subs) {
        const stream = live.get(sub.sourceId);
        // Not live, or we've already announced this particular stream.
        if (!stream || stream.id === sub.lastItemId) continue;

        try {
            await sendAlert(client, sub, {
                name: stream.user_name,
                title: stream.title || 'Untitled stream',
                game: stream.game_name || 'something',
                url: `https://twitch.tv/${stream.user_login}`,
            });
        } catch (err) {
            console.error(`[notify] Couldn't send Twitch alert in ${sub.guildId}:`, err.message);
        }

        sub.lastItemId = stream.id;
        sub.sourceName = stream.user_name;
        await sub.save();
    }
}

/** Run a check on a timer, never letting two runs overlap or an error stop future runs. */
function every(ms, label, fn) {
    let running = false;
    const tick = async () => {
        if (running) return;
        running = true;
        try {
            await fn();
        } catch (err) {
            console.error(`[notify] ${label} check failed:`, err);
        } finally {
            running = false;
        }
    };
    tick();
    setInterval(tick, ms);
}

function startNotifyPoller(client) {
    every(YOUTUBE_INTERVAL_MS, 'YouTube', () => checkYouTube(client));
    every(TWITCH_INTERVAL_MS, 'Twitch', () => checkTwitch(client));
    if (!twitchConfigured()) console.log('[notify] Twitch alerts disabled (no TWITCH_CLIENT_ID/SECRET in .env).');
}

module.exports = { startNotifyPoller, sendAlert, DEFAULT_MESSAGES };
