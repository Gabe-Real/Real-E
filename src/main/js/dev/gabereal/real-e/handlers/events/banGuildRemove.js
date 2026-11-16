const { EmbedBuilder } = require("discord.js");
const BanSyncNetwork = require("../../schemas/bansync/BanSyncNetwork");
const BanSyncLog = require("../../schemas/bansync/BanSyncLog");

module.exports = {
    name: "guildBanRemove",
    async execute(ban, client) {
        const {guild, user} = ban;

        const network = await BanSyncNetwork.findOne({
            "guilds.guildId": guild.id,
        });
        if (!network) return;

        const otherGuilds = network.guilds.filter((g) => g.guildId !== guild.id);
        const syncedTo = [];

        for (const entry of otherGuilds) {
            const targetGuild = client.guilds.cache.get(entry.guildId);
            if (!targetGuild) continue;

            try {
                const existing = await targetGuild.bans.fetch(user.id).catch(() => null);
                if (!existing) continue;

                await targetGuild.members.unban(
                    user.id,
                    `[Ban Sync | Origin: ${guild.name}] Unban synced`
                );
                syncedTo.push(entry.guildId);

                if (entry.logChannelId) {
                    const logChannel = targetGuild.channels.cache.get(entry.logChannelId);
                    if (logChannel) {
                        const embed = new EmbedBuilder()
                            .setTitle("✅ Unban Synced")
                            .setColor(0x2ecc71)
                            .addFields(
                                {name: "User", value: `${user.username} (\`${user.id}\`)`, inline: true},
                                {name: "Origin Server", value: guild.name, inline: true}
                            )
                            .setThumbnail(user.displayAvatarURL())
                            .setTimestamp();
                        logChannel.send({embeds: [embed]}).catch(() => {
                        });
                    }
                }
            } catch (err) {
                // Only log actual unexpected errors, not "not banned here"
                if (err.code !== 10026) {
                    console.error(`[BanSync] Failed to unban ${user.id} in ${entry.guildId}:`, err);
                }
            }
        }

        // One log entry per unban (this used to run inside the loop, writing a duplicate per guild).
        if (syncedTo.length > 0) {
            await BanSyncLog.create({
                networkId: network.networkId,
                bannedUserId: user.id,
                reason: "Unban",
                originGuildId: guild.id,
                syncedTo,
                type: "unban",
            });
        }
    }
};