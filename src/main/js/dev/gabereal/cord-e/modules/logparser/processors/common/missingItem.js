const { Order } = require('../../constants');

// Classes, methods or fields that weren't found: almost always a missing (or wrong version of a) dependency.
const CLASS = /java\.lang\.ClassNotFoundException: ((?:[^\n.]+[./])*)([^\n.()]+)/gi;
// 'void net.example.api.Registry.register(java.lang.String)' -> package net.example.api., class Registry
const METHOD = /java\.lang\.NoSuchMethodError: '[^'\n]*? ((?:[\w$]+[./])+)([\w$]+)\.([\w$<>]+)\(/gi;
const FIELD = /java\.lang\.NoSuchFieldError: Class ((?:[^\n.]+[./])*)([^\n.()]+) does not have member field '([^\n]+)'/gi;
const NO_CLASS_DEF = /java\.lang\.NoClassDefFoundError: (?!Could not initialize)((?:[^\n.]+[./])*)([^\n.()\s]+)/gi;

// JDK/library packages that aren't useful to report.
const IGNORED = ['org.jetbrains.', 'java.', 'javax.', 'kotlin.', 'sun.', 'com.intellij.', 'com.google.', 'jdk.', 'org.slf4j.', 'org.apache.'];

module.exports = {
    id: 'missing-jvm-elements',
    order: Order.Default,
    process(log) {
        const packages = new Set();
        const topLevel = new Set();

        const add = (pkg, cls) => {
            const name = pkg.replace(/\//g, '.');
            if (!name) topLevel.add(cls);
            else if (!IGNORED.some(p => name.startsWith(p))) packages.add(name);
        };

        for (const m of log.content.matchAll(CLASS)) add(m[1], m[2]);
        for (const m of log.content.matchAll(NO_CLASS_DEF)) add(m[1], m[2]);
        for (const m of log.content.matchAll(METHOD)) add(m[1], m[2]);
        for (const m of log.content.matchAll(FIELD)) add(m[1], m[2]);

        if (packages.size) {
            log.addProblem(
                '**Some packages did not contain all required classes, fields, or methods. This is usually caused by a missing dependency.**\n' +
                [...packages].slice(0, 10).map(p => `- \`${p}\``).join('\n')
            );
        }
        if (topLevel.size) {
            log.addProblem(
                '**Some top-level classes were not found or were missing fields or methods. This is usually caused by a missing dependency.**\n' +
                [...topLevel].slice(0, 10).map(c => `- \`${c}\``).join('\n')
            );
        }
    },
};
