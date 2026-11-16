// Twitch helpers. Free, but needs an app from https://dev.twitch.tv/console
// (TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET in .env).

let token = null;
let tokenExpiresAt = 0;

function twitchConfigured() {
    return Boolean(process.env.TWITCH_CLIENT_ID && process.env.TWITCH_CLIENT_SECRET);
}

/** App access token, cached until shortly before it expires. */
async function getToken() {
    if (token && Date.now() < tokenExpiresAt) return token;

    const params = new URLSearchParams({
        client_id: process.env.TWITCH_CLIENT_ID,
        client_secret: process.env.TWITCH_CLIENT_SECRET,
        grant_type: 'client_credentials',
    });
    const res = await fetch(`https://id.twitch.tv/oauth2/token?${params}`, { method: 'POST', signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`Twitch token request failed (${res.status}). Check TWITCH_CLIENT_ID/SECRET.`);

    const data = await res.json();
    token = data.access_token;
    tokenExpiresAt = Date.now() + (data.expires_in - 300) * 1000;
    return token;
}

async function helix(pathAndQuery, retried = false) {
    const res = await fetch(`https://api.twitch.tv/helix/${pathAndQuery}`, {
        headers: { 'Client-ID': process.env.TWITCH_CLIENT_ID, Authorization: `Bearer ${await getToken()}` },
        signal: AbortSignal.timeout(15_000),
    });
    // Token revoked or expired early: get a fresh one and try once more.
    if (res.status === 401 && !retried) {
        token = null;
        return helix(pathAndQuery, true);
    }
    if (!res.ok) throw new Error(`Twitch API returned ${res.status}`);
    return res.json();
}

/** Look up a streamer by username or twitch.tv link. Returns { id, login, name } or null. */
async function getUser(input) {
    const login = input.trim().replace(/^(https?:\/\/)?(www\.)?twitch\.tv\//i, '').replace(/[/?#].*$/, '').toLowerCase();
    if (!/^\w{3,25}$/.test(login)) return null;

    const data = await helix(`users?login=${encodeURIComponent(login)}`);
    const user = data.data?.[0];
    return user ? { id: user.id, login: user.login, name: user.display_name } : null;
}

/** Live streams for the given user IDs. Returns a Map of userId -> stream. */
async function getLiveStreams(userIds) {
    const live = new Map();
    for (let i = 0; i < userIds.length; i += 100) {
        const query = userIds.slice(i, i + 100).map(id => `user_id=${id}`).join('&');
        const data = await helix(`streams?first=100&${query}`);
        for (const stream of data.data ?? []) {
            if (stream.type === 'live') live.set(stream.user_id, stream);
        }
    }
    return live;
}

module.exports = { twitchConfigured, getUser, getLiveStreams };
