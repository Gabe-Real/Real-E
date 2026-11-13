const Tag = require('../../schemas/tags/tags');
const QuickPrefix = require('../../schemas/tags/quickTagsSchema');

async function quickTags(message) {
    try {
        // Ignore bots, including ourselves: a tag whose content starts with "<prefix><name>" would otherwise loop forever.
        if (!message.guild || message.author.bot) return;

        const config = await QuickPrefix.findOne({ guildId: message.guild.id });
        if (!config) return;

        const prefix = config.prefix;
        if (!message.content.startsWith(prefix)) return;

        const name = message.content.slice(prefix.length).trim().toLowerCase();
        if (!name) return;

        const tag = await Tag.findOne({ guildId: message.guild.id, name });
        if (!tag) return;

        // Anyone can trigger a quick tag, so don't let one ping @everyone/@here or roles.
        await message.channel.send({ content: tag.content.slice(0, 2000), allowedMentions: { parse: ['users'] } });
    } catch (err) {
        console.error('[QuickTag Error]', err);
    }
}

module.exports = { handleQuickTag: quickTags };