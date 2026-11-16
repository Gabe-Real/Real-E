// /reale dev: developer-only controls. Devs come from BOT_OWNER_IDS in .env, so nobody can be "promoted" to this.
const util = require('node:util');
const { ActivityType, version: djsVersion } = require('discord.js');
const roles = require('../roles');
const { card, oops } = require('../ui');
const { updateStatus } = require('../../../handlers/events/christmasStatus');

const ACTIVITY = {
    playing: ActivityType.Playing, watching: ActivityType.Watching, listening: ActivityType.Listening,
    competing: ActivityType.Competing, custom: ActivityType.Custom,
};

// Never show secrets in /reale dev evaluate output.
function redact(output) {
    let out = output;
    for (const secret of [process.env.TOKEN, process.env.MONGODB_URI, process.env.TWITCH_CLIENT_SECRET].filter(Boolean)) {
        out = out.split(secret).join('[redacted]');
    }
    return out;
}

const actions = {
    async toggle_management(ctx) {
        const userId = ctx.options.getString('user_id')?.trim();
        const on = ctx.options.getBoolean('toggle');
        if (!userId || on === null) return oops('✏️ Missing details', 'Needs `user_id` and `toggle`');
        if (roles.devIds().includes(userId)) return oops('🔒 That\'s a developer', 'Developers are set in `.env`');
        await roles.setLevel(userId, on ? 'management' : 'none', ctx.user.id);
        return card(on ? '🔐 Management access given' : '🔐 Management access removed', `<@${userId}> \`${userId}\``);
    },

    async restart(ctx) {
        // Exits with an error code so Cybrancee's crash detection starts it again (pulling the latest code).
        setTimeout(() => process.exit(1), 1500);
        return card('♻️ Restarting', 'Back in a few seconds. If it stays offline, press Start in the Cybrancee panel');
    },

    async status(ctx) {
        const status = ctx.options.getString('status') ?? 'online';
        const activity = ctx.options.getString('activity');
        const value = ctx.options.getString('text');
        const client = ctx.client;

        if (activity === 'reset') {
            client.statusOverride = false;
            client.user.setStatus('online');
            await updateStatus(client);
            return card('🛠️ Status reset', 'Back to the automatic Christmas countdown');
        }

        client.statusOverride = true;
        const presence = { status, activities: [] };
        if (activity && value) {
            presence.activities.push(activity === 'custom'
                ? { type: ActivityType.Custom, name: 'Custom Status', state: value }
                : { type: ACTIVITY[activity], name: value });
        }
        client.user.setPresence(presence);
        return card('🛠️ Status updated', `${status}${activity && value ? ` · ${activity} ${value}` : ''}`);
    },

    async evaluate(ctx) {
        const code = ctx.options.getString('text');
        if (!code) return oops('✏️ Missing code', 'Put JavaScript in `text`. `client` and `interaction` are available');
        const started = performance.now();
        let output;
        try {
            // eslint-disable-next-line no-new-func
            const fn = new Function('client', 'interaction', 'require', `return (async () => { return (${code}); })();`);
            output = util.inspect(await fn(ctx.client, ctx, require), { depth: 1 });
        } catch (err) {
            try {
                const fn = new Function('client', 'interaction', 'require', `return (async () => { ${code} })();`);
                output = util.inspect(await fn(ctx.client, ctx, require), { depth: 1 });
            } catch (err2) {
                output = `Error: ${err2.message}`;
            }
        }
        const ms = (performance.now() - started).toFixed(1);
        return card('📃 Evaluated', `${ms} ms`, '```js\n' + redact(output).slice(0, 3700) + '\n```');
    },

    async stats(ctx) {
        const client = ctx.client;
        const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(0)} MB`;
        const up = process.uptime();
        const uptime = `${Math.floor(up / 86400)}d ${Math.floor(up / 3600) % 24}h ${Math.floor(up / 60) % 60}m`;
        const users = client.guilds.cache.reduce((sum, g) => sum + g.memberCount, 0);
        return card('📊 Real-E stats', `Up for ${uptime}`, [
            `**Servers:** ${client.guilds.cache.size} · **Members:** ${users.toLocaleString('en-GB')}`,
            `**Commands:** ${client.commands?.size ?? '?'}`,
            `**Ping:** ${client.ws.ping} ms`,
            `**Memory:** ${mb(process.memoryUsage().rss)}`,
            `**Node:** ${process.version} · **discord.js:** ${djsVersion}`,
        ].join('\n'));
    },
};

const choices = [
    ['🔐 Toggle management access for a user (user_id, toggle)', 'toggle_management'],
    ['♻️ Restart the bot', 'restart'],
    ['🛠️ Set bot status or rich presence (status, activity, text)', 'status'],
    ['📃 Evaluate JavaScript (text)', 'evaluate'],
    ['📊 Bot stats (uptime, memory, ping)', 'stats'],
];

module.exports = { actions, choices };
