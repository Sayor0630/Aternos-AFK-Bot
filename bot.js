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
let timeOfDayDescription = "Unknown";
let weather = "unknown";
let isAutoMoving = false;
let movementInterval = null;
let isDead = false;
let lastFoodLevel = 20;
let keepWeatherEnabled = false;
let targetWeather = null;
let keepTimeEnabled = false;
let targetTime = null;
let maintenanceInterval;
let chatHistory = [];
let botUsername = process.env.BOT_USERNAME;

let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_DELAY = 5000;

function fixVehiclePassengersAndErrors() {
  if (bot && bot._client) {
    // Override bot.emit to catch all event emission errors
    const originalEmit = bot.emit;
    bot.emit = function (event, ...args) {
      try {
        originalEmit.apply(this, [event, ...args]);
      } catch (err) {
        console.log(`Caught error in event '${event}': ${err.message}`, args);
      }
    };

    // Override specific packet handlers for additional safety
    const originalOnMount = bot._client.on;
    bot._client.on = function (event, handler) {
      if (
        event === "mount" ||
        event === "set_passengers" ||
        event === "entity_status"
      ) {
        return originalOnMount.call(this, event, (packet) => {
          try {
            handler(packet);
          } catch (err) {
            console.log(
              `Ignored packet error (${event}): ${err.message}`,
              packet
            );
          }
        });
      }
      return originalOnMount.call(this, event, handler);
    };
  }
}

function isTimeWithinRange(target) {
  if (!bot || !bot.time) return false;
  const currentTime = bot.time.timeOfDay;
  switch (target) {
    case "day":
      return currentTime >= 0 && currentTime < 12000;
    case "night":
      return currentTime >= 12000 && currentTime < 24000;
    case "noon":
      return currentTime >= 5500 && currentTime <= 6500;
    case "midnight":
      return currentTime >= 17500 && currentTime <= 18500;
    default:
      return false;
  }
}

async function loadSettings() {
  const botName = process.env.BOT_USERNAME;
  const savedSettings = await db.getBotSettings(botName);
  if (savedSettings && savedSettings.settings) {
    isAutoMoving = savedSettings.settings.isAutoMoving || false;
    keepWeatherEnabled = savedSettings.settings.keepWeatherEnabled || false;
    targetWeather = savedSettings.settings.targetWeather || null;
    keepTimeEnabled = savedSettings.settings.keepTimeEnabled || false;
    targetTime = savedSettings.settings.targetTime || null;
    console.log("Loaded settings from MongoDB:", savedSettings.settings);
  } else {
    console.log("No saved settings found, using defaults.");
  }
}

async function saveSettings() {
  const botName = process.env.BOT_USERNAME;
  const settings = {
    settings: {
      isAutoMoving,
      keepWeatherEnabled,
      targetWeather,
      keepTimeEnabled,
      targetTime,
    },
  };
  const existingSettings = await db.getBotSettings(botName);
  if (existingSettings && existingSettings.connection) {
    settings.connection = existingSettings.connection;
  }
  await db.saveBotSettings(botName, settings);
  console.log("Saved settings to MongoDB:", settings.settings);
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

  // Apply error handling immediately after bot creation
  fixVehiclePassengersAndErrors();

  bot._intentionalDisconnect = false;
  bot.loadPlugin(cmd);
  bot.loadPlugin(pathfinder);

  bot.on("connect", () => {
    connectionStatus = "connecting";
    console.log("Bot connected to server");
  });

  bot.once("login", async () => {
    isConnected = true;
    connectionStatus = "connected";
    isDead = false;
    reconnectAttempts = 0;
    console.log("Bot logged in");
    await loadSettings();
    if (isAutoMoving) startAutoMovement();
    if (onLoginCallback) onLoginCallback();

    maintenanceInterval = setInterval(() => {
      if (keepWeatherEnabled && targetWeather && bot && isConnected) {
        const currentWeather = bot.isRaining
          ? bot.thunderState > 0
            ? "thunder"
            : "rain"
          : "clear";
        if (currentWeather !== targetWeather) {
          bot.chat(`/weather ${targetWeather}`);
          console.log(`Maintaining weather: ${targetWeather}`);
        }
      }
      if (keepTimeEnabled && targetTime && bot && isConnected) {
        if (!isTimeWithinRange(targetTime)) {
          bot.chat(`/time set ${targetTime}`);
          console.log(`Resetting time to ${targetTime}`);
        }
      }
    }, 5000);
  });

  bot.on("end", (reason) => {
    isConnected = false;
    connectionStatus = "disconnected";
    stopAutoMovement();
    clearInterval(maintenanceInterval);
    console.log("Bot disconnected from server. Reason:", reason);
    if (!bot._intentionalDisconnect) attemptReconnect();
  });

  bot.on("error", (err) => {
    isConnected = false;
    connectionStatus = "error";
    connectionError = err.message;
    stopAutoMovement();
    clearInterval(maintenanceInterval);
    console.error("Bot error:", err);
    attemptReconnect();
  });

  bot.once("spawn", () => {
    console.log("Bot has spawned");
    isDead = false;
    if (isAutoMoving) startAutoMovement();
    if (keepWeatherEnabled && targetWeather)
      bot.chat(`/weather ${targetWeather}`);
    if (keepTimeEnabled && targetTime) bot.chat(`/time set ${targetTime}`);

    // Filter out unknown entities
    bot.on("entitySpawn", (entity) => {
      if (!entity.type || entity.type === "unknown" || !entity.name) {
        console.log(
          `Ignoring entity: ID=${entity.id}, Type=${
            entity.type || "none"
          }, Name=${entity.name || "none"}`
        );
        delete bot.entities[entity.id];
      }
    });

    // Skip updates for unknown entities
    bot.on("entityUpdate", (entity) => {
      if (!entity.type || !entity.name) {
        console.log(`Skipping update for unknown entity: ID=${entity.id}`);
        return;
      }
    });
  });

  bot.on("death", () => {
    console.log("Bot has died");
    isDead = true;
    stopAutoMovement();
  });

  bot.on("spawn", () => {
    if (isDead) {
      console.log("Bot has respawned");
      isDead = false;
      bot._client.write("client_command", { payload: 0 });
      if (isAutoMoving) {
        startAutoMovement();
      } else {
        stopAutoMovement();
      }
      if (keepWeatherEnabled && targetWeather)
        bot.chat(`/weather ${targetWeather}`);
      if (keepTimeEnabled && targetTime) bot.chat(`/time set ${targetTime}`);
    }
  });

  bot.on("chat", (username, message) => {
    lastChatTime = Date.now();
    console.log(`[CHAT] ${username}: ${message}`);
    chatHistory.push({ username, message, timestamp: Date.now() });
    if (chatHistory.length > 100) chatHistory.shift();
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
    clearInterval(maintenanceInterval);
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
      return {
        success: false,
        message: "Failed to execute hunger command",
      };
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

function setKeepWeather(enabled, weatherType) {
  if (enabled && !["clear", "rain", "thunder"].includes(weatherType)) {
    return { success: false, message: "Invalid weather type" };
  }
  keepWeatherEnabled = enabled;
  targetWeather = enabled ? weatherType : null;
  if (enabled && bot && isConnected) {
    bot.chat(`/weather ${weatherType}`);
  }
  console.log(`Keep Weather set to ${enabled} with ${weatherType}`);
  saveSettings();
  return {
    success: true,
    message: `Keep Weather ${enabled ? "enabled" : "disabled"}`,
  };
}

function setKeepTime(enabled, timeValue) {
  if (enabled && !["day", "night", "noon", "midnight"].includes(timeValue)) {
    return { success: false, message: "Invalid time value" };
  }
  keepTimeEnabled = enabled;
  targetTime = enabled ? timeValue : null;
  if (enabled && bot && isConnected) {
    bot.chat(`/time set ${timeValue}`);
  }
  console.log(`Keep Time set to ${enabled} with ${timeValue}`);
  saveSettings();
  return {
    success: true,
    message: `Keep Time ${enabled ? "enabled" : "disabled"}`,
  };
}

async function attemptReconnect() {
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.log("Reconnection attempts exhausted.");
    return;
  }

  const connectionDetails = await db.getConnectionDetails();
  if (connectionDetails && !connectionDetails.connection.userDisconnected) {
    reconnectAttempts++;
    console.log(
      `Reconnection attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}`
    );
    setTimeout(() => {
      if (!isConnected && connectionStatus !== "connecting") {
        startBot(
          connectionDetails.connection.ip,
          connectionDetails.connection.port
        );
      }
    }, RECONNECT_DELAY * reconnectAttempts);
  }
}

function startAutoMovement() {
  if (!bot || !isConnected || !isAutoMoving || movementInterval) {
    console.log("Auto movement not started:", {
      isConnected,
      isAutoMoving,
      hasInterval: !!movementInterval,
    });
    return;
  }

  movementInterval = setInterval(() => {
    if (!isConnected || isDead || !isAutoMoving) {
      stopAutoMovement();
      return;
    }

    try {
      const pos = bot.entity.position;
      const dx = Math.floor(Math.random() * 10) - 5;
      const dz = Math.floor(Math.random() * 10) - 5;
      const targetX = Math.floor(pos.x) + dx;
      const targetZ = Math.floor(pos.z) + dz;
      bot.pathfinder.setGoal(
        new GoalBlock(targetX, Math.floor(pos.y), targetZ)
      );
      console.log(
        `Setting movement goal to X: ${targetX}, Y: ${Math.floor(
          pos.y
        )}, Z: ${targetZ}`
      );
      console.log(`Auto moving to X: ${targetX}, Z: ${targetZ}`);
    } catch (err) {
      console.error("Error in auto movement:", err.message);
    }
  }, 3000);

  console.log("Auto movement started");
}

function stopAutoMovement() {
  if (movementInterval) {
    clearInterval(movementInterval);
    movementInterval = null;
    console.log("Auto movement stopped");
  }
}

function toggleAutoMovement() {
  if (!bot || !isConnected) {
    return { success: false, message: "Bot is not connected" };
  }

  isAutoMoving = !isAutoMoving;
  if (isAutoMoving) {
    startAutoMovement();
  } else {
    stopAutoMovement();
  }
  saveSettings();
  return {
    success: true,
    message: `Auto movement ${isAutoMoving ? "enabled" : "disabled"}`,
  };
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
    const allPlayers = Object.values(bot.players).map((player) => ({
      playerUsername: player.username,
      uuid: player.uuid,
      ping: player.ping,
    }));
    const players = allPlayers.filter(
      (player) => player.playerUsername !== bot.username
    );
    return {
      online: true,
      botUsername,
      connectionStatus,
      connectionError,
      health: bot.health,
      food: bot.food,
      oxygen: bot.oxygenLevel,
      location: bot.entity.position,
      weather,
      serverTime,
      timeOfDayDescription,
      experience: bot.experience,
      inventory: botInventory,
      nearbyEntities,
      players,
      allPlayers,
      isAutoMoving,
      isDead,
      keepWeatherEnabled,
      targetWeather,
      keepTimeEnabled,
      targetTime,
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

      if (timeOfDay >= 5500 && timeOfDay <= 6500) {
        timeOfDayDescription = "Noon";
      } else if (timeOfDay >= 17500 && timeOfDay <= 18500) {
        timeOfDayDescription = "Midnight";
      } else if (timeOfDay >= 0 && timeOfDay < 12000) {
        timeOfDayDescription = "Day";
      } else if (timeOfDay >= 12000 && timeOfDay < 24000) {
        timeOfDayDescription = "Night";
      } else {
        timeOfDayDescription = "Unknown";
      }

      weather = bot.isRaining ? "raining" : "clear";
    } catch (e) {
      serverTime = "unknown";
      timeOfDayDescription = "Unknown";
    }
  }
}

function updateInventory() {
  if (bot && isConnected && bot.inventory) {
    try {
      botInventory = bot.inventory.slots
        .map((item, index) =>
          item
            ? {
                slot: index,
                name: item.name,
                count: item.count,
                displayName: item.displayName,
              }
            : null
        )
        .filter((item) => item !== null);
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

function getConnectionStatus() {
  return {
    isConnected,
    status: connectionStatus,
    error: connectionError,
    isAutoMoving,
    isDead,
  };
}

function kickPlayer(playerUsername) {
  if (bot && isConnected) {
    bot.chat(`/kick ${playerUsername}`);
    return { success: true, message: `Kicked ${playerUsername}` };
  }
  return { success: false, message: "Bot is not connected" };
}

function banPlayer(playerUsername) {
  if (bot && isConnected) {
    bot.chat(`/ban ${playerUsername}`);
    return { success: true, message: `Banned ${playerUsername}` };
  }
  return { success: false, message: "Bot is not connected" };
}

function killPlayer(playerUsername) {
  if (bot && isConnected) {
    bot.chat(`/kill ${playerUsername}`);
    return { success: true, message: `Killed ${playerUsername}` };
  }
  return { success: false, message: "Bot is not connected" };
}

function healPlayer(playerUsername) {
  if (bot && isConnected) {
    bot.chat(`/effect give ${playerUsername} minecraft:regeneration 10 5`);
    return { success: true, message: `Healed ${playerUsername}` };
  }
  return { success: false, message: "Bot is not connected" };
}

function starvePlayer(playerUsername) {
  if (bot && isConnected) {
    bot.chat(`/effect clear ${playerUsername}`);
    bot.chat(`/effect give ${playerUsername} minecraft:hunger 30 255`);
    return {
      success: true,
      message: `Applied hunger effect and cleared positive effects to ${playerUsername}`,
    };
  }
  return { success: false, message: "Bot is not connected" };
}

function feedPlayer(playerUsername) {
  if (bot && isConnected) {
    bot.chat(`/effect clear ${playerUsername}`);
    bot.chat(`/effect give ${playerUsername} minecraft:saturation 30 50`);
    return {
      success: true,
      message: `Applied saturation effect and cleared negative effects to ${playerUsername}`,
    };
  }
  return { success: false, message: "Bot is not connected" };
}

function tpBotToPlayer(playerUsername) {
  if (bot && isConnected) {
    bot.chat(`/tp @s ${playerUsername}`);
    return { success: true, message: `Teleported bot to ${playerUsername}` };
  }
  return { success: false, message: "Bot is not connected" };
}

function tpPlayerToPlayer(fromPlayerUsername, toPlayerUsername) {
  if (bot && isConnected) {
    bot.chat(`/tp ${fromPlayerUsername} ${toPlayerUsername}`);
    return {
      success: true,
      message: `Teleported ${fromPlayerUsername} to ${toPlayerUsername}`,
    };
  }
  return { success: false, message: "Bot is not connected" };
}

async function dropItemFromSlot(slot, amount) {
  if (!bot || !isConnected) {
    return { success: false, message: "Bot is not connected" };
  }
  try {
    const item = bot.inventory.slots[slot];
    if (!item || item.count < amount) {
      return { success: false, message: "Invalid slot or insufficient items" };
    }
    await bot.toss(item.type, null, amount);
    return {
      success: true,
      message: `Dropped ${amount} items from slot ${slot}`,
    };
  } catch (err) {
    console.error("Error dropping items:", err);
    return { success: false, message: "Failed to drop items" };
  }
}

async function dropStacksFromSlots(slots) {
  if (!bot || !isConnected) {
    return { success: false, message: "Bot is not connected" };
  }
  try {
    const results = [];
    for (const slot of slots) {
      const item = bot.inventory.slots[slot];
      if (item) {
        await bot.tossStack(item);
        results.push(`Dropped entire stack from slot ${slot}`);
      } else {
        results.push(`No item in slot ${slot}`);
      }
    }
    return { success: true, message: results.join(", ") };
  } catch (err) {
    console.error("Error dropping stacks:", err);
    return { success: false, message: "Failed to drop stacks" };
  }
}

async function dropAllItems() {
  if (!bot || !isConnected) {
    return { success: false, message: "Bot is not connected" };
  }
  try {
    const items = bot.inventory.items();
    if (items.length === 0) {
      return { success: true, message: "Inventory is already empty" };
    }
    for (const item of items) {
      await bot.tossStack(item);
    }
    return { success: true, message: "Dropped all items from inventory" };
  } catch (err) {
    console.error("Error dropping all items:", err);
    return { success: false, message: "Failed to drop all items" };
  }
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
  setKeepWeather,
  setKeepTime,
  kickPlayer,
  banPlayer,
  killPlayer,
  healPlayer,
  starvePlayer,
  feedPlayer,
  tpBotToPlayer,
  tpPlayerToPlayer,
  dropItemFromSlot,
  dropStacksFromSlots,
  dropAllItems,
  chatHistory,
};
