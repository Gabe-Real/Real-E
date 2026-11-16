const { Order, Launcher } = require('../../constants');

// Extra details that specific launchers write into their logs.
const capitalize = (s) => s.replace(/\b\w/g, c => c.toUpperCase());

const atlauncher = {
    id: 'launcher-atlauncher',
    order: Order.Early,
    predicate: (log) => log.launcher?.name === Launcher.ATLauncher,
    process(log) {
        const lines = [...log.content.matchAll(/Launching Minecraft with the following arguments \([^)]+\): \[([^\]]+)\]\n/gi)];
        const info = lines.at(-1)?.[1];
        if (!info) return;
        log.environment.jvmArgs = info.split(', -Djava.library.path')[0];
        const os = info.match(/-Dos\.name=(.+?), -/i)?.[1];
        if (os) log.environment.os = os;
    },
};

const mmcLike = {
    id: 'launcher-mmc-like',
    order: Order.Early,
    predicate: (log) => [Launcher.MultiMC, Launcher.Prism].includes(log.launcher?.name),
    process(log) {
        const java = log.content.match(/Checking Java version\.{3}\nJava is version ([^,]+), using ([\w\s(]+\)?) architecture, from ([^.]+)\./i);
        if (java) log.environment.jvmVersion = `Java ${java[1]}@${java[2]}, ${java[3]}`;

        const args = log.content.match(/Java Arguments:\n\[([^\]]+)\]/i);
        if (args) log.environment.jvmArgs = args[1];

        const libraries = log.content.split('\nLibraries:\n')[1]?.split('\nMods:')[0] ?? '';
        if (libraries.includes('linux')) log.environment.os = 'Linux';
        else if (libraries.includes('macos')) log.environment.os = 'MacOS';
        else if (libraries.includes('windows')) log.environment.os = 'Windows';
    },
};

const technic = {
    id: 'launcher-technic',
    order: Order.Early,
    predicate: (log) => log.launcher?.name === Launcher.Technic,
    process(log) {
        const java = log.content.match(/\] Java: ([^\n]+)\n/i);
        if (java) log.environment.jvmVersion = `Java ${java[1]}`;
        const args = log.content.match(/\] Running .+? (-.+?) -Djava\.library\.path/i);
        if (args) log.environment.jvmArgs = args[1];
        const os = log.content.match(/\] OS: ([^\n]+)\n/i);
        if (os) log.environment.os = capitalize(os[1]);
    },
};

module.exports = [atlauncher, mmcLike, technic];
