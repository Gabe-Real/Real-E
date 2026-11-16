const { StaffLog, StaffSettings } = require('./schemas');

let logChannelId = null;
let loaded = false;

async function getLogChannelId() {
    if (!loaded) {
        logChannelId = (await StaffSettings.findOne({ key: 'global' }).lean())?.logChannelId ?? null;
        loaded = true;
    }
    return logChannelId;
}

async function setLogChannel(channelId) {
    await StaffSettings.findOneAndUpdate({ key: 'global' }, { key: 'global', logChannelId: channelId }, { upsert: true });
    logChannelId = channelId;
    loaded = true;
}

/** Record a /reale action in the database and, if set, the staff log channel. Never throws. */
async function logAction(client, { userId, level, action, details }) {
    try {
        await StaffLog.create({ userId, level, action, details });
        const channelId = await getLogChannelId();
        if (!channelId) return;
        const channel = await client.channels.fetch(channelId).catch(() => null);
        if (channel?.isSendable?.()) {
            await channel.send({
                content: `-# <t:${Math.floor(Date.now() / 1000)}:t> · <@${userId}> (${level}) used **${action}**${details ? ` · ${details}` : ''}`.slice(0, 2000),
                allowedMentions: { parse: [] },
            });
        }
    } catch (err) {
        console.error('[staff] Couldn\'t log action:', err.message);
    }
}

module.exports = { logAction, setLogChannel, getLogChannelId };
