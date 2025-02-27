// db.js
const { MongoClient } = require("mongodb");
require("dotenv").config();

// Replace with your MongoDB connection URI and database name
const uri = process.env.DB_URI;
const dbName = process.env.DB_NAME;

let db;
let client;

async function connect() {
  if (!db) {
    client = new MongoClient(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    try {
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

async function getConnectionDetails() {
  const database = await connect();
  const collection = database.collection("connectionDetails");
  return await collection.findOne({ _id: "current" });
}

async function saveConnectionDetails(ip, port, userDisconnected) {
  const database = await connect();
  const collection = database.collection("connectionDetails");
  try {
    await collection.updateOne(
      { _id: "current" },
      { $set: { ip, port: parseInt(port), userDisconnected } },
      { upsert: true }
    );
    console.log(
      `Saved connection details: ${ip}:${port}, userDisconnected: ${userDisconnected}`
    );
  } catch (err) {
    console.error("Error saving connection details:", err);
    throw err;
  }
}

async function close() {
  if (client) {
    await client.close();
    db = null;
    console.log("MongoDB connection closed");
  }
}

module.exports = {
  connect,
  getConnectionDetails,
  saveConnectionDetails,
  close,
};
