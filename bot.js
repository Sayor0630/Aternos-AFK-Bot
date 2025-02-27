// bot.js
const mineflayer = require("mineflayer");
require("dotenv").config();
const cmd = require("mineflayer-cmd").plugin;
const pathfinder = require("mineflayer-pathfinder").pathfinder;
const { GoalBlock } = require("mineflayer-pathfinder").goals;
const db = require("./db");

let bot;
let isConnected = false;
let connectionStatus = "disconnected";
let connectionError = "";
let lastChatTime = 0;
let botInventory = [];
let nearbyEntities = [];
let serverTime = "unknown";
let weather = "unknown";
let isAutoMoving = false;
let movementInterval;
let isDead = false;
let lastFoodLevel = 20;

let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_DELAY = 5000;

function fixVehiclePassengersIssue() {
  if (bot && bot._client) {
    const originalEntityHandler = bot.entities ? bot.entities.onMount : null;
    const originalOnMount = bot._client.on;
    bot._client.on = function (event, handler) {
      if (event === "mount") {
        return originalOnMount.call(this, event, (packet) => {
          try {
            handler(packet);
          } catch (err) {
            console.log("Ignored mount error:", err.message);
          }
        });
      }
      return originalOnMount.call(this, event, handler);
    };
    if (bot.entities && typeof bot.entities.onMount === "function") {
      bot.entities.onMount = function (packet) {
        try {
          if (originalEntityHandler) {
            originalEntityHandler.call(bot.entities, packet);
          }
        } catch (err) {
          console.log("Ignored entity mount error:", err.message);
        }
      };
    }
  }
}

function startBot(host, port, onLoginCallback) {
  if (isConnected || connectionStatus === "connecting") {
    console.log("Bot is already connected or connecting.");
    return {
      success: false,
      message: "Bot is already connected or connecting",
    };
  }

  console.log(`Starting bot with host: ${host}, port: ${port}`);
  connectionStatus = "connecting";
  connectionError = "";
  reconnectAttempts = 0;

  bot = mineflayer.createBot({
    host: host,
    port: parseInt(port),
    username: process.env.BOT_USERNAME,
    version: process.env.MINECRAFT_VERSION,
    protocolVersion: parseInt(process.env.PROTOCOL_VERSION),
    checkTimeoutInterval: 60000,
    keepAlive: true,
  });

  bot._intentionalDisconnect = false;
  bot.loadPlugin(cmd);
  bot.loadPlugin(pathfinder);

  bot.on("connect", () => {
    connectionStatus = "connecting";
    console.log("Bot connected to server");
  });

  bot.once("login", () => {
    fixVehiclePassengersIssue();
    isConnected = true;
    connectionStatus = "connected";
    isDead = false;
    reconnectAttempts = 0;
    console.log("Bot logged in");
    if (onLoginCallback) onLoginCallback();
    startAutoMovement();
  });

  bot.on("end", (reason) => {
    isConnected = false;
    connectionStatus = "disconnected";
    console.log("Bot disconnected from server. Reason:", reason);
    stopAutoMovement();
    if (!bot._intentionalDisconnect) attemptReconnect();
  });

  bot.on("error", (err) => {
    isConnected = false;
    connectionStatus = "error";
    connectionError = err.message;
    console.error("Bot error:", err);
    stopAutoMovement();
    attemptReconnect();
  });

  bot.once("spawn", () => {
    console.log("Bot has spawned");
    isDead = false;
  });

  bot.on("death", () => {
    console.log("Bot has died");
    isDead = true;
  });

  bot.on("spawn", () => {
    if (isDead) {
      console.log("Bot has respawned");
      isDead = false;
      bot._client.write("client_command", { payload: 0 });
      if (isAutoMoving) startAutoMovement();
    }
  });

  bot.on("chat", (username, message) => {
    lastChatTime = Date.now();
    console.log(`[CHAT] ${username}: ${message}`);
    if (
      message.toLowerCase().includes("hello bot") &&
      username !== bot.username
    ) {
      bot.chat(`Hello, ${username}!`);
    }
  });

  bot.on("health", () => {
    console.log(`Bot health updated: ${bot.health}`);
    if (bot.food !== lastFoodLevel) {
      lastFoodLevel = bot.food;
      console.log(`Bot food level: ${bot.food}`);
    }
  });

  bot.on("rain", () => {
    weather = bot.isRaining ? "raining" : "clear";
    console.log(`Weather changed: ${weather}`);
  });

  bot.on("entityUpdate", updateNearbyEntities);
  bot.on("inventoryChanged", updateInventory);

  return { success: true, message: "Bot connecting to server" };
}

function stopBot() {
  if (bot && isConnected) {
    stopAutoMovement();
    bot._intentionalDisconnect = true;
    bot.quit();
    isConnected = false;
    connectionStatus = "disconnected";
    console.log("Bot has been stopped");
    return { success: true, message: "Bot stopped successfully" };
  } else {
    console.log("Bot is not connected");
    return { success: false, message: "Bot is not connected" };
  }
}

function restartBot() {
  const currentHost = bot?._client?.socket?.remoteAddress || null;
  const currentPort = bot?._client?.socket?.remotePort || null;

  if (!currentHost || !currentPort) {
    return {
      success: false,
      message: "Cannot restart: Bot connection information not available",
    };
  }

  const result = stopBot();
  if (!result.success) return result;

  setTimeout(() => {
    startBot(currentHost, currentPort);
  }, 1000);

  return { success: true, message: "Bot is restarting..." };
}

function killBot() {
  if (bot && isConnected) {
    if (isDead) return { success: false, message: "Bot is already dead" };
    bot.chat("/kill");
    isDead = true;
    return { success: true, message: "Bot killed" };
  } else {
    return { success: false, message: "Bot is not connected" };
  }
}

function healBot() {
  if (bot && isConnected) {
    try {
      bot.chat("/effect give @s minecraft:regeneration 10 5");
      return { success: true, message: "Applied regeneration effect" };
    } catch (err) {
      console.error("Error executing healing command:", err);
      return { success: false, message: "Failed to execute healing command" };
    }
  } else {
    return { success: false, message: "Bot is not connected" };
  }
}

function respawnBot() {
  if (bot && isConnected) {
    if (!isDead) return { success: false, message: "Bot is not dead" };
    bot._client.write("client_command", { payload: 0 });
    return { success: true, message: "Bot respawning" };
  } else {
    return { success: false, message: "Bot is not connected" };
  }
}

function feedBot() {
  if (bot && isConnected) {
    try {
      bot.chat("/effect clear @s");
      bot.chat("/effect give @s minecraft:saturation 30 50");
      return {
        success: true,
        message: "Applied saturation effect and cleared negative effects",
      };
    } catch (err) {
      console.error("Error executing saturation command:", err);
      return {
        success: false,
        message: "Failed to execute saturation command",
      };
    }
  } else {
    return { success: false, message: "Bot is not connected" };
  }
}

function feedBotFood() {
  if (bot && isConnected) {
    const foodItems = bot.inventory
      .items()
      .filter((item) =>
        [
          "apple",
          "bread",
          "cooked_beef",
          "cooked_chicken",
          "cooked_porkchop",
          "carrot",
          "baked_potato",
          "cooked_cod",
          "cooked_salmon",
          "golden_apple",
          "enchanted_golden_apple",
          "cake",
          "cookie",
          "melon_slice",
          "dried_kelp",
          "beef",
          "chicken",
          "porkchop",
          "mutton",
          "rabbit",
        ].includes(item.name)
      );

    if (foodItems.length === 0)
      return { success: false, message: "No food found in inventory" };

    bot.chat("/effect clear @s");
    bot
      .equip(foodItems[0], "hand")
      .then(() => {
        bot.consume().catch((err) => {
          console.error("Error consuming food:", err);
        });
      })
      .catch((err) => {
        console.error("Error equipping food:", err);
      });

    return {
      success: true,
      message: `Eating ${foodItems[0].name} and cleared negative effects`,
    };
  } else {
    return { success: false, message: "Bot is not connected" };
  }
}

function starveBot() {
  if (bot && isConnected) {
    try {
      bot.chat("/effect clear @s");
      bot.chat("/effect give @s minecraft:hunger 30 255");
      return {
        success: true,
        message: "Applied hunger effect and cleared positive effects",
      };
    } catch (err) {
      console.error("Error executing hunger command:", err);
      return { success: false, message: "Failed to execute hunger command" };
    }
  } else {
    return { success: false, message: "Bot is not connected" };
  }
}

function setWeather(weatherType) {
  if (bot && isConnected) {
    if (weatherType === "clear") bot.chat("/weather clear");
    else if (weatherType === "rain") bot.chat("/weather rain");
    else if (weatherType === "thunder") bot.chat("/weather thunder");
    else return { success: false, message: "Invalid weather type" };
    return { success: true, message: `Setting weather to ${weatherType}` };
  } else {
    return { success: false, message: "Bot is not connected" };
  }
}

function setTime(timeValue) {
  if (bot && isConnected) {
    bot.chat(`/time set ${timeValue}`);
    return { success: true, message: `Setting time to ${timeValue}` };
  } else {
    return { success: false, message: "Bot is not connected" };
  }
}

async function attemptReconnect() {
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.log("Reconnection attempts exhausted.");
    return;
  }

  const connectionDetails = await db.getConnectionDetails();
  if (connectionDetails && !connectionDetails.userDisconnected) {
    reconnectAttempts++;
    console.log(
      `Reconnection attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}`
    );
    setTimeout(() => {
      if (!isConnected && connectionStatus !== "connecting") {
        startBot(connectionDetails.ip, connectionDetails.port);
      }
    }, RECONNECT_DELAY * reconnectAttempts);
  }
}

function startAutoMovement() {
  if (!isAutoMoving && bot && isConnected) {
    isAutoMoving = true;
    movementInterval = setInterval(() => {
      try {
        if (bot && bot.entity) {
          const action = Math.random();
          if (action < 0.3) {
            bot.look(
              Math.random() * Math.PI * 2,
              Math.random() * Math.PI - Math.PI / 2
            );
          } else if (action < 0.7) {
            const currentPos = bot.entity.position;
            const dx = Math.floor(Math.random() * 10) - 5;
            const dz = Math.floor(Math.random() * 10) - 5;
            const targetX = Math.floor(currentPos.x) + dx;
            const targetZ = Math.floor(currentPos.z) + dz;
            bot.pathfinder.setGoal(
              new GoalBlock(targetX, Math.floor(currentPos.y), targetZ)
            );
          } else {
            collectItems();
          }
        }
      } catch (err) {
        console.error("Error in automatic movement:", err);
      }
    }, Math.random() * 5000 + 10000);
    console.log("Automatic movement started");
  }
}

function stopAutoMovement() {
  if (isAutoMoving) {
    clearInterval(movementInterval);
    isAutoMoving = false;
    console.log("Automatic movement stopped");
  }
}

function sendChatMessage(message) {
  if (bot && isConnected) {
    bot.chat(message);
    console.log(`Bot sent chat message: ${message}`);
    return { success: true, message: "Message sent" };
  } else {
    console.log("Bot is not connected");
    return { success: false, message: "Bot is not connected" };
  }
}

function executeCommand(command) {
  if (bot && isConnected) {
    bot.chat(`/${command}`);
    console.log(`Bot executed command: /${command}`);
    return { success: true, message: `Command executed: /${command}` };
  } else {
    return { success: false, message: "Bot is not connected" };
  }
}

function getBotStatus() {
  if (bot && isConnected) {
    updateServerTime();
    updateInventory();
    updateNearbyEntities();
    return {
      online: true,
      connectionStatus,
      connectionError,
      health: bot.health,
      food: bot.food,
      oxygen: bot.oxygenLevel,
      location: bot.entity.position,
      weather,
      serverTime,
      experience: bot.experience,
      inventory: botInventory.slice(0, 9),
      nearbyEntities,
      isAutoMoving,
      isDead,
    };
  }
  return { online: false, connectionStatus, connectionError };
}

function getReconnectAttempts() {
  return reconnectAttempts;
}

function getBotLocation() {
  if (bot && isConnected && bot.entity && bot.entity.position) {
    const { x, y, z } = bot.entity.position;
    return { x, y, z };
  }
  return { x: null, y: null, z: null };
}

function getBotHealth() {
  if (bot && isConnected) {
    return { health: bot.health, food: bot.food, oxygen: bot.oxygenLevel };
  }
  return { health: null, food: null, oxygen: null };
}

function getBotAction() {
  if (bot && isConnected && bot.entity) {
    if (isDead) return { action: "dead" };
    else if (isAutoMoving) return { action: "auto-moving" };
    else if (Date.now() - lastChatTime < 5000) return { action: "chatting" };
    return { action: "idle" };
  }
  return { action: "offline" };
}

function updateServerTime() {
  if (bot && isConnected) {
    try {
      const timeOfDay = bot.time.timeOfDay;
      const hours = Math.floor((timeOfDay / 24000) * 24);
      const minutes = Math.floor(((timeOfDay / 24000) * 24 * 60) % 60);
      serverTime = `${hours.toString().padStart(2, "0")}:${minutes
        .toString()
        .padStart(2, "0")}`;
      weather = bot.isRaining ? "raining" : "clear";
    } catch (e) {
      serverTime = "unknown";
    }
  }
}

function updateInventory() {
  if (bot && isConnected && bot.inventory) {
    try {
      botInventory = bot.inventory.slots
        .filter((item) => item !== null)
        .map((item) => ({
          name: item.name,
          count: item.count,
          displayName: item.displayName,
        }));
    } catch (e) {
      botInventory = [];
    }
  }
}

function updateNearbyEntities(radius = 30) {
  if (!bot || !bot.entity || !bot.entity.position) {
    nearbyEntities = [];
    return;
  }

  const allEntities = Object.values(bot.entities);
  const relevantTypes = [
    "player",
    "animal",
    "hostile",
    "water_creature",
    "ambient",
    "mob",
    "living",
  ];
  const botPosition = bot.entity.position;
  const botId = bot.entity.id;

  nearbyEntities = allEntities
    .filter((entity) => entity.type && relevantTypes.includes(entity.type))
    .map((entity) => {
      if (!entity.position) return null;
      const dx = entity.position.x - botPosition.x;
      const dy = entity.position.y - botPosition.y;
      const dz = entity.position.z - botPosition.z;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
      return {
        name: entity.username || entity.name || entity.type || "unknown",
        type: entity.type || "unknown",
        distance: distance,
        id: entity.id,
      };
    })
    .filter(
      (entity) =>
        entity !== null && entity.id !== botId && entity.distance <= radius
    )
    .slice(0, 10)
    .map((entity) => ({ ...entity, distance: entity.distance.toFixed(1) }));
}

function collectItems() {
  if (bot && isConnected) {
    const items = Object.values(bot.entities).filter(
      (e) => e.type === "object" && e.objectType === "Item"
    );
    if (items.length === 0)
      return { success: false, message: "No items found nearby" };

    let closest = null;
    let closestDistance = Number.MAX_VALUE;
    items.forEach((item) => {
      const distance = bot.entity.position.distanceTo(item.position);
      if (distance < closestDistance) {
        closest = item;
        closestDistance = distance;
      }
    });

    if (closest) {
      bot.pathfinder.setGoal(
        new GoalBlock(
          closest.position.x,
          closest.position.y,
          closest.position.z
        )
      );
      return {
        success: true,
        message: `Moving to collect ${items.length} items`,
      };
    }
  }
  return { success: false, message: "Bot is not connected" };
}

function toggleAutoMovement() {
  if (bot && isConnected) {
    if (isAutoMoving) {
      stopAutoMovement();
      return { success: true, message: "Automatic movement stopped" };
    } else {
      startAutoMovement();
      return { success: true, message: "Automatic movement started" };
    }
  }
  return { success: false, message: "Bot is not connected" };
}

function getConnectionStatus() {
  return {
    isConnected,
    status: connectionStatus,
    error: connectionError,
    isAutoMoving,
    isDead,
  };
}

module.exports = {
  startBot,
  stopBot,
  restartBot,
  killBot,
  healBot,
  respawnBot,
  feedBot,
  feedBotFood,
  starveBot,
  setWeather,
  setTime,
  sendChatMessage,
  executeCommand,
  getBotStatus,
  getReconnectAttempts,
  getBotLocation,
  getBotHealth,
  getBotAction,
  getConnectionStatus,
  collectItems,
  toggleAutoMovement,
  isConnected,
};
