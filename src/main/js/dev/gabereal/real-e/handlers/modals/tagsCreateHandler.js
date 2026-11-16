const { MessageFlags } = require('discord.js');
const Tag = require('../../schemas/tags/tags');

module.exports = {
    customId: 'tag:create',

    async execute(interaction) {
        const name = interaction.fields.getTextInputValue('tag_name').trim().toLowerCase();
        const content = interaction.fields.getTextInputValue('tag_content');

        if (!name) {
            return interaction.reply({ content: "Tag name can't be empty.", flags: MessageFlags.Ephemeral });
        }

        const exists = await Tag.findOne({ guildId: interaction.guild.id, name });
        if (exists) {
            return interaction.reply({ content: `⚠️ Tag \`${name}\` already exists.`, flags: MessageFlags.Ephemeral });
        }

        await Tag.create({
            guildId: interaction.guild.id,
            name,
            content,
            createdBy: interaction.user.id
        });

        return interaction.reply({ content: `📌 Tag \`${name}\` created!`, flags: MessageFlags.Ephemeral });
    }
};