const { Client, Collection, Events, GatewayIntentBits, MessageFlags, Partials, EmbedBuilder } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');
const WelcomeConfig = require('./src/main/js/dev/gabereal/cord-e/schemas/welcome/welcome');
const autocompleteHandler = require('./src/main/js/dev/gabereal/cord-e/handlers/events/autocompleteHandler');
const cordboard = require('./src/main/js/dev/gabereal/cord-e/commands/cordboard/cordboard');
const antiReplyHandler = require('./src/main/js/dev/gabereal/cord-e/handlers/commands/replyping');
const MsglogConfig = require('./src/main/js/dev/gabereal/cord-e/schemas/logging/msglogs');
const { handleQuickTag } = require('./src/main/js/dev/gabereal/cord-e/handlers/commands/quickTags');
const { startChristmasStatus } = require('./src/main/js/dev/gabereal/cord-e/handlers/events/christmasStatus');
const { startTempBanWatcher } = require('./src/main/js/dev/gabereal/cord-e/utils/tempBans');
const { startNotifyPoller } = require('./src/main/js/dev/gabereal/cord-e/utils/notifyPoller');


// ENVIRONMENT VARIABLES
require('dotenv').config({ quiet: true });

const token = process.env.TOKEN;
const mongoUri = process.env.MONGODB_URI;
if (!token || !mongoUri) {
    console.error('Missing TOKEN or MONGODB_URI in .env');
    process.exit(1);
}

const ERROR_MESSAGE = 'There was an error whilst executing this command, if you think this is a bug please DM gabe_real10.';

// Last line of defence: on Node 15+ an unhandled promise rejection terminates the process,
// so a single failed API call inside any event listener would otherwise take the whole bot down.
process.on('unhandledRejection', (err) => console.error('[unhandledRejection]', err));


const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.DirectMessages,
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.User]
});

client.on(Events.Error, (err) => console.error('[client error]', err));

/** Wraps an event listener so a thrown error is logged instead of becoming an unhandled rejection. */
function safe(label, fn) {
    return async (...args) => {
        try {
            await fn(...args);
        } catch (err) {
            console.error(`[${label}]`, err);
        }
    };
}

/** Reply with the generic error message without ever throwing (the interaction may have expired). */
async function replyWithError(interaction) {
    const payload = { content: ERROR_MESSAGE, flags: MessageFlags.Ephemeral };
    try {
        if (interaction.replied || interaction.deferred) await interaction.followUp(payload);
        else await interaction.reply(payload);
    } catch (err) {
        console.error('Failed to send error reply:', err.message);
    }
}

function fillTemplate(template, member) {
    return template
        .replace(/{user}/g, member.user.username)
        .replace(/{id}/g, member.id)
        .replace(/{mention}/g, `<@${member.id}>`);
}

client.on(Events.GuildMemberAdd, safe('guildMemberAdd', async member => {
    const config = await WelcomeConfig.findOne({ guildId: member.guild.id });
    if (!config?.enabled || !config.message) return;

    const channel = member.guild.channels.cache.get(config.channelId);
    if (!channel?.isTextBased()) return;

    await channel.send(fillTemplate(config.message, member));
}));

client.on(Events.GuildMemberRemove, safe('guildMemberRemove', async member => {
    const config = await WelcomeConfig.findOne({ guildId: member.guild.id });
    if (!config?.leaveEnabled || !config.leaveMessage) return;

    const channel = member.guild.channels.cache.get(config.leaveChannel);
    if (!channel?.isTextBased()) return;

    await channel.send(fillTemplate(config.leaveMessage, member));
}));

client.on(Events.MessageReactionAdd, safe('cordboard', async (reaction, user) => {
    await cordboard.onReaction(reaction, user, client);
}));

function attachmentList(message) {
    const list = [...message.attachments.values()]
        .map(att => `[${att.name}](${att.url})`)
        .join('\n');
    return list.slice(0, 1024) || '*None*';
}

async function getMsglogChannel(guild) {
    const config = await MsglogConfig.findOne({ guildId: guild.id });
    if (!config) return null;

    const channel = await guild.channels.fetch(config.msglogChannelId).catch(() => null);
    return channel?.isTextBased() ? channel : null;
}

client.on(Events.MessageUpdate, safe('messageUpdate', async (oldMsg, newMsg) => {
    // DMs have no guild; partial (uncached) messages have no old content to compare against.
    if (!newMsg.guild || oldMsg.partial || newMsg.partial || newMsg.author?.bot) return;
    if (oldMsg.content === newMsg.content && oldMsg.attachments.size === newMsg.attachments.size) return;

    const channel = await getMsglogChannel(newMsg.guild);
    if (!channel) return;

    const embed = new EmbedBuilder()
        .setTitle('✏️ Message Edited')
        .setColor(0xf1c40f)
        .addFields(
            { name: 'User', value: `${newMsg.author.tag} (<@${newMsg.author.id}>)`, inline: false },
            { name: 'Channel', value: `<#${newMsg.channel.id}>`, inline: true },
            { name: 'Before', value: oldMsg.content?.slice(0, 1024) || '*Empty*', inline: false },
            { name: 'After', value: newMsg.content?.slice(0, 1024) || '*Empty*', inline: false },
            { name: 'Attachments', value: attachmentList(newMsg) }
        )
        .setTimestamp();

    await channel.send({ embeds: [embed] });
}));


client.on(Events.MessageDelete, safe('messageDelete', async (msg) => {
    if (!msg.guild || msg.partial || msg.author?.bot) return;

    const channel = await getMsglogChannel(msg.guild);
    if (!channel) return;

    const embed = new EmbedBuilder()
        .setTitle('🗑️ Message Deleted')
        .setColor(0xe74c3c)
        .addFields(
            { name: 'User', value: `${msg.author.tag} (<@${msg.author.id}>)`, inline: false },
            { name: 'Channel', value: `<#${msg.channel.id}>`, inline: true },
            { name: 'Message', value: msg.content?.slice(0, 1024) || '*Embed/Attachment/Empty*', inline: false },
            { name: 'Attachments', value: attachmentList(msg) }
        )
        .setTimestamp();

    await channel.send({ embeds: [embed] });
}));


client.commands = new Collection();
client.modals = new Collection();

const foldersPath = path.join(__dirname, 'src/main/js/dev/gabereal/cord-e/commands');
const commandFolders = fs.readdirSync(foldersPath);
const modalFiles = fs.readdirSync(path.join(__dirname, 'src/main/js/dev/gabereal/cord-e/handlers/modals')).filter(file => file.endsWith('.js'));
const eventsPath = path.join(__dirname, 'src/main/js/dev/gabereal/cord-e/handlers/events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const folder of commandFolders) {
    const commandsPath = path.join(foldersPath, folder);
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
        } else {
            console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
        }
    }
}

for (const file of modalFiles) {
    const modal = require(`./src/main/js/dev/gabereal/cord-e/handlers/modals/${file}`);
    client.modals.set(modal.customId, modal);
}

for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    if (event.name) {
        client.on(event.name, safe(`event:${file}`, (...args) => event.execute(...args, client)));
    }
}

async function handleRoleButton(interaction, roleId) {
    const member = interaction.member;
    if (!member) return;

    const role = interaction.guild.roles.cache.get(roleId);
    if (!role) return interaction.reply({ content: 'Role not found.', flags: MessageFlags.Ephemeral });

    // `editable` = the bot has Manage Roles and its highest role is above this one.
    if (!role.editable) {
        return interaction.reply({
            content: 'I can no longer manage that role. Please ask a server admin to move my role above it.',
            flags: MessageFlags.Ephemeral
        });
    }

    const hasRole = member.roles.cache.has(roleId);
    if (hasRole) await member.roles.remove(roleId, 'Reaction role');
    else await member.roles.add(roleId, 'Reaction role');

    return interaction.reply({
        content: `${hasRole ? 'Removed' : 'Added'} role **${role.name}**`,
        flags: MessageFlags.Ephemeral
    });
}

client.on(Events.InteractionCreate, async interaction => {

    if (interaction.isChatInputCommand() || interaction.isContextMenuCommand()) {
        const command = interaction.client.commands.get(interaction.commandName);
        if (!command) {
            console.error(`No command matching ${interaction.commandName} was found.`);
            return;
        }

        try {
            await command.execute(interaction, client);
        } catch (error) {
            console.error(error);
            await replyWithError(interaction);
        }
        return;
    }

    if (interaction.isModalSubmit()) {
        let modal = client.modals.get(interaction.customId);

        if (!modal) {
            for (const [key, handler] of client.modals) {
                if (interaction.customId.startsWith(key)) {
                    modal = handler;
                    break;
                }
            }
        }

        if (!modal) return;

        try {
            await modal.execute(interaction);
        } catch (err) {
            console.error(err);
            await replyWithError(interaction);
        }
        return;
    }

    if (interaction.isAutocomplete()) {
        await autocompleteHandler.handle(interaction, client);
        return;
    }

    if (interaction.isButton() || interaction.isStringSelectMenu()) {
        const [prefix, roleId] = interaction.customId.split(':');

        // Buttons/dropdowns whose custom ID starts with a command name (e.g. "history:...") belong to that command.
        const owner = interaction.client.commands.get(prefix);
        const handler = interaction.isButton() ? owner?.handleButton : owner?.handleSelect;
        if (handler) {
            try {
                await handler.call(owner, interaction);
            } catch (err) {
                console.error(`[button:${prefix}]`, err);
                await replyWithError(interaction);
            }
            return;
        }

        if (!interaction.isButton() || prefix !== 'rr' || !interaction.inGuild()) return;

        try {
            await handleRoleButton(interaction, roleId);
        } catch (err) {
            console.error('[reaction roles]', err);
            await replyWithError(interaction);
        }
    }
});

client.on(Events.MessageCreate, safe('messageCreate', async message => {
    await antiReplyHandler.handle(client, message);
    await handleQuickTag(message);
}));

client.once(Events.ClientReady, c => {
    console.log(`Logged in as ${c.user.username}`);
    startChristmasStatus(c);
    startTempBanWatcher(c);
    startNotifyPoller(c);
});

(async () => {
    // Connect to MongoDB first so commands never run against a database that isn't there yet.
    try {
        await mongoose.connect(mongoUri);
        console.log('MongoDB connected.');
    } catch (err) {
        console.error('MongoDB connection failed:', err);
        process.exit(1);
    }

    await client.login(token);
})();

module.exports = client;
