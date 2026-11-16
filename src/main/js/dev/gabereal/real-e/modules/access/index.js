/**
 * Access requests: Real-E is private, so servers ask to use it and you approve or deny them.
 *
 *  - /request (or the panel button from /requests panel) opens a form
 *  - /requests shows your board: Pending / Approved / Denied, with ✏️ to review each one
 *  - Approving DMs them an invite locked to their server and adds it to the allowlist
 *  - If Real-E is added to a server that isn't on the allowlist, it explains and leaves
 */
const crypto = require('node:crypto');
const { Events, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { AccessRequest, AllowedGuild } = require('./schemas');
const roles = require('../staff/roles');
const banned = require('../staff/banned');
const { inviteFor, requestUrl } = require('./links');
const views = require('./views');
const { text, divider, v2 } = views;

// ---------- allowlist ----------

const allowed = new Set();

async function refreshAllowlist() {
    allowed.clear();
    for (const g of await AllowedGuild.find({}, { guildId: 1 }).lean()) allowed.add(g.guildId);
}

async function allow(guildId, guildName, addedBy, source = 'manual') {
    await AllowedGuild.findOneAndUpdate({ guildId }, { guildId, guildName, addedBy, source }, { upsert: true });
    allowed.add(guildId);
}

async function disallow(guildId) {
    await AllowedGuild.deleteOne({ guildId });
    allowed.delete(guildId);
}

const isAllowed = (guildId) => allowed.has(guildId) || guildId === process.env.TESTING_GUILD_ID;

/** DM every owner. Never throws. */
async function notifyOwners(client, payload) {
    // Devs and management hear about requests and unapproved servers.
    const { dev, management } = await roles.listAll().catch(() => ({ dev: roles.devIds(), management: [] }));
    for (const id of new Set([...dev, ...management])) {
        try {
            const user = await client.users.fetch(id);
            await user.send(payload);
        } catch (err) {
            console.error(`[access] Couldn't DM owner ${id}:`, err.message);
        }
    }
}

/** DM the person who made a request. Returns false if their DMs are closed. */
async function dm(client, userId, payload) {
    try {
        const user = await client.users.fetch(userId);
        await user.send(payload);
        return true;
    } catch {
        return false;
    }
}

// ---------- setup ----------

function setupAccess(client) {
    client.once(Events.ClientReady, async () => {
        try {
            await roles.loadAppOwners(client);
            await banned.load();
            await refreshAllowlist();

            // First run: everything Real-E is already in is allowed, so nothing gets kicked out.
            if (allowed.size === 0) {
                for (const guild of client.guilds.cache.values()) await allow(guild.id, guild.name, 'startup', 'existing');
                console.log(`[access] Allowlist created with the ${allowed.size} servers Real-E is already in.`);
            }

            // Never auto-leave on startup (a database blip shouldn't empty the bot). Just tell the owner.
            const strays = client.guilds.cache.filter(g => !isAllowed(g.id));
            if (strays.size) {
                await notifyOwners(client, v2([text(`## 🗂️ Real-E is in ${strays.size} server${strays.size === 1 ? '' : 's'} that aren't allowed\n` +
                    strays.map(g => `- **${g.name}** \`${g.id}\``).join('\n') +
                    '\n-# Use `/requests allow` to keep them, or `/requests revoke` to leave')]));
            }
            console.log(`[access] Ready. ${allowed.size} allowed servers, devs: ${roles.devIds().join(', ') || 'none found'}`);
        } catch (err) {
            console.error('[access] Setup failed:', err);
        }
    });

    // Someone added Real-E to a server that wasn't approved: explain, tell the owner, and leave.
    client.on(Events.GuildCreate, async (guild) => {
        const isBanned = await banned.isBanned(guild.id);
        if (isAllowed(guild.id) && !isBanned) return;
        try {
            const message = v2([
                text(isBanned
                    ? `## 🚫 Real-E can't be used in ${guild.name}\n-# This server has been blocked from using Real-E`
                    : `## 🔒 Real-E is a private bot\nIt's only available in approved servers, so I've left **${guild.name}**.\n` +
                      `-# Want it here? Ask for access in Gabe_Real's server: ${requestUrl()}`),
            ]);
            const owner = await guild.fetchOwner().catch(() => null);
            if (!owner || !(await owner.send(message).then(() => true).catch(() => false))) {
                await guild.systemChannel?.send(message).catch(() => {});
            }
            await notifyOwners(client, v2([text(`## 🚪 Left an unapproved server\n**${guild.name}** \`${guild.id}\` · ${guild.memberCount} members\n-# Added without approval, so Real-E left straight away`)]));
        } finally {
            await guild.leave().catch(err => console.error('[access] Couldn\'t leave', guild.id, err.message));
        }
    });
}

// ---------- requests ----------

/** Handle the request form. */
async function submitRequest(interaction) {
    await interaction.deferReply({ flags: 64 });
    const say = (title, sub) => interaction.editReply(v2([text(`## ${title}${sub ? `\n-# ${sub}` : ''}`)]));

    const inviteText = interaction.fields.getTextInputValue('invite').trim();
    const reason = interaction.fields.getTextInputValue('reason').trim();
    const role = interaction.fields.getStringSelectValues('role')?.[0] ?? null;

    const code = inviteText.match(/(?:discord(?:app)?\.com\/invite|discord\.gg)\/([\w-]+)/i)?.[1] ?? (/^[\w-]+$/.test(inviteText) ? inviteText : null);
    if (!code) return say('🔗 That doesn\'t look like an invite', 'Paste a link like https://discord.gg/abc123');

    const invite = await interaction.client.fetchInvite(code, { withCounts: true }).catch(() => null);
    if (!invite?.guild) return say('🔗 That invite didn\'t work', 'It might have expired. Make a permanent one and try again');

    const guildId = invite.guild.id;
    if (await banned.isBanned(guildId)) return say('🚫 That server can\'t request Real-E', 'It has been blocked by Real-E\'s staff');
    if (isAllowed(guildId)) return say('✅ That server already has access', `Real-E is approved for **${invite.guild.name}**`);
    if (await AccessRequest.exists({ guildId, status: 'pending' })) {
        return say('⏳ Already waiting', `There's already a request for **${invite.guild.name}**. You'll get a DM when it's reviewed`);
    }

    const request = await AccessRequest.create({
        requestId: crypto.randomBytes(3).toString('hex'),
        requesterId: interaction.user.id,
        guildId,
        guildName: invite.guild.name,
        memberCount: invite.memberCount ?? null,
        inviteCode: code,
        role,
        reason,
    });

    await notifyOwners(interaction.client, v2([
        text(`## 📨 New Real-E request\n**${request.guildName}**${request.memberCount ? ` · ${request.memberCount.toLocaleString('en-GB')} members` : ''}\n` +
            `-# \`${request.requestId}\` · from <@${request.requesterId}>${role ? ` (${role})` : ''}\n> ${reason.replace(/\n/g, '\n> ')}`),
        new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('requests:open').setLabel('Open requests').setEmoji('📨').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setURL(`https://discord.gg/${code}`).setLabel('View server').setStyle(ButtonStyle.Link),
        ),
    ]));

    return say('📨 Request sent!', `I'll DM you once **${request.guildName}** has been reviewed. Keep your DMs open`);
}

/** Handle the ✏️ review pop-up: save, tell the requester, update the allowlist, refresh the board. */
async function reviewRequest(interaction) {
    if (!(await roles.has(interaction.user.id, 'management'))) {
        return interaction.reply(v2([text('## 🔒 Management only\n-# Staff can view requests, but only management can approve or deny them')], true));
    }

    const requestId = interaction.customId.split(':')[2];
    const request = await AccessRequest.findOne({ requestId });
    if (!request) return interaction.reply(v2([text('## 🔍 Request not found\n-# It may have been removed')], true));

    const status = interaction.fields.getStringSelectValues('status')[0];
    const note = interaction.fields.getTextInputValue('note')?.trim() || null;
    const was = request.status;

    request.status = status;
    request.note = note;
    request.decidedBy = interaction.user.id;
    request.decidedAt = new Date();
    await request.save();

    let result = '';
    if (status === 'approved' && was !== 'approved') {
        await allow(request.guildId, request.guildName, interaction.user.id, 'request');
        const sent = await dm(interaction.client, request.requesterId, v2([
            text(`## 🎉 Real-E has been approved for ${request.guildName}!\nPress the button to add it. The link only works for your server.` +
                (note ? `\n> ${note.replace(/\n/g, '\n> ')}` : '')),
            new ActionRowBuilder().addComponents(new ButtonBuilder().setURL(inviteFor(interaction.client.user.id, request.guildId)).setLabel(`Add Real-E to ${request.guildName}`.slice(0, 80)).setStyle(ButtonStyle.Link)),
        ]));
        result = sent ? 'Approved, and they\'ve been sent their invite' : 'Approved, but their DMs are closed. Send them the invite yourself';
    } else if (status === 'denied' && was !== 'denied') {
        // Changing your mind on an approved server revokes it.
        if (was === 'approved') await revoke(interaction.client, request.guildId);
        const sent = await dm(interaction.client, request.requesterId, v2([
            text(`## Your Real-E request for ${request.guildName} wasn't approved\n` + (note ? `> ${note.replace(/\n/g, '\n> ')}` : '-# No reason was given'))
        ]));
        result = sent ? 'Denied, and they\'ve been told' : 'Denied (their DMs are closed, so they weren\'t told)';
    } else if (status === 'pending' && was === 'approved') {
        await revoke(interaction.client, request.guildId);
        result = 'Moved back to pending, and access was removed';
    } else {
        result = 'Saved';
    }

    // Refresh the board this came from (same tab), and confirm privately.
    const components = await views.board(was, 1);
    if (interaction.isFromMessage()) await interaction.update(v2(components));
    else await interaction.reply(v2(components, true));
    await interaction.followUp(v2([text(`## ✅ ${request.guildName}\n-# ${result}`)], true));
}

/** Remove a server from the allowlist and leave it if Real-E is there. */
async function revoke(client, guildId) {
    await disallow(guildId);
    const guild = client.guilds.cache.get(guildId);
    if (guild) await guild.leave().catch(() => {});
    return guild?.name ?? null;
}

/** Allowed servers list (shared by the button and /requests allowlist). */
async function allowlistView(client) {
    const docs = await AllowedGuild.find().sort({ createdAt: 1 }).lean();
    const label = { existing: 'already there', request: 'approved request', manual: 'added manually' };
    const lines = docs.map(d => {
        const inIt = client.guilds.cache.has(d.guildId);
        return `${inIt ? '🟩' : '⬜'} **${client.guilds.cache.get(d.guildId)?.name ?? d.guildName ?? 'Unknown'}** \`${d.guildId}\`\n-# ${label[d.source]}${inIt ? '' : ' · not added yet'}`;
    });
    return [
        text(`## 🗂️ Allowed servers\n-# ${docs.length} allowed · 🟩 Real-E is in it · ⬜ approved but not added yet`),
        divider(),
        text(lines.join('\n').slice(0, 3800) || '-# Nothing yet'),
    ];
}

module.exports = { setupAccess, submitRequest, reviewRequest, revoke, allow, disallow, isAllowed, allowlistView, notifyOwners, views };
