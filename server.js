const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const bot = require('./bot');  // Include bot.js with your bot logic

const app = express();
const port = 3001;

// Create a history of chat messages and server events
const logHistory = [];
function addToLog(type, message) {
    const timestamp = new Date().toISOString();
    logHistory.unshift({ timestamp, type, message });
    
    // Keep the log history limited to the last 100 entries
    if (logHistory.length > 100) {
        logHistory.pop();
    }
}

app.use(cors());
app.use(bodyParser.json());

// Health check route
app.get('/health', (req, res) => {
    res.status(200).json({ message: "Backend is up and running!" });
});

// Route to start the bot
app.post('/start-bot', (req, res) => {
    const { host, port } = req.body;
    const result = bot.startBot(host, port);
    addToLog('system', `Attempted to start bot: ${result.message}`);
    res.json(result);
});

// Route to stop the bot
app.post('/stop-bot', (req, res) => {
    const result = bot.stopBot();
    addToLog('system', `Attempted to stop bot: ${result.message}`);
    res.json(result);
});

// Route to restart the bot
app.post('/restart-bot', (req, res) => {
    const result = bot.restartBot();
    addToLog('system', `Attempted to restart bot: ${result.message}`);
    res.json(result);
});

// Route to kill the bot
app.post('/kill-bot', (req, res) => {
    const result = bot.killBot();
    addToLog('action', `Attempted to kill bot: ${result.message}`);
    res.json(result);
});

// Route to respawn the bot
app.post('/respawn-bot', (req, res) => {
    const result = bot.respawnBot();
    addToLog('action', `Attempted to respawn bot: ${result.message}`);
    res.json(result);
});

// Route to feed the bot
app.post('/feed-bot', (req, res) => {
    const result = bot.feedBot();
    addToLog('action', `Attempted to feed bot: ${result.message}`);
    res.json(result);
});

// Route to starve the bot
app.post('/starve-bot', (req, res) => {
    const result = bot.starveBot();
    addToLog('action', `Attempted to starve bot: ${result.message}`);
    res.json(result);
});

// Route to set weather
app.post('/set-weather', (req, res) => {
    const { weatherType } = req.body;
    const result = bot.setWeather(weatherType);
    addToLog('command', `Setting weather to ${weatherType}: ${result.message}`);
    res.json(result);
});

// Route to set time
app.post('/set-time', (req, res) => {
    const { timeValue } = req.body;
    const result = bot.setTime(timeValue);
    addToLog('command', `Setting time to ${timeValue}: ${result.message}`);
    res.json(result);
});

// Route to get the bot's current status
app.get('/bot-status', (req, res) => {
    const status = bot.getBotStatus();
    res.json(status);
});

// Route to get the connection status
app.get('/connection-status', (req, res) => {
    const status = bot.getConnectionStatus();
    res.json(status);
});

// Route to get the bot's current location (x, y, z)
app.get('/bot-location', (req, res) => {
    const location = bot.getBotLocation();
    res.json(location);
});

// Route to get the bot's current health
app.get('/bot-health', (req, res) => {
    const health = bot.getBotHealth();
    res.json(health);
});

// Route to get the bot's current action (chatting, idle, moving, etc.)
app.get('/bot-action', (req, res) => {
    const action = bot.getBotAction();
    res.json(action);
});

// Route to send a chat message
app.post('/send-chat', (req, res) => {
    const { message } = req.body;
    const result = bot.sendChatMessage(message);
    addToLog('chat', `Bot: ${message}`);
    res.json(result);
});

// Route to execute a command
app.post('/execute-command', (req, res) => {
    const { command } = req.body;
    const result = bot.executeCommand(command);
    addToLog('command', `/${command}`);
    res.json(result);
});

// Route to teleport the bot (sending a command)
app.post('/teleport', (req, res) => {
    const { x, y, z } = req.body;
    const result = bot.executeCommand(`tp @s ${x} ${y} ${z}`);
    addToLog('movement', `Teleporting to ${x}, ${y}, ${z}`);
    res.json(result);
});

// Route to collect nearby items
app.post('/collect-items', (req, res) => {
    const result = bot.collectItems();
    addToLog('action', `Attempting to collect nearby items`);
    res.json(result);
});

// Route to toggle automatic movement
app.post('/toggle-auto-movement', (req, res) => {
    const result = bot.toggleAutoMovement();
    addToLog('movement', result.message);
    res.json(result);
});

// Route to get log history
app.get('/log-history', (req, res) => {
    res.json(logHistory);
});

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
    addToLog('system', 'Backend server started');
});