// Invite link locked to one server: Discord pre-selects it and hides the server picker.
// INVITE_PERMISSIONS in .env sets what Real-E asks for (default 8 = Administrator).
function inviteFor(clientId, guildId) {
    const params = new URLSearchParams({
        client_id: clientId,
        permissions: process.env.INVITE_PERMISSIONS ?? '8',
        scope: 'bot applications.commands',
        guild_id: guildId,
        disable_guild_select: 'true',
    });
    return `https://discord.com/oauth2/authorize?${params}`;
}

// Where people are sent to ask for access (your server). Set ACCESS_REQUEST_URL in .env.
const requestUrl = () => process.env.ACCESS_REQUEST_URL || 'https://discord.gabereal.co.uk';

module.exports = { inviteFor, requestUrl };
