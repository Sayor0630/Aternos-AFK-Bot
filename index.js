const mc = require('minecraft-protocol');
const mineflayer = require('mineflayer');
const cmd = require('mineflayer-cmd').plugin;
const fs = require('fs');

// Redirect stderr to filter "deprecated"
const originalStderrWrite = process.stderr.write;
process.stderr.write = function(chunk, encoding, callback) {
    if (typeof chunk === 'string' && chunk.includes('deprecated')) return;
    originalStderrWrite.apply(process.stderr, arguments);
};

// Load configuration from config.json
let data;
try {
    const rawdata = fs.readFileSync('config.json');
    data = JSON.parse(rawdata);
} catch (error) {
    console.error('Error reading config.json:', error.message);
    process.exit(1);
}

const hostString = data["ip"];
const username = data["name"];
const nightskip = data["auto-night-skip"];

let bot;

function checkServerStatus() {
    console.log(`Checking server status for ${hostString}...`);
    let hostname, port;
    try {
        [hostname, port] = hostString.includes(':') ? hostString.split(':') : [hostString, 25565];
        port = parseInt(port);
        if (!hostname || isNaN(port)) throw new Error('Invalid host or port format');
    } catch (error) {
        console.error('Failed to parse host/port:', error.message);
        process.exit(1);
    }

    mc.ping({ host: hostname, port: port, version: "1.20.1" }, (err, results) => {
        if (err) {
            console.log('Ping failed:', err.message);
            setTimeout(checkServerStatus, 5000);
        } else {
            console.log('Ping succeeded. Server data:', JSON.stringify(results, null, 2));
            console.log(`Server is online (Players: ${results.players.online}/${results.players.max}). Connecting bot...`);
            connectBot(hostname, port);
        }
    });
}

function connectBot(hostname, port) {
    try {
        bot = mineflayer.createBot({
            host: hostname,
            port: port,
            username: username,
            version: false,
            protocolVersion: 763,
            checkTimeoutInterval: 30000
        });
    } catch (error) {
        console.error('Failed to create bot:', error.message);
        setTimeout(checkServerStatus, 5000);
        return;
    }

    bot.loadPlugin(cmd);

    bot.on('connect', () => {
        console.log('Bot connected to server (handshake complete).');
    });

    bot.once('login', () => {
        console.log("Logged In");
        bot.chat("hello");
    });

    let lasttime = -1;
    let moving = 0;
    let connected = 0;
    const actions = ['forward', 'back', 'left', 'right'];
    let lastaction;
    const moveinterval = 2;
    const maxrandom = 5;
    let nextActionTime = 0;

    bot.on('time', () => {
        if (nightskip && bot.time.timeOfDay >= 13000) {
            bot.chat('/time set day');
        }
        if (connected < 1) return;

        if (lasttime < 0) {
            lasttime = bot.time.age;
            nextActionTime = bot.time.age + (moveinterval * 20) + (Math.random() * maxrandom * 20);
        } else if (bot.time.age >= nextActionTime) {
            if (moving === 1) {
                bot.setControlState(lastaction, false);
                moving = 0;
            } else {
                const yaw = Math.random() * 2 * Math.PI;
                const pitch = Math.random() * Math.PI - (0.5 * Math.PI);
                bot.look(yaw, pitch, false);
                lastaction = actions[Math.floor(Math.random() * actions.length)];
                bot.setControlState(lastaction, true);
                moving = 1;
            }
            lasttime = bot.time.age;
            nextActionTime = bot.time.age + (moveinterval * 20) + (Math.random() * maxrandom * 20);
        }
    });

    bot.once('spawn', () => {
        connected = 1;
        console.log("Bot has spawned in the world.");
    });

    bot.on('player_info', () => {
        if (!connected) {
            connected = 1;
            console.log("Bot detected player info; forcing spawn state.");
        }
    });

    bot.on('death', () => {
        console.log("Bot died. Attempting to respawn...");
        if (connected) {
            bot.chat('/respawn');
        } else {
            console.log("Bot not fully spawned yet; delaying respawn...");
            setTimeout(() => bot.chat('/respawn'), 2000);
        }
    });

    bot.on('error', (err) => {
        if (err.name === 'PartialReadError') {
            // Silently ignore PartialReadError
        } else {
            console.error('Bot error:', err.message);
            bot.end();
        }
    });

    bot.on('end', () => {
        console.log('Bot disconnected. Retrying in 5 seconds...');
        setTimeout(checkServerStatus, 5000);
    });
}

checkServerStatus();