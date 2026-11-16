const TempBan = require('../schemas/moderation/tempban');
const { logModAction } = require('./modlog');
const { createCase } = require('./cases');

const CHECK_INTERVAL_MS = 60 * 1000;
const UNKNOWN_BAN = 10026;

/** Persist a temporary ban so it survives restarts. Replaces any existing temp ban for the user. */
async function scheduleUnban({ guildId, user, moderatorId, durationMs }) {
    await TempBan.findOneAndUpdate(
        { guildId, userId: user.id },
        { userTag: user.tag, moderatorId, unbanAt: new Date(Date.now() + durationMs) },
        { upsert: true }
    );
}

/** Drop a pending temp ban (e.g. after a manual unban, or when a ban is made permanent). */
async function cancelUnban(guildId, userId) {
    await TempBan.deleteOne({ guildId, userId });
}

async function processDueUnbans(client) {
    const due = await TempBan.find({ unbanAt: { $lte: new Date() } }).limit(50);

    for (const entry of due) {
        const guild = client.guilds.cache.get(entry.guildId);
        try {
            if (guild) {
                await guild.members.unban(entry.userId, 'Temporary ban expired');
                console.log(`Unbanned ${entry.userTag ?? entry.userId} in ${guild.id} after temporary ban.`);

                const user = await client.users.fetch(entry.userId).catch(() => null);
                const modCase = await createCase({
                    guild, action: 'unban', user: user ?? { id: entry.userId, tag: entry.userTag ?? 'Unknown user' },
                    moderator: client.user, reason: 'Temporary ban expired (auto)',
                });
                await logModAction({
                    guild,
                    colour: 'Green',
                    targetUser: user ?? { tag: entry.userTag ?? 'Unknown user', id: entry.userId },
                    moderator: client.user,
                    emoji: '🔓',
                    action: 'User Unbanned',
                    reason: 'Temporary ban expired.',
                    extraFields: modCase ? [{ name: 'Case', value: `#${modCase.caseId}`, inline: true }] : [],
                });
            }
        } catch (err) {
            // Already unbanned manually — nothing to do. Anything else: log and retry next tick.
            if (err.code !== UNKNOWN_BAN) {
                console.error(`[tempban] Failed to unban ${entry.userId} in ${entry.guildId}:`, err);
                continue;
            }
        }
        await entry.deleteOne();
    }
}

/**
 * Poll the database for expired temp bans. Replaces the old in-memory setTimeout, which was lost on
 * restart and overflowed for durations over ~24.8 days (firing almost immediately instead).
 */
function startTempBanWatcher(client) {
    const tick = () => processDueUnbans(client).catch(err => console.error('[tempban] watcher error:', err));
    tick();
    setInterval(tick, CHECK_INTERVAL_MS);
}

module.exports = { scheduleUnban, cancelUnban, startTempBanWatcher };
