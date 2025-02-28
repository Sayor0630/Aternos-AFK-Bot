// db.js
const { MongoClient } = require("mongodb");
require("dotenv").config();

// Configuration from environment variables
const uri = process.env.DB_URI;
const dbName = process.env.DB_NAME;

// Singleton client and db instances
let client = null;
let db = null;

/**
 * Establishes a connection to MongoDB if not already connected.
 * @returns {Promise<Db>} The MongoDB database instance
 */
async function connect() {
  if (!client || !client.topology || !client.topology.isConnected()) {
    try {
      client = new MongoClient(uri);
      await client.connect();
      db = client.db(dbName);
      console.log("Connected to MongoDB");
    } catch (err) {
      console.error("Failed to connect to MongoDB:", err);
      throw err;
    }
  }
  return db;
}

/**
 * Retrieves bot settings from the botSettings collection.
 * @param {string} botName - The bot's unique identifier
 * @returns {Promise<Object|null>} The bot settings document
 */
async function getBotSettings(botName) {
  const database = await connect();
  const collection = database.collection("botSettings");
  return collection.findOne({ _id: botName });
}

/**
 * Saves or updates bot settings in the botSettings collection.
 * @param {string} botName - The bot's unique identifier
 * @param {Object} settings - The settings to save
 * @returns {Promise<void>}
 */
async function saveBotSettings(botName, settings) {
  const database = await connect();
  const collection = database.collection("botSettings");
  try {
    await collection.updateOne(
      { _id: botName },
      { $set: settings },
      { upsert: true }
    );
    console.log(`Saved settings for bot: ${botName}`);
  } catch (err) {
    console.error("Error saving bot settings:", err);
    throw err;
  }
}

/**
 * Retrieves connection details for the configured bot.
 * @returns {Promise<Object|null>} The bot settings including connection details
 */
async function getConnectionDetails() {
  return getBotSettings(process.env.BOT_USERNAME);
}

/**
 * Saves connection details for the configured bot.
 * @param {string} ip - The IP address
 * @param {string|number} port - The port number
 * @param {boolean} userDisconnected - Whether the user is disconnected
 * @returns {Promise<void>}
 */
async function saveConnectionDetails(ip, port, userDisconnected) {
  const botName = process.env.BOT_USERNAME;
  const settings = (await getBotSettings(botName)) || {};
  settings.connection = { ip, port: Number(port), userDisconnected };
  await saveBotSettings(botName, settings);
}

/**
 * Closes the MongoDB connection gracefully.
 * @returns {Promise<void>}
 */
async function close() {
  if (client && client.topology && client.topology.isConnected()) {
    await client.close();
    client = null;
    db = null;
    console.log("MongoDB connection closed");
  }
}

// Export the module functions
module.exports = {
  connect,
  getBotSettings,
  saveBotSettings,
  getConnectionDetails,
  saveConnectionDetails,
  close,
};

// Graceful shutdown handling
process.on("SIGINT", async () => {
  await close();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await close();
  process.exit(0);
});
