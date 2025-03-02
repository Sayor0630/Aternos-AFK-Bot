// script.js
const API_URL = "/api";
let statusUpdateInterval = null;
let logUpdateInterval = null;
let backendStatus = "disconnected";
let latestStatus = null;
let openDropdowns = new Set();
let selectedSlots = new Set(); // Tracks selected inventory slots
let lastSelectedSlot = null; // Tracks the last selected slot for quantity persistence
let lastQuantity = 1; // Tracks the last entered quantity

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

function updateBackendStatusDisplay() {
  const statusElement = $("#backend-status");
  if (!statusElement) return;
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

function parseServerAddress(address) {
  if (!address) return { host: "", port: 25565 };
  if (address.includes(":")) {
    const [host, portStr] = address.split(":");
    const port = parseInt(portStr);
    return { host, port: isNaN(port) ? 25565 : port };
  }
  return { host: address, port: 25565 };
}

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
      showMessage(`API Error: ${error.message}`, "danger");
    }
    return { success: false, message: error.message };
  }
}

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
  setTimeout(updateStatus, 500);
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
    $("#server-host").disabled = false;
    localStorage.removeItem("lastServerAddress");
    selectedSlots.clear();
  } else {
    showMessage(`Failed to stop bot: ${result.message}`, "danger");
  }
  setTimeout(updateStatus, 500);
}

async function restartBot() {
  const result = await callApi("/restart-bot", "POST");
  if (result.success) {
    showMessage("Bot restarting...", "info");
  } else {
    showMessage(`Failed to restart bot: ${result.message}`, "danger");
  }
  setTimeout(updateStatus, 500);
}

async function killBot() {
  const result = await callApi("/kill-bot", "POST");
  if (result.success) {
    showMessage("Bot killed", "warning");
  } else {
    showMessage(`Failed to kill bot: ${result.message}`, "danger");
  }
  setTimeout(updateStatus, 500);
}

async function healBot() {
  const result = await callApi("/heal-bot", "POST");
  if (result.success) {
    showMessage("Bot healed", "warning");
  } else {
    showMessage(`Failed to heal bot: ${result.message}`, "danger");
  }
  setTimeout(updateStatus, 500);
}

async function respawnBot() {
  const result = await callApi("/respawn-bot", "POST");
  if (result.success) {
    showMessage("Bot respawning", "info");
  } else {
    showMessage(`Failed to respawn bot: ${result.message}`, "danger");
  }
  setTimeout(updateStatus, 500);
}

async function feedBot() {
  const result = await callApi("/feed-bot", "POST");
  if (result.success) {
    showMessage(result.message, "success");
  } else {
    showMessage(`Failed to feed bot: ${result.message}`, "warning");
  }
  setTimeout(updateStatus, 500);
}

async function feedBotFood() {
  const result = await callApi("/feed-bot-food", "POST");
  if (result.success) {
    showMessage(result.message, "success");
  } else {
    showMessage(`Failed to feed bot: ${result.message}`, "warning");
  }
  setTimeout(updateStatus, 500);
}

async function starveBot() {
  const result = await callApi("/starve-bot", "POST");
  if (result.success) {
    showMessage(result.message, "success");
  } else {
    showMessage(`Failed to starve bot: ${result.message}`, "warning");
  }
  setTimeout(updateStatus, 500);
}

async function setWeather(weatherType) {
  const result = await callApi("/set-weather", "POST", { weatherType });
  if (result.success) {
    showMessage(`Weather set to ${weatherType}`, "info");
  } else {
    showMessage(`Failed to set weather: ${result.message}`, "danger");
  }
  setTimeout(updateStatus, 500);
}

async function setTime(timeValue) {
  const result = await callApi("/set-time", "POST", { timeValue });
  if (result.success) {
    showMessage(`Time set to ${timeValue}`, "info");
  } else {
    showMessage(`Failed to set time: ${result.message}`, "danger");
  }
  setTimeout(updateStatus, 500);
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
  setTimeout(updateStatus, 500);
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
  setTimeout(updateStatus, 500);
}

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
    setTimeout(updateStatus, 500);
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
  setTimeout(updateStatus, 500);
}

async function toggleKeepWeather() {
  const currentStatus = $("#keep-weather-status").textContent === "ON";
  const newStatus = !currentStatus;
  const weatherType = $("#weather-selected").textContent.toLowerCase();
  const result = await callApi("/set-keep-weather", "POST", {
    enabled: newStatus,
    weatherType,
  });
  if (result.success) {
    $("#keep-weather-status").textContent = newStatus ? "ON" : "OFF";
    $("#keep-weather-status").className = newStatus
      ? "badge badge-success"
      : "badge badge-secondary";
    $("#weather-dropdown").disabled = newStatus;
    showMessage(`Keep Weather ${newStatus ? "enabled" : "disabled"}`, "info");
  } else {
    showMessage(`Failed to toggle keep weather: ${result.message}`, "danger");
  }
}

async function toggleKeepTime() {
  const currentStatus = $("#keep-time-status").textContent === "ON";
  const newStatus = !currentStatus;
  const timeValue = $("#time-selected").textContent.toLowerCase();
  const result = await callApi("/set-keep-time", "POST", {
    enabled: newStatus,
    timeValue,
  });
  if (result.success) {
    $("#keep-time-status").textContent = newStatus ? "ON" : "OFF";
    $("#keep-time-status").className = newStatus
      ? "badge badge-success"
      : "badge badge-secondary";
    $("#time-dropdown").disabled = newStatus;
    showMessage(`Keep Time ${newStatus ? "enabled" : "disabled"}`, "info");
  } else {
    showMessage(`Failed to toggle keep time: ${result.message}`, "danger");
  }
}

async function collectItems() {
  const result = await callApi("/collect-items", "POST");
  if (result.success) {
    showMessage("Collecting nearby items", "info");
  } else {
    showMessage(`Failed to collect items: ${result.message}`, "warning");
  }
  setTimeout(updateStatus, 500);
}

async function refreshBotStats() {
  showMessage("Refreshing bot stats...", "info");
  await updateStatus();
}

// Inventory Management Functions
function toggleItemSelection(slot) {
  if (selectedSlots.has(slot)) {
    selectedSlots.delete(slot);
  } else {
    selectedSlots.add(slot);
  }
  updateInventorySelectionUI();
}

function updateInventorySelectionUI() {
  const dropQuantity = $("#drop-quantity");
  const maxButton = $("#max-quantity-btn");
  const dropButton = $("#drop-selected-btn");

  dropButton.disabled = selectedSlots.size === 0;

  if (selectedSlots.size === 1) {
    const selectedSlot = Array.from(selectedSlots)[0];
    const selectedItem = latestStatus.inventory.find(
      (item) => item.slot === selectedSlot
    );
    if (selectedItem) {
      dropQuantity.classList.remove("d-none");
      maxButton.classList.remove("d-none");
      dropQuantity.max = selectedItem.count;
      if (selectedSlot === lastSelectedSlot) {
        dropQuantity.value = lastQuantity;
      } else {
        dropQuantity.value = 1;
        lastSelectedSlot = selectedSlot;
      }
    }
  } else {
    dropQuantity.classList.add("d-none");
    maxButton.classList.add("d-none");
    lastSelectedSlot = null;
  }

  document.querySelectorAll(".inventory-item").forEach((item) => {
    const slot = parseInt(item.dataset.slot);
    if (selectedSlots.has(slot)) {
      item.classList.add("selected");
    } else {
      item.classList.remove("selected");
    }
  });
}

async function dropSelectedItems() {
  if (selectedSlots.size === 0) {
    showMessage("No items selected to drop", "warning");
    return;
  }

  if (selectedSlots.size === 1) {
    const slot = Array.from(selectedSlots)[0];
    const amount = parseInt($("#drop-quantity").value);
    const max = parseInt(
      document.querySelector(`.inventory-item[data-slot="${slot}"]`).dataset
        .count
    );
    if (isNaN(amount) || amount < 1 || amount > max) {
      showMessage(`Please enter a valid quantity (1-${max})`, "warning");
      return;
    }
    const result = await callApi("/drop-item", "POST", { slot, amount });
    showMessage(result.message, result.success ? "success" : "danger");
    selectedSlots.clear();
    lastSelectedSlot = null;
  } else {
    const slots = Array.from(selectedSlots);
    const result = await callApi("/drop-stacks", "POST", { slots });
    showMessage(result.message, result.success ? "success" : "danger");
    selectedSlots.clear();
    lastSelectedSlot = null;
  }
  setTimeout(updateStatus, 500);
}

async function dropAllItems() {
  if (confirm("Are you sure you want to drop all items from the inventory?")) {
    const result = await callApi("/drop-all", "POST");
    if (result.success) {
      // Hide quantity input and Max button after successful drop
      $("#drop-quantity").classList.add("d-none");
      $("#max-quantity-btn").classList.add("d-none");
      showMessage(result.message, "success");
      selectedSlots.clear();
      lastSelectedSlot = null;
    } else {
      showMessage(result.message, "danger");
    }
    setTimeout(updateStatus, 500);
  }
}

function updateDropdownContent(username, allPlayers) {
  const dropdownMenu = $(`[data-player="${username}"] .dropdown-menu`);
  if (dropdownMenu && allPlayers) {
    const newContent = allPlayers
      .filter((p) => p.playerUsername !== username)
      .map(
        (p) =>
          `<li><a class="dropdown-item" href="#" onclick="tpPlayerToPlayer('${username}', '${p.playerUsername}')">${p.playerUsername}</a></li>`
      )
      .join("");
    dropdownMenu.innerHTML = newContent;
  }
}

async function updateStatus() {
  if (backendStatus !== "connected") return;
  try {
    const status = await callApi("/bot-status");
    latestStatus = status;

    if (status.online) {
      enableAllCards();
      $("#connection-status").textContent = "Connected";
      $("#connection-status").className = "badge badge-success";
      $("#start-btn").disabled = true;
      $("#start-btn").textContent = "Connected";
      $("#stop-btn").disabled = false;
      $("#restart-btn").disabled = false;

      const lastServerAddress = localStorage.getItem("lastServerAddress");
      if (lastServerAddress) {
        $("#server-host").value = lastServerAddress;
        $("#server-host").disabled = true;
      }

      if (status.health !== undefined) {
        const healthPercent = Math.max(
          0,
          Math.min(100, (status.health / 20) * 100)
        );
        $("#health-bar").style.width = `${healthPercent}%`;
        $("#health-value").textContent = `${status.health.toFixed(1)}/20`;
        $("#health-bar").className =
          healthPercent > 60
            ? "progress-bar bg-success"
            : healthPercent > 30
            ? "progress-bar bg-warning"
            : "progress-bar bg-danger";
      }

      if (status.food !== undefined) {
        const foodPercent = Math.max(
          0,
          Math.min(100, (status.food / 20) * 100)
        );
        $("#food-bar").style.width = `${foodPercent}%`;
        $("#food-value").textContent = `${status.food.toFixed(1)}/20`;
        $("#food-bar").className =
          foodPercent > 60
            ? "progress-bar bg-success"
            : foodPercent > 30
            ? "progress-bar bg-warning"
            : "progress-bar bg-danger";
      }

      if (status.location) {
        $("#bot-x").textContent = `X= ${status.location.x.toFixed(1)}`;
        $("#bot-y").textContent = `Y= ${status.location.y.toFixed(1)}`;
        $("#bot-z").textContent = `Z= ${status.location.z.toFixed(1)}`;
      }

      if (status.weather) {
        $("#server-weather").textContent = `Weather = ${
          status.weather.charAt(0).toUpperCase() + status.weather.slice(1)
        }`;
      }
      if (status.serverTime) {
        $("#server-time").textContent = `Time = ${status.serverTime}`;
      }

      if (status.inventory && status.inventory.length) {
        const currentSlots = new Set(status.inventory.map((item) => item.slot));
        selectedSlots.forEach((slot) => {
          if (!currentSlots.has(slot)) {
            selectedSlots.delete(slot);
          }
        });

        const inventoryItems = status.inventory
          .map(
            (item) => `
              <div class="inventory-item ${
                selectedSlots.has(item.slot) ? "selected" : ""
              }" data-slot="${item.slot}" data-count="${item.count}" title="${
              item.displayName
            }">
                <div class="item-count">${item.count}</div>
                <div class="item-name">${item.name.replace(/_/g, " ")}</div>
              </div>
            `
          )
          .join("");
        $(
          "#inventory-list"
        ).innerHTML = `<div class="inventory-container">${inventoryItems}</div>`;

        document.querySelectorAll(".inventory-item").forEach((item) => {
          item.onclick = () => {
            const slot = parseInt(item.dataset.slot);
            toggleItemSelection(slot);
          };
        });

        updateInventorySelectionUI();
      } else {
        $("#inventory-list").innerHTML =
          '<ul class="list-group"><li class="list-group-item">No items</li></ul>';
        selectedSlots.clear();
        lastSelectedSlot = null;
      }

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
          '<li class="list-group-item">No entities within 30 blocks</li>';
      }

      $("#auto-movement-status").textContent = status.isAutoMoving
        ? "ON"
        : "OFF";
      $("#auto-movement-status").className = status.isAutoMoving
        ? "badge badge-success"
        : "badge badge-secondary";

      $("#keep-weather-status").textContent = status.keepWeatherEnabled
        ? "ON"
        : "OFF";
      $("#keep-weather-status").className = status.keepWeatherEnabled
        ? "badge badge-success"
        : "badge badge-secondary";
      $("#weather-dropdown").disabled = status.keepWeatherEnabled;

      $("#keep-time-status").textContent = status.keepTimeEnabled
        ? "ON"
        : "OFF";
      $("#keep-time-status").className = status.keepTimeEnabled
        ? "badge badge-success"
        : "badge badge-secondary";
      $("#time-dropdown").disabled = status.keepTimeEnabled;

      if (status.isDead) {
        $("#respawn-btn").disabled = false;
        $("#dead-status").style.display = "inline-flex";
      } else {
        $("#respawn-btn").disabled = true;
        $("#dead-status").style.display = "none";
      }

      if (status.reconnectAttempts > 0) {
        showMessage(
          `Trying to reconnect ${status.reconnectAttempts}/10`,
          "warning"
        );
      }

      renderPlayers(status.players, status.allPlayers);
    } else {
      enableConnectionCard();
      $("#connection-status").textContent =
        status.connectionStatus || "Disconnected";
      $("#connection-status").className = "badge badge-danger";
      $("#start-btn").disabled = false;
      $("#start-btn").textContent = "Connect Bot";
      $("#stop-btn").disabled = true;
      $("#restart-btn").disabled = true;
      $("#server-host").disabled = false;
      const lastServerAddress = localStorage.getItem("lastServerAddress");
      if (lastServerAddress) {
        $("#server-host").value = lastServerAddress;
      }
      if (status.connectionError) {
        showMessage(`Connection error: ${status.connectionError}`, "danger");
      }
      if (status.reconnectAttempts > 0) {
        showMessage(
          `Trying to reconnect ${status.reconnectAttempts}/10`,
          "warning"
        );
      }
      stopStatusUpdates();
      stopLogUpdates();
      resetStatsToDefault();
      selectedSlots.clear();
      lastSelectedSlot = null;
    }
  } catch (error) {
    console.error("Status update error:", error);
    stopStatusUpdates();
    stopLogUpdates();
    backendStatus = "disconnected";
    updateBackendStatusDisplay();
    disableAllCards();
    selectedSlots.clear();
    lastSelectedSlot = null;
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
    '<ul class="list-group"><li class="list-group-item">No data available</li></ul>';
  $("#entity-list").innerHTML =
    '<li class="list-group-item">No data available</li>';
  $("#player-list").innerHTML =
    '<li class="list-group-item">No data available</li>';
  $("#auto-movement-status").textContent = "N/A";
  $("#auto-movement-status").className = "badge badge-secondary";
  $("#keep-weather-status").textContent = "N/A";
  $("#keep-weather-status").className = "badge badge-secondary";
  $("#weather-dropdown").disabled = true;
  $("#keep-time-status").textContent = "N/A";
  $("#keep-time-status").className = "badge badge-secondary";
  $("#time-dropdown").disabled = true;
  selectedSlots.clear();
  lastSelectedSlot = null;
}

async function refreshLogs() {
  showMessage("Refreshing logs...", "info");
  await updateLogs();
}

function renderPlayers(players, allPlayers) {
  const playerList = $("#player-list");
  if (!players || players.length === 0) {
    playerList.innerHTML = '<li class="list-group-item">No players online</li>';
    return;
  }

  const tableHTML = `
    <table class="table table-dark table-striped">
      <thead>
        <tr>
          <th>Name</th>
          <th>Ping</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${players
          .map(
            (player) => `
              <tr>
                <td>${player.playerUsername}</td>
                <td>${player.ping} ms</td>
                <td>
                  <div class="btn-group" role="group">
                    <button class="btn btn-danger" onclick="kickPlayer('${player.playerUsername}')" title="Kick Player">
                      <i class="fas fa-times"></i> Kick
                    </button>
                    <button class="btn btn-danger" onclick="banPlayer('${player.playerUsername}')" title="Ban Player">
                      <i class="fas fa-ban"></i> Ban
                    </button>
                    <button class="btn btn-warning" onclick="killPlayer('${player.playerUsername}')" title="Kill Player">
                      <i class="fas fa-skull"></i> Kill
                    </button>
                    <button class="btn btn-success" onclick="healPlayer('${player.playerUsername}')" title="Heal Player">
                      <i class="fas fa-heart"></i> Heal
                    </button>
                    <button class="btn btn-warning" onclick="starvePlayer('${player.playerUsername}')" title="Starve Player">
                      <i class="fas fa-dizzy"></i> Starve
                    </button>
                    <button class="btn btn-success" onclick="feedPlayer('${player.playerUsername}')" title="Feed Player">
                      <i class="fas fa-drumstick-bite"></i> Feed
                    </button>
                    <button class="btn btn-info" onclick="tpBotToPlayer('${player.playerUsername}')" title="Teleport Bot to Player">
                      <i class="fas fa-map-marker-alt"></i> TP Bot
                    </button>
                    <div class="btn-group" data-player="${player.playerUsername}">
                      <button type="button" class="btn btn-primary dropdown-toggle" data-bs-toggle="dropdown" title="Teleport Player to Another Player" aria-expanded="false">
                        <i class="fas fa-exchange-alt"></i> TP To...
                      </button>
                      <ul class="dropdown-menu"></ul>
                    </div>
                  </div>
                </td>
              </tr>
            `
          )
          .join("")}
      </tbody>
    </table>
  `;

  playerList.innerHTML = tableHTML;

  players.forEach((player) => {
    updateDropdownContent(player.playerUsername, allPlayers);
  });

  requestAnimationFrame(() => {
    openDropdowns.forEach((username) => {
      const toggle = $(`[data-player="${username}"] .dropdown-toggle`);
      if (toggle) {
        const dropdownInstance = bootstrap.Dropdown.getOrCreateInstance(toggle);
        if (!dropdownInstance._isShown()) {
          dropdownInstance.show();
        }
      }
    });
  });
}

window.kickPlayer = async function (playerUsername) {
  if (confirm(`Are you sure you want to kick ${playerUsername}?`)) {
    const result = await callApi("/kick-player", "POST", { playerUsername });
    if (result.success) {
      showMessage(result.message, "success");
    } else {
      showMessage(
        `Failed to kick ${playerUsername}: ${result.message}`,
        "danger"
      );
    }
  }
  setTimeout(updateStatus, 500);
};

window.banPlayer = async function (playerUsername) {
  if (confirm(`Are you sure you want to ban ${playerUsername}?`)) {
    const result = await callApi("/ban-player", "POST", { playerUsername });
    if (result.success) {
      showMessage(result.message, "success");
    } else {
      showMessage(
        `Failed to ban ${playerUsername}: ${result.message}`,
        "danger"
      );
    }
  }
  setTimeout(updateStatus, 500);
};

window.killPlayer = async function (playerUsername) {
  const result = await callApi("/kill-player", "POST", { playerUsername });
  if (result.success) {
    showMessage(result.message, "success");
  } else {
    showMessage(
      `Failed to kill ${playerUsername}: ${result.message}`,
      "danger"
    );
  }
  setTimeout(updateStatus, 500);
};

window.healPlayer = async function (playerUsername) {
  const result = await callApi("/heal-player", "POST", { playerUsername });
  if (result.success) {
    showMessage(result.message, "success");
  } else {
    showMessage(
      `Failed to heal ${playerUsername}: ${result.message}`,
      "danger"
    );
  }
  setTimeout(updateStatus, 500);
};

window.starvePlayer = async function (playerUsername) {
  const result = await callApi("/starve-player", "POST", { playerUsername });
  if (result.success) {
    showMessage(result.message, "success");
  } else {
    showMessage(
      `Failed to starve ${playerUsername}: ${result.message}`,
      "danger"
    );
  }
  setTimeout(updateStatus, 500);
};

window.feedPlayer = async function (playerUsername) {
  const result = await callApi("/feed-player", "POST", { playerUsername });
  if (result.success) {
    showMessage(result.message, "success");
  } else {
    showMessage(
      `Failed to feed ${playerUsername}: ${result.message}`,
      "danger"
    );
  }
  setTimeout(updateStatus, 500);
};

window.tpBotToPlayer = async function (playerUsername) {
  const result = await callApi("/tp-bot-to-player", "POST", { playerUsername });
  if (result.success) {
    showMessage(result.message, "success");
  } else {
    showMessage(
      `Failed to teleport bot to ${playerUsername}: ${result.message}`,
      "danger"
    );
  }
  setTimeout(updateStatus, 500);
};

window.tpPlayerToPlayer = async function (
  fromPlayerUsername,
  toPlayerUsername
) {
  const result = await callApi("/tp-player-to-player", "POST", {
    fromPlayerUsername,
    toPlayerUsername,
  });
  if (result.success) {
    showMessage(result.message, "success");
  } else {
    showMessage(
      `Failed to teleport ${fromPlayerUsername} to ${toPlayerUsername}: ${result.message}`,
      "danger"
    );
  }
  setTimeout(updateStatus, 500);
};

function initApp() {
  disableAllCards();
  resetStatsToDefault();
  updateBackendStatusDisplay();
  checkBackendAvailability();

  setInterval(async () => {
    if (backendStatus === "disconnected") {
      await checkBackendAvailability();
    } else if (!statusUpdateInterval) {
      await updateStatus();
    }
  }, 2000);

  $("#connect-form").addEventListener("submit", (e) => {
    e.preventDefault();
    startBot();
  });

  const playerList = $("#player-list");

  playerList.addEventListener("shown.bs.dropdown", (event) => {
    const btnGroup = event.target.closest(".btn-group");
    if (btnGroup && btnGroup.dataset.player) {
      openDropdowns.add(btnGroup.dataset.player);
    }
  });

  playerList.addEventListener("hidden.bs.dropdown", (event) => {
    const btnGroup = event.target.closest(".btn-group");
    if (btnGroup && btnGroup.dataset.player) {
      openDropdowns.delete(btnGroup.dataset.player);
    }
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
  updateCommandButtonStates();

  $("#add-command-btn").addEventListener("click", () => {
    const newLine = createCommandLine();
    commandList.appendChild(newLine);
    newLine.querySelector(".command-input").focus();
    updateCommandButtonStates();
  });

  $("#remove-all-commands-btn").addEventListener("click", removeAllCommands);
  $("#execute-commands-btn").addEventListener("click", executeCommands);
  $("#toggle-auto-movement").addEventListener("click", toggleAutoMovement);
  $("#toggle-keep-weather").addEventListener("click", toggleKeepWeather);
  $("#toggle-keep-time").addEventListener("click", toggleKeepTime);
  $("#collect-items-btn").addEventListener("click", collectItems);
  $("#collect-items-btn-inv").addEventListener("click", collectItems);

  $("#server-host").placeholder = "e.g. server.aternos.me:12345";

  $("#refresh-logs-btn").addEventListener("click", refreshLogs);

  $("#refresh-inventory").addEventListener("click", () => {
    showMessage("Refreshing inventory...", "info");
    updateStatus();
  });

  $("#refresh-entities").addEventListener("click", () => {
    showMessage("Refreshing entities...", "info");
    updateStatus();
  });

  $("#refresh-players").addEventListener("click", () => {
    showMessage("Refreshing players list...", "info");
    updateStatus();
  });

  $("#set-current-position").addEventListener("click", () => {
    if (latestStatus && latestStatus.location) {
      $("#teleport-x").value = Math.round(latestStatus.location.x);
      $("#teleport-y").value = Math.round(latestStatus.location.y);
      $("#teleport-z").value = Math.round(latestStatus.location.z);
      showMessage("Set coordinates to current position", "info");
    } else {
      showMessage("Current position not available", "warning");
    }
  });

  document
    .querySelectorAll("#weather-dropdown + .dropdown-menu .dropdown-item")
    .forEach((item) => {
      item.addEventListener("click", (e) => {
        e.preventDefault();
        const selectedWeather = e.target.getAttribute("data-value");
        $("#weather-selected").textContent =
          selectedWeather.charAt(0).toUpperCase() + selectedWeather.slice(1);
      });
    });

  document
    .querySelectorAll("#time-dropdown + .dropdown-menu .dropdown-item")
    .forEach((item) => {
      item.addEventListener("click", (e) => {
        e.preventDefault();
        const selectedTime = e.target.getAttribute("data-value");
        $("#time-selected").textContent =
          selectedTime.charAt(0).toUpperCase() + selectedTime.slice(1);
      });
    });

  $("#drop-selected-btn").addEventListener("click", dropSelectedItems);
  $("#drop-all-btn").addEventListener("click", dropAllItems);

  $("#drop-quantity").addEventListener("input", () => {
    lastQuantity = parseInt($("#drop-quantity").value) || 1;
  });

  $("#max-quantity-btn").addEventListener("click", () => {
    if (selectedSlots.size === 1) {
      const selectedSlot = Array.from(selectedSlots)[0];
      const selectedItem = latestStatus.inventory.find(
        (item) => item.slot === selectedSlot
      );
      if (selectedItem) {
        $("#drop-quantity").value = selectedItem.count;
        lastQuantity = selectedItem.count;
      }
    }
  });
}

document.addEventListener("DOMContentLoaded", initApp);

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
