const {
    SlashCommandBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    MessageFlags,
} = require('discord.js');

// Components V2 messages allow 4000 characters of text in total, across all text displays.
const MAX_TEXT = 4000;

function truncate(text, max) {
    return text.length > max ? text.slice(0, max - 1) + '…' : text;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('lookup')
        .setDescription('Various lookup utilities (thesaurus, definitions, steam ect...)')
        .addSubcommand(sub =>
            sub
                .setName('thesaurus')
                .setDescription('Get 3 synonyms and antonyms for a word.')
                .addStringOption(opt =>
                    opt
                        .setName('query')
                        .setDescription('The word to search for.')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName('definition')
                .setDescription('Look up the definition of a word.')
                .addStringOption(opt =>
                    opt
                        .setName('query')
                        .setDescription('The word you\'re looking for.')
                        .setRequired(true)
                )
        ),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();

        if (sub === 'thesaurus') {
            const word = interaction.options.getString('query');

            const replyComponents = [
                new TextDisplayBuilder().setContent(`🔍 Looking up synonyms and antonyms for **${word}**...`)
            ]
            await interaction.reply({
                components: replyComponents,
                flags: MessageFlags.IsComponentsV2,
            });

            try {
                const [synonymsRes, antonymsRes] = await Promise.all([
                    fetch(`https://api.datamuse.com/words?rel_syn=${encodeURIComponent(word)}&max=3`),
                    fetch(`https://api.datamuse.com/words?rel_ant=${encodeURIComponent(word)}&max=3`),
                ]);
                const synonyms = await synonymsRes.json();
                const antonyms = await antonymsRes.json();

                const synonymList =
                    synonyms.length > 0
                        ? '### Synonyms:\n' + synonyms.map(w => `• ${w.word}`).join('\n')
                        : '';
                const antonymList =
                    antonyms.length > 0
                        ? '### Antonyms:\n' + antonyms.map(w => `• ${w.word}`).join('\n')
                        : '';


                const componentsResponse = [
                    new TextDisplayBuilder().setContent(`## 📚 Thesaurus results for: '${word}'`),
                    new SeparatorBuilder().setDivider(true),
                    new TextDisplayBuilder().setContent(`${synonymList}\n${antonymList}`.trim() || 'No synonyms or antonyms found.'),
                ];

                await interaction.editReply({components: componentsResponse, flags: MessageFlags.IsComponentsV2});
            } catch (error) {
                console.error('Thesaurus API error:', error);

                const fallbackComponents = [
                    new TextDisplayBuilder().setContent('<:cross:1386317251413671986> An error occurred while fetching thesaurus data. Please try again later.')
                ]
                await interaction.editReply({
                    components: fallbackComponents,
                    flags: MessageFlags.IsComponentsV2,
                });
            }
        } else if (sub === 'definition') {
            const word = interaction.options.getString('query');
            const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`;


            try {
                const response = await fetch(url);
                if (!response.ok) {
                    return interaction.reply({ content: `No definitions found for **${word}**.`, flags: MessageFlags.Ephemeral });
                }

                const data = await response.json();
                const definitionData = data[0];


                let pronunciation = '';
                if (definitionData.phonetics && definitionData.phonetics.length) {
                    let pronunciationRaw = definitionData.phonetics.find(p => p.text)?.text || '';
                    pronunciation = pronunciationRaw.replace(/^[/\[]|[/\]]$/g, '');
                }
                if (!pronunciation && definitionData.phonetic) {
                    pronunciation = definitionData.phonetic.replace(/^[/\[]|[/\]]$/g, '');
                }

                const definitions = definitionData.meanings
                    .map(meaning => {
                        const defs = meaning.definitions
                            .map((def, index) => ` ${index + 1}. ${def.definition}`)
                            .join('\n');
                        return `### Word class: ${meaning.partOfSpeech}\n${defs}`;
                    })
                    .join('\n');


                const wordTitle =
                    pronunciation
                        ? `## 📚 Definition of the word: '${definitionData.word}  /  ${pronunciation}'`
                        : `## 📚 Definition of the word '${definitionData.word}'`;

                // Common words have long definition lists; trim so the message stays under Discord's limit.
                const components = [
                    new TextDisplayBuilder().setContent(wordTitle),
                    new SeparatorBuilder().setDivider(true),
                    new TextDisplayBuilder().setContent(truncate(definitions, MAX_TEXT - wordTitle.length)),
                ];

                await interaction.reply({ components: components, flags: MessageFlags.IsComponentsV2 });

            } catch (err) {
                console.error(err);
                await interaction.reply({ content: 'There was an error fetching the definition. Please try again later.', flags: MessageFlags.Ephemeral });
            }
        }
    },
};