// Who counts as the bot owner: the Discord application's owner (or team members),
// plus anyone listed in BOT_OWNER_IDS in .env (comma separated).
let owners = new Set();

async function loadOwners(client) {
    const ids = new Set((process.env.BOT_OWNER_IDS ?? '').split(',').map(s => s.trim()).filter(Boolean));
    try {
        const app = await client.application.fetch();
        const owner = app.owner;
        if (owner?.members) owner.members.forEach(m => ids.add(m.id));   // owned by a team
        else if (owner?.id) ids.add(owner.id);
    } catch (err) {
        console.error('[access] Couldn\'t look up the application owner:', err.message);
    }
    owners = ids;
    return owners;
}

const isOwner = (userId) => owners.has(userId);
const getOwners = () => [...owners];

module.exports = { loadOwners, isOwner, getOwners };
