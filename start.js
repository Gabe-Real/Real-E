// start.js: deploys slash commands, then starts the bot.
require('dotenv').config({ quiet: true });
const { execFileSync } = require('node:child_process');
const path = require('node:path');

const args = [path.join(__dirname, 'deploy-commands.js')];
if (process.env.DEPLOY_GLOBAL === 'true') args.push('--global');

try {
    execFileSync(process.execPath, args, { stdio: 'inherit', cwd: __dirname });
} catch (err) {
    // If deploying fails, still start the bot rather than leaving it offline
    console.error('[start] Command deploy failed, starting bot anyway:', err.message);
}

require('./index.js');