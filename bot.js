const mineflayer = require('mineflayer');
const cmd = require('mineflayer-cmd').plugin;
const pathfinder = require('mineflayer-pathfinder').pathfinder;
const { GoalBlock } = require('mineflayer-pathfinder').goals;

// Declare bot variable and connection status
let bot;
let isConnected = false;
let connectionStatus = 'disconnected'; // 'connecting', 'connected', 'disconnected', 'error'
let connectionError = '';
let lastChatTime = 0;
let botInventory = [];
let nearbyEntities = [];
let serverTime = 'unknown';
let weather = 'unknown';

// Bot movement behavior variables
let isAutoMoving = false;
let movementInterval;

// Bot state variables
let isDead = false;
let lastFoodLevel = 20; // Track food level changes

// Function to start the bot with the correct version
function startBot(host, port) {
    if (isConnected) {
        console.log("Bot is already connected.");
        return { success: false, message: "Bot is already connected" };
    }

    console.log(`Starting bot with host: ${host}, port: ${port}`);
    connectionStatus = 'connecting';
    connectionError = '';

    // Set the Minecraft version explicitly (1.20.1)
    const minecraftVersion = "1.20.1";

    // Create a new Minecraft bot instance
    bot = mineflayer.createBot({
        host: host,
        port: port,
        username: 'Lalkuthi_Server',
        version: minecraftVersion,
        protocolVersion: 764,
        checkTimeoutInterval: 30000,
        keepAlive: true
    });

    // Load plugins
    bot.loadPlugin(cmd);
    bot.loadPlugin(pathfinder);

    // Event when bot connects to the server
    bot.on('connect', () => {
        connectionStatus = 'connecting';
        console.log('Bot connected to server');
    });

    // Event when bot logs in
    bot.on('login', () => {
        isConnected = true;
        connectionStatus = 'connected';
        isDead = false;
        console.log('Bot logged in');
        
        // Start automatic movement
        startAutoMovement();
    });

    // Event when bot disconnects
    bot.on('end', (reason) => {
        isConnected = false;
        connectionStatus = 'disconnected';
        console.log('Bot disconnected from server. Reason:', reason);
        
        // Stop automatic movement
        stopAutoMovement();
    });

    // Event when the bot encounters an error
    bot.on('error', (err) => {
        isConnected = false;
        connectionStatus = 'error';
        connectionError = err.message;
        console.error('Bot error:', err);
        
        // Stop automatic movement
        stopAutoMovement();
    });

    // Event when the bot spawns in the game world
    bot.once('spawn', () => {
        console.log('Bot has spawned');
        isDead = false;
    });

    // Event when the bot dies
    bot.on('death', () => {
        console.log('Bot has died');
        isDead = true;
        // Stop auto movement when dead
        if (isAutoMoving) {
            stopAutoMovement();
            isAutoMoving = false; // Will be restarted on respawn
        }
    });

    // Event for respawning
    bot.on('spawn', () => {
        if (isDead) {
            console.log('Bot has respawned');
            isDead = false;
            // Restart auto movement if it was on before
            if (isAutoMoving) {
                startAutoMovement();
            }
        }
    });

    // Event when the bot chats
    bot.on('chat', (username, message) => {
        lastChatTime = Date.now();
        console.log(`[CHAT] ${username}: ${message}`);

        // Respond to certain chat commands
        if (message.toLowerCase().includes('hello bot') && username !== bot.username) {
            bot.chat(`Hello, ${username}!`);
        }
    });

    // Event when bot's health changes
    bot.on('health', () => {
        console.log(`Bot health updated: ${bot.health}`);
        
        // Track food level changes
        if (bot.food !== lastFoodLevel) {
            lastFoodLevel = bot.food;
            console.log(`Bot food level: ${bot.food}`);
        }
    });

    // Event when rain starts or stops
    bot.on('rain', () => {
        weather = bot.isRaining ? 'raining' : 'clear';
        console.log(`Weather changed: ${weather}`);
    });

    // Event for tracking nearby entities
    bot.on('entityUpdate', (entity) => {
        updateNearbyEntities();
    });

    // Update inventory when it changes
    bot.on('inventoryChanged', () => {
        updateInventory();
    });

    return { success: true, message: "Bot connecting to server" };
}

// Function to stop the bot
function stopBot() {
    if (bot && isConnected) {
        // Stop automatic movement
        stopAutoMovement();
        
        bot.quit();
        isConnected = false;
        connectionStatus = 'disconnected';
        console.log('Bot has been stopped');
        return { success: true, message: "Bot stopped successfully" };
    } else {
        console.log('Bot is not connected');
        return { success: false, message: "Bot is not connected" };
    }
}

// Function to restart the bot
function restartBot() {
    const currentHost = bot?.entity?.username ? bot.socket._host : null;
    const currentPort = bot?.entity?.username ? bot.socket._port : null;
    
    if (!currentHost || !currentPort) {
        return { success: false, message: "Cannot restart: Bot connection information not available" };
    }
    
    const result = stopBot();
    if (!result.success) {
        return result;
    }
    
    // Short delay before reconnecting
    setTimeout(() => {
        startBot(currentHost, currentPort);
    }, 1000);
    
    return { success: true, message: "Bot is restarting..." };
}

// Function to kill the bot (self-harm command)
function killBot() {
    if (bot && isConnected) {
        if (isDead) {
            return { success: false, message: "Bot is already dead" };
        }
        
        bot.chat("/kill");
        isDead = true;
        return { success: true, message: "Bot killed" };
    } else {
        return { success: false, message: "Bot is not connected" };
    }
}

// Function to respawn the bot
function respawnBot() {
    if (bot && isConnected) {
        if (!isDead) {
            return { success: false, message: "Bot is not dead" };
        }
        
        bot._client.write('client_command', { payload: 0 }); // 0 = respawn
        isDead = false;
        return { success: true, message: "Bot respawning" };
    } else {
        return { success: false, message: "Bot is not connected" };
    }
}

// Function to feed the bot
function feedBot() {
    if (bot && isConnected) {
        // Look for food items in the inventory
        const foodItems = bot.inventory.items().filter(item => 
            ['apple', 'bread', 'cooked_beef', 'cooked_chicken', 'cooked_porkchop', 
             'carrot', 'baked_potato', 'cooked_cod', 'cooked_salmon', 'golden_apple',
             'enchanted_golden_apple', 'cake', 'cookie', 'melon_slice', 'dried_kelp',
             'beef', 'chicken', 'porkchop', 'mutton', 'rabbit'].includes(item.name)
        );
        
        if (foodItems.length === 0) {
            return { success: false, message: "No food found in inventory" };
        }
        
        // Equip and eat the first food item
        bot.equip(foodItems[0], 'hand')
            .then(() => {
                bot.consume()
                    .catch(err => {
                        console.error('Error consuming food:', err);
                    });
            })
            .catch(err => {
                console.error('Error equipping food:', err);
            });
        
        return { success: true, message: `Eating ${foodItems[0].name}` };
    } else {
        return { success: false, message: "Bot is not connected" };
    }
}

// Function to starve the bot (decrease food level if in creative/with permissions)
function starveBot() {
    if (bot && isConnected) {
        // Try using a command to reduce hunger (requires permissions)
        bot.chat("/effect give @s minecraft:hunger 30 255");
        return { success: true, message: "Applied hunger effect" };
    } else {
        return { success: false, message: "Bot is not connected" };
    }
}

// Function to change weather (requires op permissions)
function setWeather(weatherType) {
    if (bot && isConnected) {
        if (weatherType === 'clear') {
            bot.chat("/weather clear");
        } else if (weatherType === 'rain') {
            bot.chat("/weather rain");
        } else if (weatherType === 'thunder') {
            bot.chat("/weather thunder");
        } else {
            return { success: false, message: "Invalid weather type" };
        }
        
        return { success: true, message: `Setting weather to ${weatherType}` };
    } else {
        return { success: false, message: "Bot is not connected" };
    }
}

// Function to set game time (requires op permissions)
function setTime(timeValue) {
    if (bot && isConnected) {
        bot.chat(`/time set ${timeValue}`);
        return { success: true, message: `Setting time to ${timeValue}` };
    } else {
        return { success: false, message: "Bot is not connected" };
    }
}

// Function to start automatic movement
function startAutoMovement() {
    if (!isAutoMoving && bot && isConnected) {
        isAutoMoving = true;
        
        // Execute random movement every 10-15 seconds
        movementInterval = setInterval(() => {
            try {
                if (bot && bot.entity) {
                    // Random chance to look around or move
                    const action = Math.random();
                    
                    if (action < 0.3) {
                        // Look around randomly
                        bot.look(Math.random() * Math.PI * 2, Math.random() * Math.PI - (Math.PI / 2));
                    } else if (action < 0.7) {
                        // Try to find a safe place to move to
                        const currentPos = bot.entity.position;
                        
                        // Get blocks around the bot to check if they're safe to walk on
                        const offset = 5; // Maximum distance to move
                        const dx = Math.floor(Math.random() * offset * 2) - offset;
                        const dz = Math.floor(Math.random() * offset * 2) - offset;
                        
                        const targetX = Math.floor(currentPos.x) + dx;
                        const targetZ = Math.floor(currentPos.z) + dz;
                        
                        // Try to find a good Y position
                        bot.pathfinder.setGoal(new GoalBlock(targetX, Math.floor(currentPos.y), targetZ));
                    } else {
                        // Collect nearby items
                        collectItems();
                    }
                }
            } catch (err) {
                console.error('Error in automatic movement:', err);
            }
        }, Math.random() * 5000 + 10000); // Random interval between 10-15 seconds
        
        console.log('Automatic movement started');
    }
}

// Function to stop automatic movement
function stopAutoMovement() {
    if (isAutoMoving) {
        clearInterval(movementInterval);
        isAutoMoving = false;
        console.log('Automatic movement stopped');
    }
}

// Function to send a chat message
function sendChatMessage(message) {
    if (bot && isConnected) {
        bot.chat(message);
        console.log(`Bot sent chat message: ${message}`);
        return { success: true, message: "Message sent" };
    } else {
        console.log('Bot is not connected');
        return { success: false, message: "Bot is not connected" };
    }
}

// Function to execute a command
function executeCommand(command) {
    if (bot && isConnected) {
        bot.chat(`/${command}`);
        console.log(`Bot executed command: /${command}`);
        return { success: true, message: `Command executed: /${command}` };
    } else {
        return { success: false, message: "Bot is not connected" };
    }
}

// Function to get the bot status
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
            inventory: botInventory.slice(0, 9), // First 9 slots (hotbar)
            nearbyEntities,
            isAutoMoving,
            isDead
        };
    }
    return { 
        online: false, 
        connectionStatus, 
        connectionError 
    };
}

// Function to get the bot's current location (x, y, z)
function getBotLocation() {
    if (bot && isConnected && bot.entity && bot.entity.position) {
        const { x, y, z } = bot.entity.position;
        return { x, y, z };
    }
    return { x: null, y: null, z: null };
}

// Function to get the bot's current health
function getBotHealth() {
    if (bot && isConnected) {
        return { 
            health: bot.health,
            food: bot.food,
            oxygen: bot.oxygenLevel 
        };
    }
    return { health: null, food: null, oxygen: null };
}

// Function to get the bot's current action (moving, chatting, idle, etc.)
function getBotAction() {
    if (bot && isConnected && bot.entity) {
        if (isDead) {
            return { action: 'dead' };
        }
        // If automatic movement is enabled
        else if (isAutoMoving) {
            return { action: 'auto-moving' };
        }
        // If the bot has chatted in the last 5 seconds
        else if (Date.now() - lastChatTime < 5000) {
            return { action: 'chatting' };
        }
        return { action: 'idle' };
    }
    return { action: 'offline' };
}

// Function to update the server time
function updateServerTime() {
    if (bot && isConnected) {
        try {
            // Get time of day (0-24000)
            const timeOfDay = bot.time.timeOfDay;
            // Convert to hours (0-24)
            const hours = Math.floor((timeOfDay / 24000) * 24);
            const minutes = Math.floor(((timeOfDay / 24000) * 24 * 60) % 60);
            serverTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
            
            // Update weather
            weather = bot.isRaining ? 'raining' : 'clear';
        } catch (e) {
            serverTime = 'unknown';
        }
    }
}

// Function to update the bot's inventory
function updateInventory() {
    if (bot && isConnected && bot.inventory) {
        try {
            botInventory = bot.inventory.slots
                .filter(item => item !== null)
                .map(item => ({
                    name: item.name,
                    count: item.count,
                    displayName: item.displayName
                }));
        } catch (e) {
            botInventory = [];
        }
    }
}

// Function to update nearby entities
function updateNearbyEntities() {
    if (bot && isConnected) {
        try {
            nearbyEntities = Object.values(bot.entities)
                .filter(entity => entity.type === 'mob' || entity.type === 'object')
                .filter(entity => {
                    if (!entity.position || !bot.entity.position) return false;
                    const dx = entity.position.x - bot.entity.position.x;
                    const dy = entity.position.y - bot.entity.position.y;
                    const dz = entity.position.z - bot.entity.position.z;
                    const distance = Math.sqrt(dx*dx + dy*dy + dz*dz);
                    return distance < 30; // Only include entities within 30 blocks
                })
                .map(entity => ({
                    name: entity.name || entity.username || 'unknown',
                    type: entity.type,
                    distance: Math.sqrt(
                        Math.pow(entity.position.x - bot.entity.position.x, 2) +
                        Math.pow(entity.position.y - bot.entity.position.y, 2) +
                        Math.pow(entity.position.z - bot.entity.position.z, 2)
                    ).toFixed(1)
                }))
                .slice(0, 10); // Limit to 10 entities for performance
        } catch (e) {
            nearbyEntities = [];
        }
    }
}

// Function to collect nearby items
function collectItems() {
    if (bot && isConnected) {
        const items = Object.values(bot.entities).filter(e => e.type === 'object' && e.objectType === 'Item');
        if (items.length === 0) {
            return { success: false, message: "No items found nearby" };
        }
        
        // Find the closest item
        let closest = null;
        let closestDistance = Number.MAX_VALUE;
        items.forEach(item => {
            const distance = bot.entity.position.distanceTo(item.position);
            if (distance < closestDistance) {
                closest = item;
                closestDistance = distance;
            }
        });
        
        if (closest) {
            bot.pathfinder.setGoal(new GoalBlock(
                closest.position.x, 
                closest.position.y, 
                closest.position.z
            ));
            return { success: true, message: `Moving to collect ${items.length} items` };
        }
    }
    return { success: false, message: "Bot is not connected" };
}

// Function to toggle automatic movement
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

// Function to get the connection status
function getConnectionStatus() {
    return { 
        isConnected, 
        status: connectionStatus, 
        error: connectionError,
        isAutoMoving,
        isDead
    };
}

module.exports = {
    startBot,
    stopBot,
    restartBot,
    killBot,
    respawnBot,
    feedBot,
    starveBot,
    setWeather,
    setTime,
    sendChatMessage,
    executeCommand,
    getBotStatus,
    getBotLocation,
    getBotHealth,
    getBotAction,
    getConnectionStatus,
    collectItems,
    toggleAutoMovement,
    isConnected  // Export connection status for debugging purposes
};