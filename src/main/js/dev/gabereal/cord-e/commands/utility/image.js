const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');

// subcommand -> [description, some-random-api filter endpoint, output file name]
const FILTERS = {
    blue: ['Get a nice blue version overlay on an avatar.', 'blue', 'blue.png'],
    blurple: ['Get a nice blurple overlay on an avatar.', 'blurple2', 'blurple.png'],
    green: ['Get a nice green overlay on an avatar.', 'green', 'green.png'],
    red: ['Get a nice red overlay on an avatar.', 'red', 'red.png'],
    greyscale: ['Greyscale an image.', 'greyscale', 'greyscale.png'],
    invert: ['Invert the colours of an image.', 'invert', 'inverted.png'],
    invertgreyscale: ['Invert the greyscale of an image.', 'invertgreyscale', 'invertgreyscale.png'],
    sepia: ['Get a nice sepia overlay on an avatar', 'sepia', 'sepia.png'],
};

const data = new SlashCommandBuilder()
    .setName('image')
    .setDescription('Image commands to customise pictures.');

for (const [name, [description]] of Object.entries(FILTERS)) {
    data.addSubcommand(sub =>
        sub
            .setName(name)
            .setDescription(description)
            .addUserOption(option =>
                option
                    .setName('user')
                    .setRequired(true)
                    .setDescription('The user to create the avatar for.'))
    );
}

module.exports = {
    data,

    async execute(interaction) {
        const [, endpoint, fileName] = FILTERS[interaction.options.getSubcommand()];
        await interaction.deferReply();

        const user = interaction.options.getUser('user') || interaction.user;
        const avatar = user.displayAvatarURL({ extension: 'png', size: 1024 });

        const response = await fetch(`https://api.some-random-api.com/canvas/filter/${endpoint}?avatar=${encodeURIComponent(avatar)}`)
            .catch(() => null);

        // Without this check, an API error page was uploaded as a broken .png.
        if (!response?.ok || !response.headers.get('content-type')?.startsWith('image/')) {
            return interaction.editReply({ content: 'The image service is unavailable right now. Please try again later.' });
        }

        const buffer = Buffer.from(await response.arrayBuffer());
        await interaction.editReply({ files: [new AttachmentBuilder(buffer, { name: fileName })] });
    }
};
