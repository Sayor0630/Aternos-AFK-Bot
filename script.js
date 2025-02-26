// Bot Controller Script

// Configuration
const API_URL = "https://aternos-afk-bot-79in.onrender.com"; // Change this to your backend URL if needed
let statusUpdateInterval = null;
let logUpdateInterval = null;
let backendStatus = "disconnected"; // Possible values: "disconnected", "connecting", "connected"

// DOM Helper Functions
function $(selector) {
  return document.querySelector(selector);
}

function disableAllCards() {
  $("#controlTabsContent").classList.add("disabled");
  $("#bot-status-card").classList.add("disabled");
  $("#connection-card").classList.add("disabled");
}

function enableConnectionCard() {
  $("#connection-card").classList.remove("disabled");
  $("#controlTabsContent").classList.add("disabled");
  $("#bot-status-card").classList.add("disabled");
}

function enableAllCards() {
  $("#controlTabsContent").classList.remove("disabled");
  $("#bot-status-card").classList.remove("disabled");
  $("#connection-card").classList.remove("disabled");
}

function showMessage(message, type = "info") {
  const alertBox = $("#alerts");
  const alert = document.createElement("div");
  alert.className = `alert alert-${type}`;
  alert.innerHTML = message;
  alertBox.appendChild(alert);
  setTimeout(() => {
    alert.style.opacity = "0";
    setTimeout(() => alertBox.removeChild(alert), 500);
  }, 5000);
}

// Update Backend Status Display
function updateBackendStatusDisplay() {
  const statusElement = $("#backend-status");
  if (!statusElement) {
    console.warn(
      "Backend status element (#backend-status) not found in HTML. Please add it."
    );
    return;
  }
  switch (backendStatus) {
    case "connected":
      statusElement.textContent = "Connected";
      statusElement.className = "badge badge-success";
      break;
    case "connecting":
      statusElement.textContent = "Connecting";
      statusElement.className = "badge badge-warning";
      break;
    case "disconnected":
      statusElement.textContent = "Disconnected";
      statusElement.className = "badge badge-danger";
      break;
  }
}

// Parse server address and port from combined format
function parseServerAddress(address) {
  if (!address) return { host: "", port: 25565 };
  if (address.includes(":")) {
    const [host, portStr] = address.split(":");
    const port = parseInt(portStr);
    return { host, port: isNaN(port) ? 25565 : port };
  }
  return { host: address, port: 25565 };
}

// API Functions
async function callApi(endpoint, method = "GET", data = null) {
  try {
    const options = {
      method,
      headers: { "Content-Type": "application/json" },
    };
    if (data) options.body = JSON.stringify(data);

    const response = await fetch(`${API_URL}${endpoint}`, options);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    if (error.name === "TypeError" && error.message === "Failed to fetch") {
      backendStatus = "disconnected";
      updateBackendStatusDisplay();
      disableAllCards();
      showMessage(
        "Backend server not found. Please check if it’s running.",
        "danger"
      );
    } else {
      console.error("API Error:", error);
      showMessage(`API Error: ${error.message}`, "danger");
    }
    return { success: false, message: error.message };
  }
}

// Check Backend Availability
async function checkBackendAvailability() {
  backendStatus = "connecting";
  updateBackendStatusDisplay();
  try {
    const response = await fetch(`${API_URL}/health`);
    if (response.ok) {
      backendStatus = "connected";
      updateBackendStatusDisplay();
      enableConnectionCard();
      showMessage("Backend server is now available.", "success");
      const status = await callApi("/bot-status");
      if (status.online) {
        enableAllCards();
        startStatusUpdates();
        startLogUpdates();
      }
    } else {
      backendStatus = "disconnected";
      updateBackendStatusDisplay();
      disableAllCards();
    }
  } catch (error) {
    backendStatus = "disconnected";
    updateBackendStatusDisplay();
    disableAllCards();
  }
}

// Bot Control Functions
async function startBot() {
  const serverAddress = $("#server-host").value.trim();
  const { host, port } = parseServerAddress(serverAddress);
  if (!host) {
    showMessage("Please enter a server host", "warning");
    return;
  }

  $("#start-btn").disabled = true;
  $("#start-btn").textContent = "Connecting...";
  const result = await callApi("/start-bot", "POST", { host, port });

  if (result.success) {
    localStorage.setItem("lastServerAddress", serverAddress);
    showMessage(`Bot connecting to ${host}:${port}`, "success");
    startStatusUpdates();
    startLogUpdates();
  } else {
    showMessage(`Failed to start bot: ${result.message}`, "danger");
    $("#start-btn").disabled = false;
    $("#start-btn").textContent = "Connect Bot";
  }
}

async function stopBot() {
  const result = await callApi("/stop-bot", "POST");
  if (result.success) {
    showMessage("Bot stopped", "success");
    stopStatusUpdates();
    stopLogUpdates();
    resetStatsToDefault();
    enableConnectionCard();
    $("#connection-status").textContent = "Disconnected";
    $("#connection-status").className = "badge badge-danger";
    $("#start-btn").disabled = false;
    $("#start-btn").textContent = "Connect Bot";
    $("#stop-btn").disabled = true;
    $("#restart-btn").disabled = true;
    $("#server-host").disabled = false; // Re-enable input on stop
    localStorage.removeItem("lastServerAddress");
  } else {
    showMessage(`Failed to stop bot: ${result.message}`, "danger");
  }
}

async function restartBot() {
  const result = await callApi("/restart-bot", "POST");
  if (result.success) {
    showMessage("Bot restarting...", "info");
  } else {
    showMessage(`Failed to restart bot: ${result.message}`, "danger");
  }
}

async function killBot() {
  const result = await callApi("/kill-bot", "POST");
  if (result.success) {
    showMessage("Bot killed", "warning");
  } else {
    showMessage(`Failed to kill bot: ${result.message}`, "danger");
  }
}

async function healBot() {
  const result = await callApi("/heal-bot", "POST");
  if (result.success) {
    showMessage("Bot healed", "warning");
  } else {
    showMessage(`Failed to heal bot: ${result.message}`, "danger");
  }
}

async function respawnBot() {
  const result = await callApi("/respawn-bot", "POST");
  if (result.success) {
    showMessage("Bot respawning", "info");
  } else {
    showMessage(`Failed to respawn bot: ${result.message}`, "danger");
  }
}

async function feedBot() {
  const result = await callApi("/feed-bot", "POST");
  if (result.success) {
    showMessage(result.message, "success");
  } else {
    showMessage(`Failed to feed bot: ${result.message}`, "warning");
  }
}

async function feedBotFood() {
  const result = await callApi("/feed-bot-food", "POST");
  if (result.success) {
    showMessage(result.message, "success");
  } else {
    showMessage(`Failed to feed bot: ${result.message}`, "warning");
  }
}

async function starveBot() {
  const result = await callApi("/starve-bot", "POST");
  if (result.success) {
    showMessage(result.message, "success");
  } else {
    showMessage(`Failed to starve bot: ${result.message}`, "warning");
  }
}

async function setWeather(weatherType) {
  const result = await callApi("/set-weather", "POST", { weatherType });
  if (result.success) {
    showMessage(`Weather set to ${weatherType}`, "info");
  } else {
    showMessage(`Failed to set weather: ${result.message}`, "danger");
  }
}

async function setTime(timeValue) {
  const result = await callApi("/set-time", "POST", { timeValue });
  if (result.success) {
    showMessage(`Time set to ${timeValue}`, "info");
  } else {
    showMessage(`Failed to set time: ${result.message}`, "danger");
  }
}

async function teleportBot() {
  const x = parseFloat($("#teleport-x").value);
  const y = parseFloat($("#teleport-y").value);
  const z = parseFloat($("#teleport-z").value);
  if (isNaN(x) || isNaN(y) || isNaN(z)) {
    showMessage("Please enter valid coordinates", "warning");
    return;
  }
  const result = await callApi("/teleport", "POST", { x, y, z });
  if (result.success) {
    showMessage(`Teleporting to ${x}, ${y}, ${z}`, "info");
  } else {
    showMessage(`Failed to teleport: ${result.message}`, "danger");
  }
}

async function sendChat() {
  const message = $("#chat-message").value.trim();
  if (!message) {
    showMessage("Please enter a message", "warning");
    return;
  }
  const result = await callApi("/send-chat", "POST", { message });
  if (result.success) {
    $("#chat-message").value = "";
    $(
      "#chat-log"
    ).innerHTML += `<div class="chat-message outgoing"><span class="sender">Bot:</span> ${message}</div>`;
    $("#chat-log").scrollTop = $("#chat-log").scrollHeight;
  } else {
    showMessage(`Failed to send message: ${result.message}`, "danger");
  }
}

// New function to update command button states
function updateCommandButtonStates() {
  const commandInputs = Array.from(
    $("#command-list").querySelectorAll(".command-input")
  );
  const hasCommands = commandInputs.some(
    (input) => input.value.trim().length > 0
  );
  $("#remove-all-commands-btn").disabled = !hasCommands;
  $("#execute-commands-btn").disabled = !hasCommands;
}

function createCommandLine() {
  const line = document.createElement("div");
  line.className = "command-line d-flex align-items-center mb-2";

  const inputGroup = document.createElement("div");
  inputGroup.className = "input-group flex-grow-1";
  const prefix = document.createElement("span");
  prefix.className = "input-group-text";
  prefix.textContent = "/";
  prefix.style.color = "var(--primary)";
  const input = document.createElement("input");
  input.type = "text";
  input.className = "form-control command-input";
  input.placeholder = "enter command without /";
  input.style.fontFamily = "monospace";
  inputGroup.appendChild(prefix);
  inputGroup.appendChild(input);

  const removeBtn = document.createElement("button");
  removeBtn.className = "btn btn-danger btn-sm ms-2";
  removeBtn.textContent = "X";
  removeBtn.addEventListener("click", () => {
    if ($("#command-list").children.length > 1) {
      line.remove();
      updateCommandButtonStates();
    }
  });

  line.appendChild(inputGroup);
  line.appendChild(removeBtn);

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const commandList = $("#command-list");
      if (commandList.lastElementChild === line) {
        const newLine = createCommandLine();
        commandList.appendChild(newLine);
        newLine.querySelector(".command-input").focus();
      }
    } else if (
      e.key === "Backspace" &&
      input.value === "" &&
      $("#command-list").children.length > 1
    ) {
      const prevLine = line.previousElementSibling;
      line.remove();
      if (prevLine) prevLine.querySelector(".command-input").focus();
      updateCommandButtonStates();
    }
    updateCommandButtonStates();
  });

  input.addEventListener("paste", (e) => {
    e.preventDefault();
    const paste = (e.clipboardData || window.clipboardData).getData("text");
    const lines = paste
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (lines.length > 1) {
      input.value = lines[0];
      for (let i = 1; i < lines.length; i++) {
        const newLine = createCommandLine();
        newLine.querySelector(".command-input").value = lines[i];
        line.insertAdjacentElement("afterend", newLine);
      }
    } else {
      input.value = paste;
    }
    updateCommandButtonStates();
  });

  return line;
}

async function executeCommands() {
  const commandList = $("#command-list");
  const commandInputs = Array.from(
    commandList.querySelectorAll(".command-input")
  )
    .map((input) => input.value.trim())
    .filter((cmd) => cmd.length > 0);

  if (commandInputs.length === 0) {
    showMessage("Please enter at least one command", "warning");
    return;
  }

  const executeBtn = $("#execute-commands-btn");
  executeBtn.disabled = true;
  executeBtn.textContent = "Executing...";

  try {
    const commandLines = Array.from(
      commandList.querySelectorAll(".command-line")
    );
    for (let i = 0; i < commandInputs.length; i++) {
      const command = commandInputs[i];
      const result = await callApi("/execute-command", "POST", { command });
      if (result.success) {
        showMessage(`Command executed: /${command}`, "info");
        commandLines[i].remove();
      } else {
        showMessage(
          `Failed to execute command "/${command}": ${result.message}`,
          "danger"
        );
        break;
      }
    }
    if (commandList.children.length === 0) {
      const newLine = createCommandLine();
      commandList.appendChild(newLine);
    }
  } catch (error) {
    showMessage(`Error executing commands: ${error.message}`, "danger");
  } finally {
    executeBtn.disabled = false;
    executeBtn.textContent = "Execute";
    updateCommandButtonStates();
  }
}

function removeAllCommands() {
  const commandList = $("#command-list");
  if (confirm("Are you sure you want to remove all commands?")) {
    commandList.innerHTML = "";
    const newLine = createCommandLine();
    commandList.appendChild(newLine);
    showMessage("All commands removed", "info");
    updateCommandButtonStates();
  }
}

async function toggleAutoMovement() {
  const result = await callApi("/toggle-auto-movement", "POST");
  if (result.success) {
    showMessage(result.message, "info");
    updateStatus();
  } else {
    showMessage(`Failed to toggle auto movement: ${result.message}`, "danger");
  }
}

async function collectItems() {
  const result = await callApi("/collect-items", "POST");
  if (result.success) {
    showMessage("Collecting nearby items", "info");
  } else {
    showMessage(`Failed to collect items: ${result.message}`, "warning");
  }
}

async function refreshBotStats() {
  showMessage("Refreshing bot stats...", "info");
  await updateStatus();
}

// Status Updates
async function updateStatus() {
  if (backendStatus !== "connected") return;
  try {
    const status = await callApi("/bot-status");
    const connectionStatus = await callApi("/connection-status"); // Get detailed connection status
    if (status.online && connectionStatus.isConnected) {
      enableAllCards();
      $("#connection-status").textContent = "Connected";
      $("#connection-status").className = "badge badge-success";
      $("#start-btn").disabled = true;
      $("#start-btn").textContent = "Connected";
      $("#stop-btn").disabled = false;
      $("#restart-btn").disabled = false;

      // Disable and update server-host input with connected IP:port
      const lastServerAddress = localStorage.getItem("lastServerAddress");
      if (lastServerAddress) {
        $("#server-host").value = lastServerAddress;
        $("#server-host").disabled = true; // Disable input when connected
      }

      // Update health bar
      if (status.health !== undefined) {
        const healthPercent = Math.max(
          0,
          Math.min(100, (status.health / 20) * 100)
        );
        $("#health-bar").style.width = `${healthPercent}%`;
        $("#health-value").textContent = `${status.health.toFixed(1)}/20`;
        if (healthPercent > 60) {
          $("#health-bar").className = "progress-bar bg-success";
        } else if (healthPercent > 30) {
          $("#health-bar").className = "progress-bar bg-warning";
        } else {
          $("#health-bar").className = "progress-bar bg-danger";
        }
      }

      // Update food bar
      if (status.food !== undefined) {
        const foodPercent = Math.max(
          0,
          Math.min(100, (status.food / 20) * 100)
        );
        $("#food-bar").style.width = `${foodPercent}%`;
        $("#food-value").textContent = `${status.food.toFixed(1)}/20`;
        if (foodPercent > 60) {
          $("#food-bar").className = "progress-bar bg-success";
        } else if (foodPercent > 30) {
          $("#food-bar").className = "progress-bar bg-warning";
        } else {
          $("#food-bar").className = "progress-bar bg-danger";
        }
      }

      // Update position
      if (status.location) {
        $("#bot-x").textContent = `X= ${status.location.x.toFixed(1)}`;
        $("#bot-y").textContent = `Y= ${status.location.y.toFixed(1)}`;
        $("#bot-z").textContent = `Z= ${status.location.z.toFixed(1)}`;
        $("#teleport-x").value = Math.round(status.location.x);
        $("#teleport-y").value = Math.round(status.location.y);
        $("#teleport-z").value = Math.round(status.location.z);
      }

      // Update weather and time
      if (status.weather) {
        $("#server-weather").textContent = `Weather = ${
          status.weather.charAt(0).toUpperCase() + status.weather.slice(1)
        }`;
      }
      if (status.serverTime) {
        $("#server-time").textContent = `Time = ${status.serverTime}`;
      }

      // Update inventory
      if (status.inventory && status.inventory.length) {
        const inventoryItems = status.inventory
          .map(
            (item) =>
              `<div class="inventory-item" title="${
                item.displayName
              }"><div class="item-count">${
                item.count
              }</div><div class="item-name">${item.name.replace(
                /_/g,
                " "
              )}</div></div>`
          )
          .join("");
        $("#inventory-list").innerHTML = inventoryItems;
      } else {
        $("#inventory-list").innerHTML =
          '<div class="text-muted">No items</div>';
      }

      // Update nearby entities
      if (status.nearbyEntities && status.nearbyEntities.length) {
        const sortedEntities = status.nearbyEntities.sort(
          (a, b) => parseFloat(a.distance) - parseFloat(b.distance)
        );
        const entityRows = sortedEntities
          .map((entity) => {
            const typeClass = `entity-${entity.type.toLowerCase()}`;
            const typeDisplay =
              entity.type.charAt(0).toUpperCase() + entity.type.slice(1);
            return `<tr class="${typeClass}"><td>${entity.name}</td><td>${typeDisplay}</td><td>${entity.distance} blocks</td></tr>`;
          })
          .join("");
        const tableHTML = `<table class="table table-dark table-striped"><thead><tr><th>Name</th><th>Type</th><th>Distance</th></tr></thead><tbody>${entityRows}</tbody></table>`;
        $("#entity-list").innerHTML = tableHTML;
      } else {
        $("#entity-list").innerHTML =
          '<p class="text-muted">No entities within 30 blocks</p>';
      }

      // Update auto-movement status
      $("#auto-movement-status").textContent = status.isAutoMoving
        ? "ON"
        : "OFF";
      $("#auto-movement-status").className = status.isAutoMoving
        ? "badge badge-success"
        : "badge badge-secondary";

      // Update dead status
      if (status.isDead) {
        $("#respawn-btn").disabled = false;
        $("#dead-status").style.display = "inline-flex";
      } else {
        $("#respawn-btn").disabled = true;
        $("#dead-status").style.display = "none";
      }
    } else {
      enableConnectionCard();
      $("#connection-status").textContent =
        status.connectionStatus || "Disconnected";
      $("#connection-status").className = "badge badge-danger";
      $("#start-btn").disabled = false;
      $("#start-btn").textContent = "Connect Bot";
      $("#stop-btn").disabled = true;
      $("#restart-btn").disabled = true;
      $("#server-host").disabled = false; // Re-enable input when disconnected
      const lastServerAddress = localStorage.getItem("lastServerAddress");
      if (lastServerAddress) {
        $("#server-host").value = lastServerAddress; // Restore last value
      }
      if (status.connectionError) {
        showMessage(`Connection error: ${status.connectionError}`, "danger");
      }
      stopStatusUpdates();
      stopLogUpdates();
    }
  } catch (error) {
    console.error("Status update error:", error);
    stopStatusUpdates();
    stopLogUpdates();
    backendStatus = "disconnected";
    updateBackendStatusDisplay();
    disableAllCards();
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

function resetStatsToDefault() {
  $("#health-bar").style.width = "0%";
  $("#health-value").textContent = "N/A";
  $("#food-bar").style.width = "0%";
  $("#food-value").textContent = "N/A";
  $("#bot-x").textContent = "X= N/A";
  $("#bot-y").textContent = "Y= N/A";
  $("#bot-z").textContent = "Z= N/A";
  $("#server-weather").textContent = "Weather = N/A";
  $("#server-time").textContent = "Time = N/A";
  $("#inventory-list").innerHTML =
    '<div class="text-muted">No data available</div>';
  $("#entity-list").innerHTML =
    '<li class="list-group-item">No data available</li>';
  $("#auto-movement-status").textContent = "N/A";
  $("#auto-movement-status").className = "badge badge-secondary";
}

async function refreshLogs() {
  showMessage("Refreshing logs...", "info");
  await updateLogs();
}

// Initialize the App
function initApp() {
  disableAllCards();
  resetStatsToDefault();
  updateBackendStatusDisplay(); // Set initial backend status display
  checkBackendAvailability();

  // Periodic check for backend availability
  setInterval(async () => {
    if (backendStatus === "disconnected") {
      await checkBackendAvailability();
    } else if (!statusUpdateInterval) {
      await updateStatus();
    }
  }, 2000);

  // Set up event listeners
  $("#connect-form").addEventListener("submit", (e) => {
    e.preventDefault();
    startBot();
  });

  $("#stop-btn").addEventListener("click", stopBot);
  $("#restart-btn").addEventListener("click", restartBot);
  $("#kill-btn").addEventListener("click", killBot);
  $("#heal-btn").addEventListener("click", healBot);
  $("#respawn-btn").addEventListener("click", respawnBot);
  $("#feed-btn").addEventListener("click", feedBot);
  $("#feed-btn-inv").addEventListener("click", feedBotFood);
  $("#starve-btn").addEventListener("click", starveBot);
  $("#refresh-stats").addEventListener("click", refreshBotStats);

  $("#weather-clear").addEventListener("click", () => setWeather("clear"));
  $("#weather-rain").addEventListener("click", () => setWeather("rain"));
  $("#weather-thunder").addEventListener("click", () => setWeather("thunder"));

  $("#time-day").addEventListener("click", () => setTime("day"));
  $("#time-night").addEventListener("click", () => setTime("night"));
  $("#time-noon").addEventListener("click", () => setTime("noon"));
  $("#time-midnight").addEventListener("click", () => setTime("midnight"));

  $("#teleport-form").addEventListener("submit", (e) => {
    e.preventDefault();
    teleportBot();
  });

  $("#chat-form").addEventListener("submit", (e) => {
    e.preventDefault();
    sendChat();
  });

  const commandList = $("#command-list");
  const initialLine = createCommandLine();
  commandList.appendChild(initialLine);
  updateCommandButtonStates(); // Initial state check

  $("#add-command-btn").addEventListener("click", () => {
    const newLine = createCommandLine();
    commandList.appendChild(newLine);
    newLine.querySelector(".command-input").focus();
    updateCommandButtonStates();
  });

  $("#remove-all-commands-btn").addEventListener("click", removeAllCommands);
  $("#execute-commands-btn").addEventListener("click", executeCommands);
  $("#toggle-auto-movement").addEventListener("click", toggleAutoMovement);
  $("#collect-items-btn").addEventListener("click", collectItems);
  $("#collect-items-btn-inv").addEventListener("click", collectItems);

  $("#server-host").placeholder = "e.g. server.aternos.me:12345";

  // Add event listener for manual log refresh
  $("#refresh-logs-btn").addEventListener("click", refreshLogs);
}

document.addEventListener("DOMContentLoaded", initApp);

// Log Updates
async function updateLogs() {
  try {
    const logs = await callApi("/log-history");
    if (!logs || !logs.length) return;
    const sortedLogs = [...logs].sort(
      (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
    );
    const logHTML = sortedLogs
      .map((log) => {
        let logClass = "";
        let icon = "";
        switch (log.type) {
          case "system":
            logClass = "text-muted";
            icon = '<i class="fas fa-cog"></i>';
            break;
          case "chat":
            logClass = "text-primary";
            icon = '<i class="fas fa-comment"></i>';
            break;
          case "command":
            logClass = "text-warning";
            icon = '<i class="fas fa-terminal"></i>';
            break;
          case "action":
            logClass = "text-success";
            icon = '<i class="fas fa-play"></i>';
            break;
          case "movement":
            logClass = "text-info";
            icon = '<i class="fas fa-walking"></i>';
            break;
          default:
            icon = '<i class="fas fa-info-circle"></i>';
        }
        const time = new Date(log.timestamp).toLocaleTimeString();
        return `<div class="log-entry ${logClass}"><span class="log-time">${time}</span><span class="log-icon">${icon}</span><span class="log-message">${log.message}</span></div>`;
      })
      .join("");
    $("#server-logs").innerHTML = logHTML;
    $("#server-logs").scrollTop = $("#server-logs").scrollHeight;
  } catch (error) {
    console.error("Log update error:", error);
  }
}
