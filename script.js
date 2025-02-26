// Bot Controller Script

// Configuration
const API_URL = 'https://aternos-afk-bot-79in.onrender.com'; // Change this to your backend URL if needed
let statusUpdateInterval = null;
let logUpdateInterval = null;

// DOM Helper Functions
function $(selector) {
  return document.querySelector(selector);
}

function showMessage(message, type = 'info') {
  const alertBox = $('#alerts');
  const alert = document.createElement('div');
  alert.className = `alert alert-${type}`;
  alert.innerHTML = message;
  
  alertBox.appendChild(alert);
  
  // Auto-remove the alert after 5 seconds
  setTimeout(() => {
    alert.style.opacity = '0';
    setTimeout(() => alertBox.removeChild(alert), 500);
  }, 5000);
}

// Parse server address and port from combined format
function parseServerAddress(address) {
  if (!address) return { host: '', port: 25565 };
  
  // Check if the address contains a port
  if (address.includes(':')) {
    const [host, portStr] = address.split(':');
    const port = parseInt(portStr);
    return { host, port: isNaN(port) ? 25565 : port };
  }
  
  return { host: address, port: 25565 };
}

// API Functions
// Modify the callApi function to better handle backend connection errors
async function callApi(endpoint, method = 'GET', data = null) {
    try {
      const options = {
        method,
        headers: {
          'Content-Type': 'application/json'
        }
      };
      
      if (data) {
        options.body = JSON.stringify(data);
      }
      
      const response = await fetch(`${API_URL}${endpoint}`, options);
      const result = await response.json();
      
      return result;
    } catch (error) {
      console.error('API Error:', error);
      
      // Check if the error is due to network connectivity (backend not found)
      if (error.message && (
          error.message.includes('Failed to fetch') || 
          error.message.includes('NetworkError') ||
          error.message.includes('Network request failed'))) {
        showMessage('Backend server not found. Please check if it\'s running.', 'danger');
        
        // Update connection status to show backend error
        $('#connection-status').textContent = 'Backend Error';
        $('#connection-status').className = 'badge badge-danger';
      } else {
        showMessage(`API Error: ${error.message}`, 'danger');
      }
      
      return { success: false, message: error.message };
    }
  }

// Bot Control Functions
async function startBot() {
  const serverAddress = $('#server-host').value.trim();
  const { host, port } = parseServerAddress(serverAddress);
  
  if (!host) {
    showMessage('Please enter a server host', 'warning');
    return;
  }
  
  $('#start-btn').disabled = true;
  $('#start-btn').textContent = 'Connecting...';
  
  const result = await callApi('/start-bot', 'POST', { host, port });
  
  if (result.success) {
    // Save server connection info to localStorage
    localStorage.setItem('lastServerAddress', serverAddress);
    showMessage(`Bot connecting to ${host}:${port}`, 'success');
    startStatusUpdates();
    startLogUpdates();
  } else {
    showMessage(`Failed to start bot: ${result.message}`, 'danger');
    $('#start-btn').disabled = false;
    $('#start-btn').textContent = 'Connect Bot';
  }
}

async function stopBot() {
  const result = await callApi('/stop-bot', 'POST');
  
  if (result.success) {
    showMessage('Bot stopped', 'success');
    stopStatusUpdates();
    stopLogUpdates();
    resetStatsToDefault();
    // Clear saved server connection info
    localStorage.removeItem('lastServerAddress');
  } else {
    showMessage(`Failed to stop bot: ${result.message}`, 'danger');
  }
}

async function restartBot() {
  const result = await callApi('/restart-bot', 'POST');
  
  if (result.success) {
    showMessage('Bot restarting...', 'info');
  } else {
    showMessage(`Failed to restart bot: ${result.message}`, 'danger');
  }
}

async function killBot() {
  const result = await callApi('/kill-bot', 'POST');
  
  if (result.success) {
    showMessage('Bot killed', 'warning');
  } else {
    showMessage(`Failed to kill bot: ${result.message}`, 'danger');
  }
}

async function respawnBot() {
  const result = await callApi('/respawn-bot', 'POST');
  
  if (result.success) {
    showMessage('Bot respawning', 'info');
  } else {
    showMessage(`Failed to respawn bot: ${result.message}`, 'danger');
  }
}

async function feedBot() {
  const result = await callApi('/feed-bot', 'POST');
  
  if (result.success) {
    showMessage(result.message, 'success');
  } else {
    showMessage(`Failed to feed bot: ${result.message}`, 'warning');
  }
}

async function setWeather(weatherType) {
  const result = await callApi('/set-weather', 'POST', { weatherType });
  
  if (result.success) {
    showMessage(`Weather set to ${weatherType}`, 'info');
  } else {
    showMessage(`Failed to set weather: ${result.message}`, 'danger');
  }
}

async function setTime(timeValue) {
  const result = await callApi('/set-time', 'POST', { timeValue });
  
  if (result.success) {
    showMessage(`Time set to ${timeValue}`, 'info');
  } else {
    showMessage(`Failed to set time: ${result.message}`, 'danger');
  }
}

async function teleportBot() {
  const x = parseFloat($('#teleport-x').value);
  const y = parseFloat($('#teleport-y').value);
  const z = parseFloat($('#teleport-z').value);
  
  if (isNaN(x) || isNaN(y) || isNaN(z)) {
    showMessage('Please enter valid coordinates', 'warning');
    return;
  }
  
  const result = await callApi('/teleport', 'POST', { x, y, z });
  
  if (result.success) {
    showMessage(`Teleporting to ${x}, ${y}, ${z}`, 'info');
  } else {
    showMessage(`Failed to teleport: ${result.message}`, 'danger');
  }
}

async function sendChat() {
  const message = $('#chat-message').value.trim();
  
  if (!message) {
    showMessage('Please enter a message', 'warning');
    return;
  }
  
  const result = await callApi('/send-chat', 'POST', { message });
  
  if (result.success) {
    $('#chat-message').value = '';
    $('#chat-log').innerHTML += `<div class="chat-message outgoing"><span class="sender">Bot:</span> ${message}</div>`;
    $('#chat-log').scrollTop = $('#chat-log').scrollHeight;
  } else {
    showMessage(`Failed to send message: ${result.message}`, 'danger');
  }
}

async function executeCommand() {
  const command = $('#command-input').value.trim();
  
  if (!command) {
    showMessage('Please enter a command', 'warning');
    return;
  }
  
  const result = await callApi('/execute-command', 'POST', { command });
  
  if (result.success) {
    $('#command-input').value = '';
    showMessage(`Command executed: /${command}`, 'info');
  } else {
    showMessage(`Failed to execute command: ${result.message}`, 'danger');
  }
}

async function toggleAutoMovement() {
  const result = await callApi('/toggle-auto-movement', 'POST');
  
  if (result.success) {
    showMessage(result.message, 'info');
    updateStatus();
  } else {
    showMessage(`Failed to toggle auto movement: ${result.message}`, 'danger');
  }
}

async function collectItems() {
  const result = await callApi('/collect-items', 'POST');
  
  if (result.success) {
    showMessage('Collecting nearby items', 'info');
  } else {
    showMessage(`Failed to collect items: ${result.message}`, 'warning');
  }
}

// Manually refresh bot stats
async function refreshBotStats() {
  showMessage('Refreshing bot stats...', 'info');
  await updateStatus();
}

// Status Updates
async function updateStatus() {
  try {
    const status = await callApi('/bot-status');
    
    if (status.online) {
      $('#connection-status').textContent = 'Connected';
      $('#connection-status').className = 'badge badge-success';
      
      $('#start-btn').disabled = true;
      $('#start-btn').textContent = 'Connected';
      $('#stop-btn').disabled = false;
      $('#restart-btn').disabled = false;
      $('#control-panel').classList.remove('disabled');
      
      // Update health bar
      if (status.health !== undefined) {
        const healthPercent = Math.max(0, Math.min(100, (status.health / 20) * 100));
        $('#health-bar').style.width = `${healthPercent}%`;
        $('#health-value').textContent = `${status.health.toFixed(1)}/20`;
        
        if (healthPercent > 60) {
          $('#health-bar').className = 'progress-bar bg-success';
        } else if (healthPercent > 30) {
          $('#health-bar').className = 'progress-bar bg-warning';
        } else {
          $('#health-bar').className = 'progress-bar bg-danger';
        }
      }
      
      // Update food bar
      if (status.food !== undefined) {
        const foodPercent = Math.max(0, Math.min(100, (status.food / 20) * 100));
        $('#food-bar').style.width = `${foodPercent}%`;
        $('#food-value').textContent = `${status.food.toFixed(1)}/20`;
        
        if (foodPercent > 60) {
          $('#food-bar').className = 'progress-bar bg-success';
        } else if (foodPercent > 30) {
          $('#food-bar').className = 'progress-bar bg-warning';
        } else {
          $('#food-bar').className = 'progress-bar bg-danger';
        }
      }
      
      // Update position
      if (status.location) {
        $('#bot-x').textContent = `X= ${status.location.x.toFixed(1)}`;
        $('#bot-y').textContent = `Y= ${status.location.y.toFixed(1)}`;
        $('#bot-z').textContent = `Z= ${status.location.z.toFixed(1)}`;
        
        // Pre-fill teleport inputs with current location
        $('#teleport-x').value = Math.round(status.location.x);
        $('#teleport-y').value = Math.round(status.location.y);
        $('#teleport-z').value = Math.round(status.location.z);
      }
      
      // Update weather and time
      if (status.weather) {
        $('#server-weather').textContent = `Weather = ${status.weather.charAt(0).toUpperCase() + status.weather.slice(1)}`;
      }
      
      if (status.serverTime) {
        $('#server-time').textContent = `Time = ${status.serverTime}`;
      }
      
      // Update inventory
      if (status.inventory && status.inventory.length) {
        const inventoryItems = status.inventory.map(item => {
          return `<div class="inventory-item" title="${item.displayName}">
                    <div class="item-count">${item.count}</div>
                    <div class="item-name">${item.name.replace(/_/g, ' ')}</div>
                  </div>`;
        }).join('');
        
        $('#inventory-list').innerHTML = inventoryItems;
      } else {
        $('#inventory-list').innerHTML = '<div class="text-muted">No items</div>';
      }
      
      // Update nearby entities
      if (status.nearbyEntities && status.nearbyEntities.length) {
        const entityList = status.nearbyEntities.map(entity => {
          return `<li class="list-group-item d-flex justify-content-between align-items-center">
                    ${entity.name}
                    <span class="badge badge-primary badge-pill">${entity.distance}</span>
                  </li>`;
        }).join('');
        
        $('#entity-list').innerHTML = entityList;
      } else {
        $('#entity-list').innerHTML = '<li class="list-group-item">No entities nearby</li>';
      }
      
      // Update auto-movement status
      $('#auto-movement-status').textContent = status.isAutoMoving ? 'ON' : 'OFF';
      $('#auto-movement-status').className = status.isAutoMoving ? 'badge badge-success' : 'badge badge-secondary';
      
      // Update dead status
      if (status.isDead) {
        $('#respawn-btn').disabled = false;
        $('#dead-status').style.display = 'inline-flex';
      } else {
        $('#respawn-btn').disabled = true;
        $('#dead-status').style.display = 'none';
      }
      
      // Start update intervals if not already running
      startUpdateIntervalsIfNeeded();
      
    } else {
      $('#connection-status').textContent = status.connectionStatus || 'Disconnected';
      $('#connection-status').className = 'badge badge-danger';
      
      $('#start-btn').disabled = false;
      $('#start-btn').textContent = 'Connect Bot';
      $('#stop-btn').disabled = true;
      $('#restart-btn').disabled = true;
      $('#control-panel').classList.add('disabled');
      
      if (status.connectionError) {
        showMessage(`Connection error: ${status.connectionError}`, 'danger');
      }
      
      // If we were previously connected but now disconnected, clear the intervals
      stopUpdateIntervalsIfConnected();
    }
  } catch (error) {
    console.error('Status update error:', error);
    stopStatusUpdates();
    stopLogUpdates();
    $('#connection-status').textContent = 'Error';
    $('#connection-status').className = 'badge badge-danger';
    $('#start-btn').disabled = false;
    $('#control-panel').classList.add('disabled');
  }
}

// Start update intervals if needed
function startUpdateIntervalsIfNeeded() {
  if (!statusUpdateInterval) {
    statusUpdateInterval = setInterval(updateStatus, 2000);
  }
  
  if (!logUpdateInterval) {
    logUpdateInterval = setInterval(updateLogs, 5000);
  }
}

// Stop update intervals if we were connected
function stopUpdateIntervalsIfConnected() {
  if (statusUpdateInterval || logUpdateInterval) {
    stopStatusUpdates();
    stopLogUpdates();
  }
}

async function updateLogs() {
    try {
      const logs = await callApi('/log-history');
      
      if (!logs || !logs.length) return;
      
      // Sort logs chronologically (oldest to newest)
      const sortedLogs = [...logs].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      
      const logHTML = sortedLogs.map(log => {
        let logClass = '';
        let icon = '';
        
        switch(log.type) {
          case 'system':
            logClass = 'text-muted';
            icon = '<i class="fas fa-cog"></i>';
            break;
          case 'chat':
            logClass = 'text-primary';
            icon = '<i class="fas fa-comment"></i>';
            break;
          case 'command':
            logClass = 'text-warning';
            icon = '<i class="fas fa-terminal"></i>';
            break;
          case 'action':
            logClass = 'text-success';
            icon = '<i class="fas fa-play"></i>';
            break;
          case 'movement':
            logClass = 'text-info';
            icon = '<i class="fas fa-walking"></i>';
            break;
          default:
            icon = '<i class="fas fa-info-circle"></i>';
        }
        
        const time = new Date(log.timestamp).toLocaleTimeString();
        
        return `<div class="log-entry ${logClass}">
                  <span class="log-time">${time}</span>
                  <span class="log-icon">${icon}</span>
                  <span class="log-message">${log.message}</span>
                </div>`;
      }).join('');
      
      $('#server-logs').innerHTML = logHTML;
      
      // Always scroll to the bottom after updating logs
      $('#server-logs').scrollTop = $('#server-logs').scrollHeight;
    } catch (error) {
      console.error('Log update error:', error);
    }
  }

function startStatusUpdates() {
  if (!statusUpdateInterval) {
    updateStatus();
    statusUpdateInterval = setInterval(updateStatus, 2000);
  }
}

function stopStatusUpdates() {
  if (statusUpdateInterval) {
    clearInterval(statusUpdateInterval);
    statusUpdateInterval = null;
  }
}

function startLogUpdates() {
  if (!logUpdateInterval) {
    updateLogs();
    logUpdateInterval = setInterval(updateLogs, 5000);
  }
}

function stopLogUpdates() {
  if (logUpdateInterval) {
    clearInterval(logUpdateInterval);
    logUpdateInterval = null;
  }
}

// Set default "NA" values for stats before data is loaded
function resetStatsToDefault() {
  // Reset health and food bars
  $('#health-bar').style.width = '0%';
  $('#health-value').textContent = 'N/A';
  $('#food-bar').style.width = '0%';
  $('#food-value').textContent = 'N/A';
  
  // Reset position
  $('#bot-x').textContent = 'X= N/A';
  $('#bot-y').textContent = 'Y= N/A';
  $('#bot-z').textContent = 'Z= N/A';
  
  // Reset weather and time
  $('#server-weather').textContent = 'Weather = N/A';
  $('#server-time').textContent = 'Time = N/A';
  
  // Reset inventory
  $('#inventory-list').innerHTML = '<div class="text-muted">No data available</div>';
  
  // Reset entities
  $('#entity-list').innerHTML = '<li class="list-group-item">No data available</li>';
  
  // Reset auto-movement
  $('#auto-movement-status').textContent = 'N/A';
  $('#auto-movement-status').className = 'badge badge-secondary';
}

// Check if the bot is connected on page load/refresh
async function checkInitialConnection() {
  try {
    const status = await callApi('/bot-status');
    
    // If the bot is online, start update intervals
    if (status.online) {
      // Fill in the server address if it's saved in localStorage
      const savedAddress = localStorage.getItem('lastServerAddress');
      if (savedAddress) {
        $('#server-host').value = savedAddress;
      }
      
      startStatusUpdates();
      startLogUpdates();
    } else {
      // If we have a saved server address but not connected, attempt to connect
      const savedAddress = localStorage.getItem('lastServerAddress');
      if (savedAddress) {
        $('#server-host').value = savedAddress;
        // Optional: auto-connect if there's a saved address
        // startBot();
      }
    }
  } catch (error) {
    console.error('Initial connection check error:', error);
  }
}

// Initialize the app
function initApp() {
  // Reset stats to default "NA" values
  resetStatsToDefault();
  
  // Set up event listeners
  $('#connect-form').addEventListener('submit', (e) => {
    e.preventDefault();
    startBot();
  });
  
  $('#stop-btn').addEventListener('click', stopBot);
  $('#restart-btn').addEventListener('click', restartBot);
  $('#kill-btn').addEventListener('click', killBot);
  $('#respawn-btn').addEventListener('click', respawnBot);
  $('#feed-btn').addEventListener('click', feedBot);
  $('#feed-btn-inv').addEventListener('click', feedBot);
  $('#refresh-stats').addEventListener('click', refreshBotStats);
  
  $('#weather-clear').addEventListener('click', () => setWeather('clear'));
  $('#weather-rain').addEventListener('click', () => setWeather('rain'));
  $('#weather-thunder').addEventListener('click', () => setWeather('thunder'));
  
  $('#time-day').addEventListener('click', () => setTime('day'));
  $('#time-night').addEventListener('click', () => setTime('night'));
  $('#time-noon').addEventListener('click', () => setTime('noon'));
  $('#time-midnight').addEventListener('click', () => setTime('midnight'));
  
  $('#teleport-form').addEventListener('submit', (e) => {
    e.preventDefault();
    teleportBot();
  });
  
  $('#chat-form').addEventListener('submit', (e) => {
    e.preventDefault();
    sendChat();
  });
  
  $('#command-form').addEventListener('submit', (e) => {
    e.preventDefault();
    executeCommand();
  });
  
  $('#toggle-auto-movement').addEventListener('click', toggleAutoMovement);
  $('#collect-items-btn').addEventListener('click', collectItems);
  $('#collect-items-btn-inv').addEventListener('click', collectItems);
  
  // Update placeholders for server input
  $('#server-host').placeholder = "e.g. server.aternos.me:12345";
  
  // Check initial connection status and start updates if connected
  checkInitialConnection();

  // Check connection status periodically even when not connected
  // This helps to detect if the server has started the bot separately
  setInterval(async () => {
    if (!statusUpdateInterval) {
      await checkInitialConnection();
    }
  }, 10000);

  // Add window event listener to handle page visibility changes
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      // When page becomes visible again, check connection
      checkInitialConnection();
    }
  });
}

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', initApp);