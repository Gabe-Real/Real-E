const BannedReaction = require('../../schemas/bannedreact/bannedreact');
const {EmbedBuilder} = require("discord.js");
const ModLog = require("../../schemas/logging/modlogs");

module.exports = {
    name: 'messageReactionAdd',
    async execute(reaction, user) {

        if (reaction.partial) {
            try {
                await reaction.fetch();
            } catch (error) {
                console.error('Something went wrong when fetching the reaction:', error);
                return;
            }
        }

        if (user.partial) {
            try {
                await user.fetch();
            } catch (error) {
                console.error('Something went wrong when fetching the user:', error);
                return;
            }
        }

        if (!reaction.message.guild || user.bot) return;

        try {
            const doc = await BannedReaction.findOne({ guildId: reaction.message.guild.id });
            if (!doc) return;

            const emojiKey = reaction.emoji.id ? `<:${reaction.emoji.name}:${reaction.emoji.id}>` : reaction.emoji.name;

            const isBanned = doc.banned.some(e => e.emoji === emojiKey || e.emoji === reaction.emoji.name || e.emoji === reaction.emoji.id);
            if (!isBanned) return;

            await reaction.users.remove(user.id);
            const member = await reaction.message.guild.members.fetch(user.id).catch(() => null);

            const modlogData = await ModLog.findOne({ guildId: reaction.message.guild.id });
            if (modlogData) {
                const modlogChannel = await reaction.message.guild.channels.fetch(modlogData.modlogChannelId).catch(() => null); // Use reaction.message.guild instead of interaction.guild
                if (modlogChannel?.isTextBased()) {
                    const embed = new EmbedBuilder()
                        .setTitle('❗ User Banned Reacted')
                        .setColor('Yellow')
                        .addFields(
                            { name: 'User', value: `${user.username} (${user.id})`, inline: false },
                            { name: 'Emoji', value: emojiKey, inline: false },
                            { name: 'Channel', value: `${reaction.message.channel.name} (${reaction.message.channel.id})`, inline: false },
                            { name: 'Message', value: `[Jump to Message](${reaction.message.url})`, inline: false }
                        )
                        .setTimestamp();

                    await modlogChannel.send({ embeds: [embed] });
                }
            }

            if (member && member.moderatable) {
                try {
                    await user.send(`You tried to use a banned reaction in **${reaction.message.guild.name}**, so it was removed. `+
                        `Please refrain from using banned reactions on messages in this server or action will be taken.`);
                } catch {

                }
            }
        } catch (err) {
            console.error('Banned reaction handler error:', err);
        }
    }
};