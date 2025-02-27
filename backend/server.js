const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const bot = require("./bot"); // Assuming bot.js is in the same directory
const fs = require("fs");
const path = require("path");

const app = express();
const port = 3001;

// File to store last connection details
const LAST_CONNECTION_FILE = path.join(__dirname, "last_connection.json");

// Create a history of chat messages and server events
const logHistory = [];
function addToLog(type, message) {
  const timestamp = new Date().toISOString();
  logHistory.unshift({ timestamp, type, message });
  if (logHistory.length > 100) {
    logHistory.pop();
  }
}

app.use(cors());
app.use(bodyParser.json());

// Health check route
app.get("/health", (req, res) => {
  res.status(200).json({ message: "Backend is up and running!" });
});

// Function to save connection details
function saveConnectionDetails(host, port) {
  const connectionDetails = { host, port };
  try {
    fs.writeFileSync(
      LAST_CONNECTION_FILE,
      JSON.stringify(connectionDetails),
      "utf8"
    );
    addToLog("system", `Saved connection details: ${host}:${port}`);
  } catch (err) {
    console.error("Error saving connection details:", err);
    addToLog("system", `Failed to save connection details: ${err.message}`);
  }
}

// Function to load connection details
function loadConnectionDetails() {
  if (fs.existsSync(LAST_CONNECTION_FILE)) {
    try {
      const data = fs.readFileSync(LAST_CONNECTION_FILE, "utf8");
      return JSON.parse(data);
    } catch (err) {
      console.error("Error loading connection details:", err);
      addToLog("system", `Failed to load connection details: ${err.message}`);
      return null;
    }
  }
  return null;
}

// Function to clear connection details (e.g., on intentional stop)
function clearConnectionDetails() {
  try {
    if (fs.existsSync(LAST_CONNECTION_FILE)) {
      fs.unlinkSync(LAST_CONNECTION_FILE);
      addToLog("system", "Cleared connection details");
    }
  } catch (err) {
    console.error("Error clearing connection details:", err);
    addToLog("system", `Failed to clear connection details: ${err.message}`);
  }
}

app.get("/", (req, res) => {
  res.sendStatus(200);
});

// Route to start the bot
app.post("/start-bot", (req, res) => {
  const { host, port } = req.body;
  const result = bot.startBot(host, port);
  addToLog("system", `Attempted to start bot: ${result.message}`);
  if (result.success) {
    // Save connection details when bot starts (actual saving happens on login in bot.js)
    // This ensures we only save if the connection is valid
  }
  res.json(result);
});

// Route to stop the bot
app.post("/stop-bot", (req, res) => {
  const result = bot.stopBot();
  addToLog("system", `Attempted to stop bot: ${result.message}`);
  if (result.success) {
    clearConnectionDetails(); // Clear details on intentional stop
  }
  res.json(result);
});

// Route to restart the bot
app.post("/restart-bot", (req, res) => {
  const result = bot.restartBot();
  addToLog("system", `Attempted to restart bot: ${result.message}`);
  res.json(result);
});

// Route to kill the bot
app.post("/kill-bot", (req, res) => {
  const result = bot.killBot();
  addToLog("action", `Attempted to kill bot: ${result.message}`);
  res.json(result);
});

// Route to heal the bot
app.post("/heal-bot", (req, res) => {
  const result = bot.healBot();
  addToLog("action", `Attempted to heal bot: ${result.message}`);
  res.json(result);
});

// Route to respawn the bot
app.post("/respawn-bot", (req, res) => {
  const result = bot.respawnBot();
  addToLog("action", `Attempted to respawn bot: ${result.message}`);
  res.json(result);
});

// Route to feed the bot
app.post("/feed-bot", (req, res) => {
  const result = bot.feedBot();
  addToLog("action", `Attempted to feed bot: ${result.message}`);
  res.json(result);
});

app.post("/feed-bot-food", (req, res) => {
  const result = bot.feedBotFood();
  addToLog("action", `Attempted to feed bot: ${result.message}`);
  res.json(result);
});

// Route to starve the bot
app.post("/starve-bot", (req, res) => {
  const result = bot.starveBot();
  addToLog("action", `Attempted to starve bot: ${result.message}`);
  res.json(result);
});

// Route to set weather
app.post("/set-weather", (req, res) => {
  const { weatherType } = req.body;
  const result = bot.setWeather(weatherType);
  addToLog("command", `Setting weather to ${weatherType}: ${result.message}`);
  res.json(result);
});

// Route to set time
app.post("/set-time", (req, res) => {
  const { timeValue } = req.body;
  const result = bot.setTime(timeValue);
  addToLog("command", `Setting time to ${timeValue}: ${result.message}`);
  res.json(result);
});

// Route to get the bot's current status
app.get("/bot-status", (req, res) => {
  const status = bot.getBotStatus();
  res.json(status);
});

// Route to get the connection status
app.get("/connection-status", (req, res) => {
  const status = bot.getConnectionStatus();
  res.json(status);
});

// Route to get the bot's current location
app.get("/bot-location", (req, res) => {
  const location = bot.getBotLocation();
  res.json(location);
});

// Route to get the bot's current health
app.get("/bot-health", (req, res) => {
  const health = bot.getBotHealth();
  res.json(health);
});

// Route to get the bot's current action
app.get("/bot-action", (req, res) => {
  const action = bot.getBotAction();
  res.json(action);
});

// Route to send a chat message
app.post("/send-chat", (req, res) => {
  const { message } = req.body;
  const result = bot.sendChatMessage(message);
  addToLog("chat", `Bot: ${message}`);
  res.json(result);
});

// Route to execute a command
app.post("/execute-command", (req, res) => {
  const { command } = req.body;
  const result = bot.executeCommand(command);
  addToLog("command", `/${command}`);
  res.json(result);
});

// Route to teleport the bot
app.post("/teleport", (req, res) => {
  const { x, y, z } = req.body;
  const result = bot.executeCommand(`tp @s ${x} ${y} ${z}`);
  addToLog("movement", `Teleporting to ${x}, ${y}, ${z}`);
  res.json(result);
});

// Route to collect nearby items
app.post("/collect-items", (req, res) => {
  const result = bot.collectItems();
  addToLog("action", `Attempting to collect nearby items`);
  res.json(result);
});

// Route to toggle automatic movement
app.post("/toggle-auto-movement", (req, res) => {
  const result = bot.toggleAutoMovement();
  addToLog("movement", result.message);
  res.json(result);
});

// Route to get log history
app.get("/log-history", (req, res) => {
  res.json(logHistory);
});

// Auto-reconnect logic on server startup
function startBotWithAutoReconnect() {
  const connectionDetails = loadConnectionDetails();
  if (connectionDetails) {
    const { host, port } = connectionDetails;
    console.log(`Attempting to auto-reconnect to ${host}:${port}`);
    addToLog("system", `Auto-reconnecting to ${host}:${port}`);
    const result = bot.startBot(host, port);
    if (!result.success) {
      console.error(`Auto-reconnect failed: ${result.message}`);
      addToLog("system", `Auto-reconnect failed: ${result.message}`);
    }
  } else {
    console.log("No previous connection details found.");
    addToLog("system", "No previous connection details found.");
  }
}

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
  addToLog("system", "Backend server started");
  startBotWithAutoReconnect(); // Check and attempt auto-reconnect on startup
});

// Export functions for potential use elsewhere (optional)
module.exports = {
  saveConnectionDetails,
  loadConnectionDetails,
  clearConnectionDetails,
  startBotWithAutoReconnect,
};
