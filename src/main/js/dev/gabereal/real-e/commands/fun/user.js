const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('user')
        .setDescription('Displays detailed information about a user.')
        .addUserOption(option =>
            option.setName('target')
                .setDescription('The user to get info about')
                .setRequired(false)
        ),

    async execute(interaction) {
        const user = interaction.options.getUser('target') || interaction.user;
        const avatar = user.displayAvatarURL({ extension: 'png', size: 256 });

        let member;
        try {
            member = await interaction.guild.members.fetch(user.id);
        } catch {
            member = null;
        }

        const viewAvatar = new ButtonBuilder()
            .setLabel('🖼️ View Avatar')
            .setURL(avatar)
            .setStyle(ButtonStyle.Link);

        const mainRow = new ActionRowBuilder().addComponents(viewAvatar);

        const embed = createUserEmbed(user, member);

        await interaction.reply({
            embeds: [embed],
            components: [mainRow]
        });
    },

    async component(interaction) {
        if (interaction.customId !== 'user:view_my_profile') return;

        const user = interaction.user;

        let member;
        try {
            member = await interaction.guild.members.fetch(user.id);
        } catch {
            member = null;
        }

        const embed = createUserEmbed(user, member, true);

        await interaction.reply({
            embeds: [embed],
            flags: MessageFlags.Ephemeral
        });
    }
};

// Shared embed builder
function createUserEmbed(user, member, isSelf = false) {
    const avatar = user.displayAvatarURL({ extension: 'png', size: 256 });
    return new EmbedBuilder()
        .setTitle(isSelf ? '__Your Profile__' : '__User Information__')
        .setThumbnail(avatar)
        .addFields(
            { name: '**⏰ Username**', value: user.username, inline: true },
            { name: '**🪪 ID**:', value: `\`${user.id}\``, inline: true },
            { name: '**📢 Mention**', value: `<@${user.id}>`, inline: true },
            { name: '**📆 Created**', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:F>`, inline: true },
            { name: '**🏷️ Nickname**', value: member?.nickname ?? '*None*', inline: true },
            { name: '**🧩 Joined**', value: member ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:F>` : '*N/A*', inline: true },
            { name: '**🎭 Highest Role**', value: member?.roles?.highest?.toString() ?? '*N/A*', inline: true },
            { name: '**🎓 Role Count**', value: member ? `${member.roles.cache.size - 1}` : '*N/A*', inline: true },
            { name: '**🚀 Boosting Since**', value: member?.premiumSince ? `<t:${Math.floor(member.premiumSince / 1000)}:F>` : 'Not Boosting this server :(', inline: true }
        );
}

