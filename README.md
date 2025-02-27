# Minecraft AFK Bot for Aternos Servers

This bot is designed to keep Aternos Minecraft servers active by maintaining an AFK (Away From Keyboard) presence. It works with Minecraft version 1.20.1 with Fabric (Tested).

## Features

- Automatic connection to Minecraft servers
- Auto-movement to prevent being kicked for inactivity
- Health monitoring and auto-respawn
- Food consumption when available
- Weather and time commands
- Chat functionality
- RESTful API for controlling the bot

## Deployment on Render.com

### Prerequisites

- A [Render.com](https://render.com) account
- Git repository with this code

### Deployment Steps

1. Fork or clone this repository to your GitHub account
2. Log in to your Render.com account
3. Click "New" and select "Web Service"
4. Connect your GitHub repository
5. Use the following settings:
   - **Name**: minecraft-afk-bot (or your preferred name)
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
6. Click "Create Web Service"

### Environment Variables

No specific environment variables are required for basic functionality.

## Local Development

1. Clone the repository:
   ```
   git clone https://github.com/Sayor0630/Aternos-AFK-Bot.git
   cd Aternos-AFK-Bot
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Start the server:
   ```
   npm start
   ```

4. The server will run at `http://localhost:3001` (or the port specified in the PORT environment variable)

## API Endpoints

### Bot Management
- `POST /start-bot` - Start the bot with host and port parameters
- `POST /stop-bot` - Stop the bot
- `POST /restart-bot` - Restart the bot
- `POST /kill-bot` - Kill the bot (requires permission in-game)
- `POST /respawn-bot` - Respawn the bot after death

### Bot Status
- `GET /health` - Server health check
- `GET /bot-status` - Get comprehensive bot status
- `GET /connection-status` - Get connection status
- `GET /bot-location` - Get current coordinates
- `GET /bot-health` - Get health, food, and oxygen levels
- `GET /bot-action` - Get current action (idle, moving, etc.)
- `GET /log-history` - Get log of recent actions

### Bot Actions
- `POST /send-chat` - Send a chat message
- `POST /execute-command` - Execute a command
- `POST /teleport` - Teleport to coordinates
- `POST /collect-items` - Collect nearby items
- `POST /toggle-auto-movement` - Toggle automatic movement
- `POST /feed-bot` - Make the bot eat food
- `POST /starve-bot` - Apply hunger effect
- `POST /set-weather` - Set weather (requires op permissions)
- `POST /set-time` - Set time (requires op permissions)

## License

MIT License