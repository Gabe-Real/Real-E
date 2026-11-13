const { MessageFlags } = require('discord.js');

module.exports = {
    customId: 'set_slowmode_modal',

    async execute(interaction) {
        const input = interaction.fields.getTextInputValue('slowmode_time_input').trim();
        const channel = interaction.channel;

        if (typeof channel?.setRateLimitPerUser !== 'function') {
            return interaction.reply({ content: 'Slowmode can\'t be set in this channel.', flags: MessageFlags.Ephemeral });
        }

        // Convert input to seconds
        let seconds = 0;
        const match = input.match(/^(\d+)(s|m|h)?$/i);

        if (!match) {
            return interaction.reply({
                content: 'Invalid time format. Use values like 10s, 5m, 1h, or 0.',
                flags: MessageFlags.Ephemeral
            });
        }

        const value = parseInt(match[1]);
        const unit = match[2]?.toLowerCase() || 's';

        if (unit === 's') seconds = value;
        else if (unit === 'm') seconds = value * 60;
        else if (unit === 'h') seconds = value * 3600;

        if (seconds > 21600) {
            return interaction.reply({
                content: 'The maximum slowmode is 6 hours (21600 seconds).',
                flags: MessageFlags.Ephemeral
            });
        }

        try {
            await channel.setRateLimitPerUser(seconds, `Set by ${interaction.user.tag}`);
            await interaction.reply({
                content: `📝 Successfully set slowmode to **${seconds === 0 ? 'off' : `${seconds} seconds`}**.`
            });
        } catch (err) {
            console.error(err);
            await interaction.reply({
                content: 'Failed to set slowmode. Do I have permission?',
                flags: MessageFlags.Ephemeral
            });
        }
    }
};
