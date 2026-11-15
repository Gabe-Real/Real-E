const { Order } = require('../../constants');

// "compiled by a more recent version of the Java Runtime (class file version 65.0), this version ... up to 61.0"
const ERROR = /compiled by a more recent version of the Java Runtime \(class file version ([\d.]+)\), this version of the Java Runtime only recognizes class file versions up to ([\d.]+)/gi;

// Class file version -> Java version (52 = Java 8, 65 = Java 21, ...)
const javaFor = (classVersion) => (classVersion >= 49 ? String(classVersion - 44) : null);

module.exports = {
    id: 'java-class-file-version',
    order: Order.Earlier,
    process(log) {
        const matches = [...log.content.matchAll(ERROR)];
        if (!matches.length) return;

        const current = Math.floor(Number(matches[0][2]));
        const required = Math.max(...matches.map(m => Math.floor(Number(m[1]))));

        log.addProblem(
            '**It looks like you need to update Java.** ' +
            `You have Java \`${javaFor(current) ?? `class version ${current}`}\` installed, ` +
            `but you need Java \`${javaFor(required) ?? `class version ${required}`}\` or later.`
        );
    },
};
