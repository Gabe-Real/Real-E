const { Order } = require('../constants');

// System details from crash reports (and a few latest.log lines).
const find = (log, re) => log.content.match(re)?.[1]?.trim() ?? null;

module.exports = {
    id: 'environment',
    order: Order.Default,

    process(log) {
        const env = log.environment;

        const cpu = find(log, /\tProcessor Name: ([^\n]+)\n/i);
        if (cpu) {
            const cores = find(log, /\tNumber of physical CPUs: (\d+)/i);
            const threads = find(log, /\tNumber of logical CPUs: (\d+)/i);
            const extra = [cores && `${cores} cores`, threads && `${threads} threads`].filter(Boolean).join(', ');
            env.cpu = extra ? `${cpu} (${extra})` : cpu;
        }

        env.gpu = find(log, /\tBackend API: ([^\n]+)/i) ?? find(log, /\tGraphics card #0 name: ([^\n]+)/i);
        env.shaderpack = find(log, /\tLoaded Shaderpack: ([^\n]+)/i) ?? find(log, /\[Iris\] Using shaderpack: ([^\n]+)/i);
        env.os ??= find(log, /\tOperating System: ([^\n]+)/i);
        env.javaVersion ??= find(log, /\tJava Version: ([^\n]+)/i);
        env.jvmArgs ??= find(log, /\tJVM Flags: \d+ total; ([^\n]+)/i);

        const memory = log.content.match(/\tMemory: \d+ bytes \((\d+) MiB\) \/ \d+ bytes \((\d+) MiB\) up to \d+ bytes \((\d+) MiB\)/i);
        if (memory) env.gameMemory = `${memory[1]} MiB / ${memory[2]} MiB (${memory[3]} MiB max)`;

        const slots = [...log.content.matchAll(/\tMemory slot #\d+ capacity \(MB\): ([\d.]+)/gi)];
        if (slots.length) env.systemMemory = `${Math.round(slots.reduce((sum, m) => sum + Number(m[1]), 0))} MiB`;
    },
};
