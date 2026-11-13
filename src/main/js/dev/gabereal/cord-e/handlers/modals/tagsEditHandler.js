const { MessageFlags } = require('discord.js');
const Tag = require('../../schemas/tags/tags');

module.exports = {
    customId: 'tag:edit:',

    async execute(interaction) {
        const id = interaction.customId;
        // slice rather than split(':') so tag names containing ':' still work
        const name = id.slice('tag:edit:'.length);
        const content = interaction.fields.getTextInputValue('tag_content');

        const tag = await Tag.findOneAndUpdate(
            { guildId: interaction.guild.id, name },
            { content },
            { new: true }
        );

        if (!tag) {
            return interaction.reply({ content: `Tag \`${name}\` not found.`, flags: MessageFlags.Ephemeral });
        }

        return interaction.reply({ content: `✏️ Tag \`${name}\` updated.`, flags: MessageFlags.Ephemeral });
    }
};