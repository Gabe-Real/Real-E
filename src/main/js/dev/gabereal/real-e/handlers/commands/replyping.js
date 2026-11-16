const AntiReply = require('../../schemas/replyping/replyping');
const ModLog = require("../../schemas/logging/modlogs");
const { EmbedBuilder, MessageReferenceType } = require("discord.js");

module.exports = {
    name: 'replyping',

    async handle(client, message) {
        if (!message.guild || message.author.bot) return;
        if (!message.reference || !message.reference.messageId) return;

        // Only act on actual replies. Forwarded messages also carry a reference, but it points to a
        // message in another channel — fetching it here would always throw "Unknown Message".
        if (MessageReferenceType && message.reference.type != null &&
            message.reference.type !== MessageReferenceType.Default) {
            return;
        }

        try {
            const doc = await AntiReply.findOne({ guildId: message.guild.id });
            if (!doc || doc.protectedUsers.length === 0) return;

            if (doc.exemptChannels && doc.exemptChannels.includes(message.channel.id)) return;

            // The replied-to message may have been deleted. Bail quietly instead of throwing.
            const repliedMessage = await message.channel.messages
                .fetch(message.reference.messageId)
                .catch(() => null);
            if (!repliedMessage) return;

            const protectedUser = doc.protectedUsers.find(u => u.userId === repliedMessage.author.id);
            if (!protectedUser) return;

            if (message.mentions.users.has(repliedMessage.author.id)) {
                const member = await message.guild.members.fetch(message.author.id).catch(() => null);
                if (!member) return;

                if (doc.exemptRoles && doc.exemptRoles.length > 0) {
                    const hasExemptRole = member.roles.cache.some(role => doc.exemptRoles.includes(role.id));
                    if (hasExemptRole) return;
                }

                if (!member.moderatable) return;

                await member.timeout(protectedUser.timeout, `Reply pinged protected user (${repliedMessage.author.tag})`);

                await member.send(
                    `You have been timed out in **${message.guild.name}** for ${protectedUser.timeout / 60000} minutes ` +
                    `because you reply pinged **${repliedMessage.author.tag}**. Please do not reply ` +
                    `ping members who are not allowed to be.`
                ).catch(() => {});

                const modlogData = await ModLog.findOne({ guildId: message.guild.id });
                if (modlogData?.modlogChannelId) {
                    const modlogChannel = await message.guild.channels.fetch(modlogData.modlogChannelId).catch(() => null);
                    if (modlogChannel?.isTextBased()) {
                        const embed = new EmbedBuilder()
                            .setTitle('❗ User Reply Pinged')
                            .setColor('Yellow')
                            .addFields(
                                { name: 'User', value: `${member.user.username} (${member.id})`, inline: false },
                                { name: 'Reply Pinged', value: `${repliedMessage.author.username} (${repliedMessage.author.id})`, inline: false },
                                { name: 'Channel', value: `${message.channel.name} (${message.channel.id})`, inline: false },
                                { name: 'Timeout Duration', value: `${protectedUser.timeout / 60000} minutes`, inline: false }
                            )
                            .setTimestamp();

                        await modlogChannel.send({ embeds: [embed] }).catch(() => null);
                    }
                }
            }

        } catch (err) {
            console.error('Anti-reply system error:', err);
        }
    }
};