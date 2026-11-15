const { Order } = require('../../constants');

// Fabric/Quilt: a mod's startup code threw an error.
const ERROR = /Could not execute entrypoint stage '(.+?)' due to errors, provided by '(.+?)'(?: at '(.+?)')?!/i;

module.exports = {
    id: 'entrypoint-stage-error',
    order: Order.Earlier,
    process(log) {
        const match = log.content.match(ERROR);
        if (!match) return;
        log.addProblem(
            `**The \`${match[1]}\` startup code of mod \`${match[2]}\` failed**${match[3] ? `\n- \`${match[3]}\`` : ''}\n` +
            `**What this means:** \`${match[2]}\` crashed while the game was starting. It\'s usually a missing dependency or a version mismatch ` +
            `(check the other messages here). Try updating \`${match[2]}\`, or remove it to confirm it\'s the cause.`
        );
    },
};
