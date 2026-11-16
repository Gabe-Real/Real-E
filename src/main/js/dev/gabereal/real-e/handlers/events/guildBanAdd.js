const { EmbedBuilder, AuditLogEvent } = require("discord.js");
const BanSyncNetwork = require("../../schemas/bansync/BanSyncNetwork");
const BanSyncLog = require("../../schemas/bansync/BanSyncLog");

module.exports = {
    name: "guildBanAdd",
    async execute(ban, client) {
        const { guild, user } = ban;

        const network = await BanSyncNetwork.findOne({
            "guilds.guildId": guild.id,
        });
        if (!network) return;

        await new Promise((r) => setTimeout(r, 1000));
        let reason = "No reason provided";
        try {
            const logs = await guild.fetchAuditLogs({
                type: AuditLogEvent.MemberBanAdd,
                limit: 5,
            });
            const entry = logs.entries.find((e) => e.target?.id === user.id);
            if (entry) reason = entry.reason || reason;
        } catch {}

        const otherGuilds = network.guilds.filter((g) => g.guildId !== guild.id);
        const syncedTo = [];

        for (const entry of otherGuilds) {
            const targetGuild = client.guilds.cache.get(entry.guildId);
            if (!targetGuild) continue;

            try {
                const existing = await targetGuild.bans.fetch(user.id).catch(() => null);
                if (existing) continue;

                await targetGuild.members.ban(user.id, {
                    reason: `[Ban Sync | Origin: ${guild.name}] ${reason}`.slice(0, 512), // audit log reason limit
                });
                syncedTo.push(entry.guildId);

                if (entry.logChannelId) {
                    const logChannel = targetGuild.channels.cache.get(entry.logChannelId);
                    if (logChannel) {
                        const embed = new EmbedBuilder()
                            .setTitle("🔨 Ban Synced")
                            .setColor(0xe74c3c)
                            .addFields(
                                { name: "User", value: `${user.tag} (\`${user.id}\`)`, inline: true },
                                { name: "Origin Server", value: guild.name, inline: true },
                                { name: "Reason", value: reason.slice(0, 1024) }
                            )
                            .setThumbnail(user.displayAvatarURL())
                            .setTimestamp();
                        logChannel.send({ embeds: [embed] }).catch(() => {});
                    }
                }
            } catch (err) {
                console.error(`[BanSync] Failed to ban ${user.id} in ${entry.guildId}:`, err);
            }
        }

        if (syncedTo.length > 0) {
            await BanSyncLog.create({
                networkId: network.networkId,
                bannedUserId: user.id,
                reason,
                originGuildId: guild.id,
                syncedTo,
                type: "ban",
            });
        }
    },
};