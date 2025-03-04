const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const bot = require("./bot");
const db = require("./db");

const app = express();
const port = 3001;

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

app.get("/health", (req, res) => {
  res.status(200).json({ message: "Backend is up and running!" });
});

app.get("/", (req, res) => {
  res.sendStatus(200);
});

app.post("/start-bot", async (req, res) => {
  const { host, port } = req.body;
  const result = bot.startBot(host, port, async () => {
    await db.saveConnectionDetails(host, port, false);
  });
  addToLog("system", `Attempted to start bot: ${result.message}`);
  res.json(result);
});

app.post("/stop-bot", async (req, res) => {
  const result = bot.stopBot();
  addToLog("system", `Attempted to stop bot: ${result.message}`);
  if (result.success) {
    const connectionDetails = await db.getConnectionDetails();
    if (connectionDetails && connectionDetails.connection) {
      await db.saveConnectionDetails(
        connectionDetails.connection.ip,
        connectionDetails.connection.port,
        true
      );
    }
  }
  res.json(result);
});

app.post("/restart-bot", (req, res) => {
  const result = bot.restartBot();
  addToLog("system", `Attempted to restart bot: ${result.message}`);
  res.json(result);
});

app.post("/kill-bot", (req, res) => {
  const result = bot.killBot();
  addToLog("action", `Attempted to kill bot: ${result.message}`);
  res.json(result);
});

app.post("/heal-bot", (req, res) => {
  const result = bot.healBot();
  addToLog("action", `Attempted to heal bot: ${result.message}`);
  res.json(result);
});

app.post("/respawn-bot", (req, res) => {
  const result = bot.respawnBot();
  addToLog("action", `Attempted to respawn bot: ${result.message}`);
  res.json(result);
});

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

app.post("/starve-bot", (req, res) => {
  const result = bot.starveBot();
  addToLog("action", `Attempted to starve bot: ${result.message}`);
  res.json(result);
});

app.post("/set-weather", (req, res) => {
  const { weatherType } = req.body;
  const result = bot.setWeather(weatherType);
  addToLog("command", `Setting weather to ${weatherType}: ${result.message}`);
  res.json(result);
});

app.post("/set-time", (req, res) => {
  const { timeValue } = req.body;
  const result = bot.setTime(timeValue);
  addToLog("command", `Setting time to ${timeValue}: ${result.message}`);
  res.json(result);
});

app.post("/set-keep-weather", (req, res) => {
  const { enabled, weatherType } = req.body;
  const result = bot.setKeepWeather(enabled, weatherType);
  addToLog(
    "system",
    `Set keep weather to ${enabled} with ${weatherType}: ${result.message}`
  );
  res.json(result);
});

app.post("/set-keep-time", (req, res) => {
  const { enabled, timeValue } = req.body;
  const result = bot.setKeepTime(enabled, timeValue);
  addToLog(
    "system",
    `Set keep time to ${enabled} with ${timeValue}: ${result.message}`
  );
  res.json(result);
});

app.get("/bot-status", (req, res) => {
  const status = bot.getBotStatus();
  const reconnectAttempts = bot.getReconnectAttempts();
  res.json({ ...status, reconnectAttempts });
});

app.get("/connection-status", (req, res) => {
  const status = bot.getConnectionStatus();
  res.json(status);
});

app.get("/bot-location", (req, res) => {
  const location = bot.getBotLocation();
  res.json(location);
});

app.get("/bot-health", (req, res) => {
  const health = bot.getBotHealth();
  res.json(health);
});

app.get("/bot-action", (req, res) => {
  const action = bot.getBotAction();
  res.json(action);
});

app.post("/send-chat", (req, res) => {
  const { message } = req.body;
  const result = bot.sendChatMessage(message);
  addToLog("chat", `${bot.botUsername}: ${message}`);
  res.json(result);
});

app.post("/execute-command", (req, res) => {
  const { command } = req.body;
  const result = bot.executeCommand(command);
  addToLog("command", `/${command}`);
  res.json(result);
});

app.post("/teleport", (req, res) => {
  const { x, y, z } = req.body;
  const result = bot.executeCommand(`tp @s ${x} ${y} ${z}`);
  addToLog("movement", `Teleporting to ${x}, ${y}, ${z}`);
  res.json(result);
});

app.post("/collect-items", (req, res) => {
  const result = bot.collectItems();
  addToLog("action", `Attempting to collect nearby items`);
  res.json(result);
});

app.post("/toggle-auto-movement", (req, res) => {
  const result = bot.toggleAutoMovement();
  addToLog("movement", result.message);
  res.json(result);
});

app.get("/log-history", (req, res) => {
  res.json(logHistory);
});

app.get("/chat-history", (req, res) => {
  res.json(bot.chatHistory);
});

app.post("/kick-player", (req, res) => {
  const { playerUsername } = req.body;
  const result = bot.kickPlayer(playerUsername);
  addToLog("action", `Kicked player ${playerUsername}: ${result.message}`);
  res.json(result);
});

app.post("/ban-player", (req, res) => {
  const { playerUsername } = req.body;
  const result = bot.banPlayer(playerUsername);
  addToLog("action", `Banned player ${playerUsername}: ${result.message}`);
  res.json(result);
});

app.post("/kill-player", (req, res) => {
  const { playerUsername } = req.body;
  const result = bot.killPlayer(playerUsername);
  addToLog("action", `Killed player ${playerUsername}: ${result.message}`);
  res.json(result);
});

app.post("/heal-player", (req, res) => {
  const { playerUsername } = req.body;
  const result = bot.healPlayer(playerUsername);
  addToLog("action", `Healed player ${playerUsername}: ${result.message}`);
  res.json(result);
});

app.post("/starve-player", (req, res) => {
  const { playerUsername } = req.body;
  const result = bot.starvePlayer(playerUsername);
  addToLog("action", `Starved player ${playerUsername}: ${result.message}`);
  res.json(result);
});

app.post("/feed-player", (req, res) => {
  const { playerUsername } = req.body;
  const result = bot.feedPlayer(playerUsername);
  addToLog("action", `Fed player ${playerUsername}: ${result.message}`);
  res.json(result);
});

app.post("/tp-bot-to-player", (req, res) => {
  const { playerUsername } = req.body;
  const result = bot.tpBotToPlayer(playerUsername);
  addToLog(
    "movement",
    `Teleported bot to ${playerUsername}: ${result.message}`
  );
  res.json(result);
});

app.post("/tp-player-to-player", (req, res) => {
  const { fromPlayerUsername, toPlayerUsername } = req.body;
  const result = bot.tpPlayerToPlayer(fromPlayerUsername, toPlayerUsername);
  addToLog(
    "movement",
    `Teleported ${fromPlayerUsername} to ${toPlayerUsername}: ${result.message}`
  );
  res.json(result);
});

app.post("/drop-item", async (req, res) => {
  const { slot, amount } = req.body;
  const result = await bot.dropItemFromSlot(slot, amount);
  addToLog("action", result.message);
  res.json(result);
});

app.post("/drop-stacks", async (req, res) => {
  const { slots } = req.body;
  const result = await bot.dropStacksFromSlots(slots);
  addToLog("action", result.message);
  res.json(result);
});

app.post("/drop-all", async (req, res) => {
  const result = await bot.dropAllItems();
  addToLog("action", result.message);
  res.json(result);
});

async function startBotWithAutoReconnect() {
  const connectionDetails = await db.getConnectionDetails();
  if (
    connectionDetails &&
    connectionDetails.connection &&
    !connectionDetails.connection.userDisconnected
  ) {
    console.log(
      `Attempting to auto-reconnect to ${connectionDetails.connection.ip}:${connectionDetails.connection.port}`
    );
    addToLog(
      "system",
      `Auto-reconnecting to ${connectionDetails.connection.ip}:${connectionDetails.connection.port}`
    );
    const result = bot.startBot(
      connectionDetails.connection.ip,
      connectionDetails.connection.port
    );
    if (!result.success) {
      console.error(`Auto-reconnect failed: ${result.message}`);
      addToLog("system", `Auto-reconnect failed: ${result.message}`);
    }
  } else {
    console.log(
      "No previous connection details or user disconnected. Waiting for manual connection."
    );
    addToLog("system", "No previous connection details or user disconnected.");
  }
}

async function startServer() {
  try {
    await db.connect();
    app.listen(port, () => {
      console.log(`Server running at http://localhost:${port}`);
      addToLog("system", "Backend server started");
      startBotWithAutoReconnect();
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

startServer();
