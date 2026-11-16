const { BotStaff } = require('./schemas');

/**
 * Bot-wide roles (not Discord roles):
 *   dev         BOT_OWNER_IDS in .env (falls back to the app owner if that's empty). Can do everything.
 *   management  chosen by a dev (e.g. a community manager). Can do staff things + manage staff and servers.
 *   staff       chosen by management. Read-only tools: look up servers, view requests.
 */
const RANK = { none: 0, staff: 1, management: 2, dev: 3 };
const LABEL = { dev: 'Developer', management: 'Management', staff: 'Staff', none: 'No access' };

let appOwners = [];
const cache = new Map(); // userId -> level, refreshed every minute
let cachedAt = 0;

const envDevs = () => (process.env.BOT_OWNER_IDS ?? '').split(',').map(s => s.trim()).filter(Boolean);
const devIds = () => (envDevs().length ? envDevs() : appOwners);

async function loadAppOwners(client) {
    try {
        const app = await client.application.fetch();
        appOwners = app.owner?.members ? [...app.owner.members.keys()] : app.owner?.id ? [app.owner.id] : [];
    } catch (err) {
        console.error('[staff] Couldn\'t look up the app owner:', err.message);
    }
}

async function refresh() {
    cache.clear();
    for (const s of await BotStaff.find().lean()) cache.set(s.userId, s.level);
    cachedAt = Date.now();
}

async function levelOf(userId) {
    if (devIds().includes(userId)) return 'dev';
    if (Date.now() - cachedAt > 60_000) await refresh().catch(err => console.error('[staff] Refresh failed:', err.message));
    return cache.get(userId) ?? 'none';
}

/** Does this user have at least `level`? */
async function has(userId, level) {
    return RANK[await levelOf(userId)] >= RANK[level];
}

async function setLevel(userId, level, addedBy) {
    if (level === 'none') await BotStaff.deleteOne({ userId });
    else await BotStaff.findOneAndUpdate({ userId }, { userId, level, addedBy }, { upsert: true });
    await refresh();
}

/** Everyone with access, grouped. */
async function listAll() {
    await refresh();
    const groups = { dev: devIds(), management: [], staff: [] };
    for (const [id, level] of cache) groups[level].push(id);
    return groups;
}

module.exports = { RANK, LABEL, loadAppOwners, levelOf, has, setLevel, listAll, devIds };
