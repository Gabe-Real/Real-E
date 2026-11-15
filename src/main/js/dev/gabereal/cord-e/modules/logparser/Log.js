const { PLUGIN_PLATFORMS, BUILTIN_MODS } = require('./constants');

/**
 * Everything we've worked out about one log. Parsers fill in facts (loader, mods, environment),
 * processors look at those facts and the raw text, and add messages about problems.
 */
class Log {
    constructor(content, source) {
        this.content = content.replace(/\r\n/g, '\n');
        this.source = source;            // File name or link it came from
        this.environment = {};           // cpu, gpu, os, javaVersion, jvmVersion, jvmArgs, gameMemory, systemMemory, shaderpack
        this.launcher = null;            // { name, version }
        this.minecraftVersion = null;
        this.loaders = new Map();        // loader id -> version
        this.mods = new Map();           // mod id -> { id, name, version, file }
        this.messages = [];
        this.sections = [];              // extra blocks: { title, text }
        this.hasProblems = false;
        this.abortReason = null;
        this.fromCommand = false;        // true when parsed via the right-click command
    }

    get aborted() {
        return this.abortReason !== null;
    }

    get isCrashReport() {
        return this.content.includes('---- Minecraft Crash Report ----') || this.content.startsWith('---- Crashed! ----');
    }

    get isPluginPlatform() {
        return PLUGIN_PLATFORMS.some(p => this.loaders.has(p));
    }

    /** Stop processing this log and show only this explanation. */
    abort(reason) {
        this.abortReason = reason;
    }

    addMessage(message) {
        this.messages.push(message);
    }

    /** Add a message and mark the log as having problems (turns the result yellow). */
    addProblem(message) {
        this.messages.push(message);
        this.hasProblems = true;
    }

    setLoader(loader, version = 'Unknown') {
        this.loaders.set(loader, version);
    }

    getLoader(loader) {
        return this.loaders.get(loader) ?? null;
    }

    addMod(mod) {
        if (!mod.id) return;
        this.mods.set(mod.id, mod);
    }

    getMod(id) {
        return this.mods.get(id) ?? null;
    }

    /** Mods the user actually installed (no Minecraft, Java or the loader itself). */
    get userMods() {
        return [...this.mods.values()].filter(m => !BUILTIN_MODS.has(m.id));
    }

    /** Worth showing a result for? Same rule as Cozy: only if we actually found something. */
    get isInteresting() {
        return this.aborted || this.hasProblems || this.messages.length > 0 || this.minecraftVersion !== null || this.mods.size > 0;
    }
}

module.exports = Log;
