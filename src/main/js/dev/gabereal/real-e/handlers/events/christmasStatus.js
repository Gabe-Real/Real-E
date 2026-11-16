const { ActivityType } = require('discord.js');

const TZ = 'Europe/London';
const API = `https://christmascountdown.live/api/timeleft/sleeps?timezone=${encodeURIComponent(TZ)}`;

function localDaysLeft() {
    const [y, m, d] = new Intl.DateTimeFormat('en-CA', { timeZone: TZ })
        .format(new Date())
        .split('-')
        .map(Number);
    const today = Date.UTC(y, m - 1, d);
    let xmas = Date.UTC(y, 11, 25);
    if (today > xmas) xmas = Date.UTC(y + 1, 11, 25); // Boxing Day onwards → next year
    return Math.round((xmas - today) / 86_400_000);
}

async function apiDaysLeft() {
    const res = await fetch(API, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return Math.round(await res.json());
}

function statusText(days) {
    if (days === 0) return '🎄Merry Christmas!';
    if (days === 1) return '🎅1 day until Christmas!';
    return `🎄${days} days until Christmas`;
}

async function updateStatus(client) {
    // A dev set a custom status with /reale dev, so leave it alone until they reset it.
    if (client.statusOverride) return;
    let days = localDaysLeft();
    if (days !== 0) {
        try {
            days = await apiDaysLeft();
        } catch (err) {
            console.warn('Christmas API failed, using local count:', err.message);
        }
    }
    client.user.setActivity({
        type: ActivityType.Custom,
        name: '🎄Christmas countdown',
        state: statusText(days),
    });
}

function startChristmasStatus(client) {
    updateStatus(client);
    setInterval(() => updateStatus(client), 60 * 60 * 1000);
}

module.exports = { startChristmasStatus, updateStatus };