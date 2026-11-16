const {
    SlashCommandBuilder,
    MessageFlags,
} = require("discord.js");
const BanSyncNetwork = require("../../schemas/bansync/BanSyncNetwork");
const { nanoid } = require("nanoid");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("bansync")
        .setDescription("Manage ban sync networks (Bot Owner only)")
        .addSubcommand((sub) =>
            sub
                .setName("create")
                .setDescription("Create a new ban sync network")
                .addStringOption((opt) =>
                    opt.setName("name").setDescription("Network name").setRequired(true)
                )
        )
        .addSubcommand((sub) =>
            sub
                .setName("addserver")
                .setDescription("Add a server to a network")
                .addStringOption((opt) =>
                    opt
                        .setName("networkid")
                        .setDescription("Network ID")
                        .setRequired(true)
                )
                .addStringOption((opt) =>
                    opt
                        .setName("guildid")
                        .setDescription("Guild ID to add")
                        .setRequired(true)
                )
                .addStringOption((opt) =>
                    opt
                        .setName("logchannel")
                        .setDescription("Log channel ID in that guild (optional)")
                )
        )
        .addSubcommand((sub) =>
            sub
                .setName("removeserver")
                .setDescription("Remove a server from a network")
                .addStringOption((opt) =>
                    opt
                        .setName("networkid")
                        .setDescription("Network ID")
                        .setRequired(true)
                )
                .addStringOption((opt) =>
                    opt
                        .setName("guildid")
                        .setDescription("Guild ID to remove")
                        .setRequired(true)
                )
        )
        .addSubcommand((sub) =>
            sub
                .setName("list")
                .setDescription("List all networks or servers in a network")
                .addStringOption((opt) =>
                    opt
                        .setName("networkid")
                        .setDescription("Network ID (optional, lists servers in network)")
                )
        )
        .addSubcommand((sub) =>
            sub
                .setName("delete")
                .setDescription("Delete a ban sync network entirely")
                .addStringOption((opt) =>
                    opt
                        .setName("networkid")
                        .setDescription("Network ID")
                        .setRequired(true)
                )
        )
        .addSubcommand((sub) =>
            sub
                .setName("setlog")
                .setDescription("Set or update the log channel for a guild in a network")
                .addStringOption((opt) =>
                    opt
                        .setName("networkid")
                        .setDescription("Network ID")
                        .setRequired(true)
                )
                .addStringOption((opt) =>
                    opt
                        .setName("guildid")
                        .setDescription("Guild ID")
                        .setRequired(true)
                )
                .addStringOption((opt) =>
                    opt
                        .setName("logchannel")
                        .setDescription("New log channel ID")
                        .setRequired(true)
                )
        ),

    async execute(interaction, client) {

        const ownerId = `1144561934025379881`;
        // me only lol
        if (interaction.user.id !== ownerId) {
            return interaction.reply({
                content: "Only the bot owner can use this command.",
                flags: MessageFlags.Ephemeral,
            });
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const sub = interaction.options.getSubcommand();

        if (sub === "create") {
            const name = interaction.options.getString("name");
            const id = nanoid(10);
            await BanSyncNetwork.create({ networkId: id, name, guilds: [] });
            return interaction.editReply(
                `Network **${name}** created!\nNetwork ID: \`${id}\``
            );
        }

        if (sub === "addserver") {
            const networkId = interaction.options.getString("networkid");
            const guildId = interaction.options.getString("guildid");
            const logChannelId = interaction.options.getString("logchannel") || null;

            const network = await BanSyncNetwork.findOne({ networkId });
            if (!network)
                return interaction.editReply("Network not found.");

            const alreadyIn = network.guilds.some((g) => g.guildId === guildId);
            if (alreadyIn)
                return interaction.editReply("That server is already in this network.");

            const guild = client.guilds.cache.get(guildId);
            if (!guild)
                return interaction.editReply(
                    "Bot is not in that server or cannot find it."
                );

            network.guilds.push({ guildId, logChannelId });
            await network.save();

            return interaction.editReply(
                `Added **${guild.name}** (\`${guildId}\`) to network **${network.name}**.`
            );
        }

        if (sub === "removeserver") {
            const networkId = interaction.options.getString("networkid");
            const guildId = interaction.options.getString("guildid");

            const network = await BanSyncNetwork.findOne({ networkId });
            if (!network) return interaction.editReply("Network not found.");

            const before = network.guilds.length;
            network.guilds = network.guilds.filter((g) => g.guildId !== guildId);
            if (network.guilds.length === before)
                return interaction.editReply("️That server wasn't in the network.");

            await network.save();
            return interaction.editReply(`Removed \`${guildId}\` from network **${network.name}**.`);
        }

        if (sub === "list") {
            const networkId = interaction.options.getString("networkid");

            if (!networkId) {
                const all = await BanSyncNetwork.find();
                if (!all.length) return interaction.editReply("No networks exist yet.");
                const desc = all
                    .map((n) => `**${n.name}** — \`${n.networkId}\` — ${n.guilds.length} server(s)`)
                    .join("\n");
                return interaction.editReply(`**All Networks:**\n${desc}`);
            }

            const network = await BanSyncNetwork.findOne({ networkId });
            if (!network) return interaction.editReply("Network not found.");

            const desc = network.guilds.length
                ? network.guilds
                    .map((g) => {
                        const guild = client.guilds.cache.get(g.guildId);
                        return `• ${guild ? guild.name : "Unknown"} (\`${g.guildId}\`) — Log: ${g.logChannelId ? `<#${g.logChannelId}>` : "None"}`;
                    })
                    .join("\n")
                : "No servers in this network yet.";

            return interaction.editReply(`**Network: ${network.name}**\n${desc}`);
        }

        if (sub === "delete") {
            const networkId = interaction.options.getString("networkid");
            const network = await BanSyncNetwork.findOneAndDelete({ networkId });
            if (!network) return interaction.editReply("Network not found.");
            return interaction.editReply(`Network **${network.name}** deleted.`);
        }

        if (sub === "setlog") {
            const networkId = interaction.options.getString("networkid");
            const guildId = interaction.options.getString("guildid");
            const logChannelId = interaction.options.getString("logchannel");

            const network = await BanSyncNetwork.findOne({ networkId });
            if (!network) return interaction.editReply("Network not found.");

            const entry = network.guilds.find((g) => g.guildId === guildId);
            if (!entry) return interaction.editReply("That server isn't in this network.");

            entry.logChannelId = logChannelId;
            await network.save();
            return interaction.editReply(`Log channel updated for \`${guildId}\`.`);
        }
    },
};