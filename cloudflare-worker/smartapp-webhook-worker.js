// smartapp-webhook-worker.js
//
// CLOUDFLARE KV OPTIMIZATION STRATEGY
// ====================================
// Free tier limit: 1000 KV write operations per day
//
// Previous implementation tracked ALL devices (switches + HVAC) resulting in:
// - ~40 devices * 3 KV writes per event = 120 operations per event cycle
// - Exceeded daily limit in a few hours
//
// Current optimization:
// - Track ONLY HVAC devices (thermostats + temperature sensors)
// - Removed switch capability tracking
// - Disabled history tracking (commented out)
// - Removed backward compatibility temp: prefix writes
// - Result: 1 KV write operation per device event
//
// With ~8 HVAC devices: 1000 operations / 8 devices = ~125 events per device per day
// This allows monitoring temperature changes which occur less frequently than switch events
//
// Rebalancing system:
// - Scheduled 2x daily (9am, 6pm ET) via Cloudflare Cron Triggers
// - Manual trigger via GET /rebalance endpoint
// - Writes commands to KV queue (1 KV write per rebalancing event)
// - External script polls KV and executes commands via SmartThings API
// - Logic prevents units from running inefficiently (COOL when temp < setpoint, etc.)
// - Hysteresis prevents oscillation near setpoints
// - Conflict resolution favors cooling when temps significantly above desired
// - Use Google Sheets webhook for historical logging (already enabled)

export default {
  async fetch(request, env, ctx) {
    console.log(`🚀 Worker received ${request.method} request: ${request.url}`);
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === "OPTIONS") {
      return handleCORS();
    }
    if (request.method === "GET") {
      return handleGetRequest(path, env);
    }
    if (request.method === "POST") {
      return handleSmartThingsWebhook(request, env, ctx);
    }

    return new Response("Method not allowed", { status: 405 });
  },

  // Cloudflare Cron Trigger handler for scheduled rebalancing
  async scheduled(event, env, ctx) {
    console.log(`⏰ Cron trigger fired at ${new Date(event.scheduledTime).toISOString()}`);
    try {
      const result = await performRebalancing(env);
      console.log("Scheduled rebalancing completed:", result);
    } catch (error) {
      console.error("Scheduled rebalancing failed:", error);
    }
  }
};

// --- Configuration Constants ---

// Define the capabilities and attributes we want to track
// ONLY HVAC-related attributes to stay within Cloudflare KV free tier limits
const TRACKED_ATTRIBUTES = [
  { capability: "temperatureMeasurement", attribute: "temperature" },
  { capability: "thermostatMode", attribute: "thermostatMode" },
  { capability: "thermostatOperatingState", attribute: "thermostatOperatingState" },
  { capability: "thermostatCoolingSetpoint", attribute: "coolingSetpoint" },
  { capability: "thermostatHeatingSetpoint", attribute: "heatingSetpoint" }
];

// Rebalancing configuration
const REBALANCE_CONFIG = {
  DEFAULT_HEAT_SETPOINT: 68,  // °F
  DEFAULT_COOL_SETPOINT: 72,  // °F
  HYSTERESIS: 2,              // °F - buffer to prevent oscillation
  SIGNIFICANT_OVERHEAT: 5     // °F - threshold for favoring cooling in conflicts
};

// --- GET Request Handlers ---

async function handleGetRequest(path, env) {
  const origin = "*";
  
  // Endpoint: Get all current device states
  if (path === "/temperatures" || path === "/devices") {
    if (!env.SMARTAPP_STORAGE) {
      return errorResponse("Storage not configured", 500, origin);
    }
    try {
      const list = await env.SMARTAPP_STORAGE.list({ prefix: "device:" });
      const devices = {};
      
      for (const key of list.keys) {
        const data = await env.SMARTAPP_STORAGE.get(key.name, "json");
        if (data) {
          // Key format is "device:deviceId"
          const deviceId = key.name.substring(7); 
          devices[deviceId] = data;
        }
      }
      return successResponse(devices, origin);
    } catch (error) {
      console.error("Error fetching devices:", error);
      return errorResponse("Failed to fetch devices", 500, origin, error.message);
    }
  }

  // Endpoint: Get specific device
  const deviceMatch = path.match(/^\/(temperature|device)\/(.+)$/);
  if (deviceMatch) {
    const deviceId = deviceMatch[2];
    if (!env.SMARTAPP_STORAGE) return errorResponse("Storage not configured", 500, origin);

    try {
      // Get device data using device: prefix
      const data = await env.SMARTAPP_STORAGE.get(`device:${deviceId}`, "json");

      if (!data) return errorResponse("Device not found", 404, origin);
      return successResponse(data, origin);
    } catch (error) {
      return errorResponse("Failed to fetch device", 500, origin, error.message);
    }
  }

  // Endpoint: Get history
  const historyMatch = path.match(/^\/history\/(.+)$/);
  if (historyMatch) {
    const deviceId = historyMatch[1];
    if (!env.SMARTAPP_STORAGE) return errorResponse("Storage not configured", 500, origin);

    try {
      const history = await env.SMARTAPP_STORAGE.get(`history:${deviceId}`, "json") || [];
      return successResponse(history, origin);
    } catch (error) {
      return errorResponse("Failed to fetch history", 500, origin, error.message);
    }
  }

  // Endpoint: Trigger rebalancing
  if (path === "/rebalance") {
    if (!env.SMARTAPP_STORAGE) return errorResponse("Storage not configured", 500, origin);
    try {
      const result = await performRebalancing(env);
      return successResponse(result, origin);
    } catch (error) {
      console.error("Rebalancing error:", error);
      return errorResponse("Failed to rebalance", 500, origin, error.message);
    }
  }

  // Endpoint: Get rebalancing status
  if (path === "/rebalance-status") {
    if (!env.SMARTAPP_STORAGE) return errorResponse("Storage not configured", 500, origin);
    try {
      const status = await env.SMARTAPP_STORAGE.get("rebalance:status", "json") || { message: "No rebalancing performed yet" };
      return successResponse(status, origin);
    } catch (error) {
      return errorResponse("Failed to get status", 500, origin, error.message);
    }
  }

  // Endpoint: Get pending rebalancing commands
  if (path === "/rebalance-commands") {
    if (!env.SMARTAPP_STORAGE) return errorResponse("Storage not configured", 500, origin);
    try {
      const commands = await env.SMARTAPP_STORAGE.get("rebalance:commands", "json") || { commands: [], executed: true };
      return successResponse(commands, origin);
    } catch (error) {
      return errorResponse("Failed to get commands", 500, origin, error.message);
    }
  }

  return new Response(JSON.stringify({
    error: "Not found",
    endpoints: [
      "GET /devices - Get all current device states",
      "GET /device/{deviceId} - Get state for specific device",
      "GET /history/{deviceId} - Get event history for specific device",
      "GET /rebalance - Trigger HVAC rebalancing",
      "GET /rebalance-status - Get last rebalancing status",
      "GET /rebalance-commands - Get pending rebalancing commands"
    ]
  }), { status: 404, headers: corsHeaders(origin) });
}

// --- SmartThings Webhook Handler ---

async function handleSmartThingsWebhook(request, env, ctx) {
  try {
    const body = await request.json();
    const lifecycle = body.lifecycle;
    console.log(`Processing lifecycle: ${lifecycle}`);

    switch (lifecycle) {
      case "PING":
        return handlePing(body);
      case "CONFIRMATION":
        return handleConfirmation(body);
      case "CONFIGURATION":
        return handleConfiguration(body);
      case "INSTALL":
        return handleInstall(body, env, ctx);
      case "UPDATE":
        return handleUpdate(body, env, ctx);
      case "EVENT":
        return handleEvent(body, env);
      case "UNINSTALL":
        return handleUninstall(body, env);
      default:
        console.warn(`Unknown lifecycle: ${lifecycle}`);
        return new Response(JSON.stringify({ statusCode: 400, message: "Unknown lifecycle" }), {
          status: 400, headers: { "Content-Type": "application/json" }
        });
    }
  } catch (error) {
    console.error("Webhook Error:", error);
    return new Response(JSON.stringify({ statusCode: 500, message: error.message }), {
      status: 500, headers: { "Content-Type": "application/json" }
    });
  }
}

// --- Lifecycle Handlers ---

function handlePing(body) {
  return new Response(JSON.stringify({
    pingData: { challenge: body.pingData?.challenge }
  }), { status: 200, headers: { "Content-Type": "application/json" } });
}

function handleConfirmation(body) {
  const confirmationUrl = body.confirmationData?.confirmationUrl;
  console.log("Confirmation URL verified:", confirmationUrl);
  return new Response(JSON.stringify({ statusCode: 200 }), { 
    status: 200, headers: { "Content-Type": "application/json" } 
  });
}

function handleConfiguration(body) {
  const phase = body.configurationData?.phase;
  
  if (phase === "INITIALIZE") {
    return new Response(JSON.stringify({
      configurationData: {
        initialize: {
          name: "HVAC Monitor Worker",
          description: "Cloudflare Worker based Monitor",
          id: "hvac-monitor-worker",
          permissions: ["r:devices:*", "x:devices:*", "r:locations:*"], // Read devices, execute commands, read locations
          firstPageId: "selectDevices"
        }
      }
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  }

  if (phase === "PAGE") {
    // HVAC-only configuration to minimize Cloudflare KV operations
    return new Response(JSON.stringify({
      configurationData: {
        page: {
          pageId: "selectDevices",
          name: "Select HVAC Devices",
          complete: true,
          sections: [
            {
              name: "Thermostats",
              settings: [{
                id: "selectedThermostats",
                name: "Select Thermostats",
                description: "Thermostats to monitor for HVAC control",
                type: "DEVICE",
                required: false,
                multiple: true,
                capabilities: ["thermostatMode"],
                permissions: ["r", "x"]
              }]
            },
            {
              name: "Sensors",
              settings: [{
                id: "selectedSensors",
                name: "Select Temperature Sensors",
                description: "Temperature sensors to monitor",
                type: "DEVICE",
                required: false,
                multiple: true,
                capabilities: ["temperatureMeasurement"],
                permissions: ["r"]
              }]
            }
          ]
        }
      }
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  }
}

async function handleInstall(body, env, ctx) {
  return setupSubscriptionsAndFetchInitial(body.installData, env, ctx, "INSTALL");
}

async function handleUpdate(body, env, ctx) {
  return setupSubscriptionsAndFetchInitial(body.updateData, env, ctx, "UPDATE");
}

// Helper for Install/Update to DRY code
function setupSubscriptionsAndFetchInitial(data, env, ctx, type) {
  const authToken = data.authToken;
  const installedAppId = data.installedApp.installedAppId;
  const config = data.installedApp.config;
  
  // Aggregate devices from all possible inputs (HVAC only)
  const rawDevices = [
    ...(config.selectedThermostats || []),
    ...(config.selectedSensors || []),
    ...(config.selectedDevices || []), // Previous single-field attempt
    ...(config.tempSensors || [])      // Original legacy field
  ];

  // Deduplicate devices by ID (in case user selects same device in multiple sections)
  const devices = [];
  const seenIds = new Set();
  for (const d of rawDevices) {
    const id = d.deviceConfig.deviceId;
    if (!seenIds.has(id)) {
      seenIds.add(id);
      devices.push(d);
    }
  }

  // 1. Store App Config
  if (env.SMARTAPP_STORAGE) {
    ctx.waitUntil(
      env.SMARTAPP_STORAGE.put(`install:${installedAppId}`, JSON.stringify({
        authToken, 
        config,
        updatedAt: new Date().toISOString()
      }))
    );
  }

  // 2. Build Subscriptions
  // We create a subscription for EVERY attribute we want to track for EVERY device
  const subscriptions = [];
  
  for (const device of devices) {
    for (const track of TRACKED_ATTRIBUTES) {
      subscriptions.push({
        sourceType: "DEVICE",
        device: {
          deviceId: device.deviceConfig.deviceId,
          capability: track.capability,
          attribute: track.attribute,
          stateChangeOnly: false // Get all events to ensure connectivity
        }
      });
    }
  }

  // 3. IMPORTANT: Fetch current status immediately in background
  if (authToken && devices.length > 0) {
    ctx.waitUntil(fetchInitialDeviceStates(devices, authToken, env));
  }

  console.log(`[${type}] Creating ${subscriptions.length} subscriptions for ${devices.length} unique devices.`);

  return new Response(JSON.stringify({
    [type === "INSTALL" ? "installData" : "updateData"]: { subscriptions }
  }), { status: 200, headers: { "Content-Type": "application/json" } });
}

async function handleEvent(body, env) {
  const events = body.eventData?.events || [];
  console.log(`Received ${events.length} events`);

  for (const event of events) {
    if (event.eventType === "DEVICE_EVENT") {
      const { deviceId, capability, attribute, value, unit, componentId } = event.deviceEvent;
      
      // Check if this is one of the attributes we track
      const isTracked = TRACKED_ATTRIBUTES.some(t => t.attribute === attribute);
      
      if (isTracked) {
        console.log(`📡 Event: ${attribute} = ${value} (${deviceId})`);
        await saveEvent(env, deviceId, attribute, value, unit, componentId);
      }
    }
  }

  return new Response(JSON.stringify({ statusCode: 200 }), { 
    status: 200, headers: { "Content-Type": "application/json" } 
  });
}

async function handleUninstall(body, env) {
  const id = body.uninstallData?.installedApp?.installedAppId;
  if (env.SMARTAPP_STORAGE && id) {
    await env.SMARTAPP_STORAGE.delete(`install:${id}`);
  }
  return new Response(JSON.stringify({ statusCode: 200 }), { 
    status: 200, headers: { "Content-Type": "application/json" } 
  });
}

// --- Helpers ---

// Manually fetch device status via SmartThings API
async function fetchInitialDeviceStates(devices, authToken, env) {
  console.log("Fetching full initial states with labels and rooms...");
  
  // Cache room names to avoid repeated API calls for same room
  const roomCache = {};

  for (const device of devices) {
    const deviceId = device.deviceConfig.deviceId;
    try {
      // Step A: Fetch Device Details (Label, RoomID)
      const detailsResp = await fetch(`https://api.smartthings.com/v1/devices/${deviceId}`, {
        headers: { "Authorization": `Bearer ${authToken}` }
      });

      let label = "Unknown Device";
      let roomId = null;
      let roomName = "Unassigned";

      if (detailsResp.ok) {
        const details = await detailsResp.json();
        label = details.label || details.name || label;
        roomId = details.roomId;
        const locationId = details.locationId;

        // Step B: Fetch Room Name (if we have a roomId)
        if (roomId && locationId) {
          if (roomCache[roomId]) {
            roomName = roomCache[roomId];
          } else {
            try {
              const roomResp = await fetch(`https://api.smartthings.com/v1/locations/${locationId}/rooms/${roomId}`, {
                headers: { "Authorization": `Bearer ${authToken}` }
              });
              if (roomResp.ok) {
                const roomData = await roomResp.json();
                roomName = roomData.name;
                roomCache[roomId] = roomName; // Cache it
              }
            } catch (err) {
              console.warn(`Failed to fetch room name for ${roomId}`, err);
            }
          }
        }
      }

      // Step C: Fetch Device Attributes (Status)
      const statusResp = await fetch(`https://api.smartthings.com/v1/devices/${deviceId}/status`, {
        headers: { "Authorization": `Bearer ${authToken}` }
      });
      
      if (statusResp.ok) {
        const fullStatus = await statusResp.json();
        const main = fullStatus.components?.main || fullStatus.components?.[Object.keys(fullStatus.components)[0]];
        
        // Construct Initial State Object with Label and Room
        const initialState = {
          deviceId,
          label,
          room: roomName,
          roomId,
          lastUpdated: new Date().toISOString()
        };

        // Extract all tracked attributes
        for (const track of TRACKED_ATTRIBUTES) {
          const item = main[track.capability]?.[track.attribute];
          if (item && item.value !== null) {
            initialState[track.attribute] = item.value;
            if (item.unit) initialState[`${track.attribute}Unit`] = item.unit;
          }
        }
        
        console.log(`Saving initial state for ${label} (${deviceId}) in ${roomName}`);

        if (env.SMARTAPP_STORAGE) {
          // Use 'device:' prefix for the full object
          await env.SMARTAPP_STORAGE.put(`device:${deviceId}`, JSON.stringify(initialState));
        }

      } else {
        console.error(`Failed to fetch status for ${deviceId}: ${statusResp.status}`);
      }
    } catch (e) {
      console.error(`Error fetching initial state for ${deviceId}`, e);
    }
  }
}

async function saveEvent(env, deviceId, attribute, value, unit, componentId) {
  if (!env.SMARTAPP_STORAGE) return;

  const timestamp = new Date().toISOString();
  
  // 1. Fetch Existing State (read-modify-write)
  // We use "device:" prefix now to store the composite object
  const key = `device:${deviceId}`;
  // We default to minimal object, but ideally this merges with the rich object created by fetchInitialDeviceStates
  let currentState = await env.SMARTAPP_STORAGE.get(key, "json") || { deviceId };

  // 2. Update the specific attribute
  currentState[attribute] = value;
  if (unit) currentState[`${attribute}Unit`] = unit;
  currentState.lastUpdated = timestamp;

  // 3. Save merged state
  await env.SMARTAPP_STORAGE.put(key, JSON.stringify(currentState));

  // 4. History tracking DISABLED to save KV operations
  // To re-enable, uncomment the following section:
  /*
  const historyKey = `history:${deviceId}`;
  const historyItem = {
    attribute,
    value,
    unit,
    timestamp,
    context: {
      mode: currentState.thermostatMode,
      setpoint: currentState.coolingSetpoint || currentState.heatingSetpoint
    }
  };

  const existingHistory = await env.SMARTAPP_STORAGE.get(historyKey, "json") || [];
  existingHistory.unshift(historyItem);
  if (existingHistory.length > 100) existingHistory.length = 100;

  await env.SMARTAPP_STORAGE.put(historyKey, JSON.stringify(existingHistory));
  */

  // 5. Forward to Google Sheets
  if (env.GOOGLE_SHEETS_WEBHOOK_URL) {
    fetch(env.GOOGLE_SHEETS_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deviceId,
        label: currentState.label,
        room: currentState.room,
        attribute,
        value,
        unit,
        timestamp,
        fullState: currentState 
      })
    }).catch(err => console.error("Sheets Error:", err));
  }
}

function corsHeaders(origin) {
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400"
  };
}

function handleCORS() {
  return new Response(null, { status: 204, headers: corsHeaders("*") });
}

function successResponse(data, origin) {
  return new Response(JSON.stringify(data), { status: 200, headers: corsHeaders(origin) });
}

function errorResponse(message, status, origin, details = null) {
  return new Response(JSON.stringify({ error: message, details }), {
    status: status, headers: corsHeaders(origin)
  });
}

// --- Rebalancing Logic ---

/**
 * Execute a single device command via SmartThings API
 */
async function executeDeviceCommand(deviceId, action, value, pat) {
  const command = buildSmartThingsCommand(action, value);
  const payload = { commands: [command] };

  // Log the exact command being sent
  console.log(`📤 Sending command to ${deviceId}:`);
  console.log(`   Action: ${action}, Value: ${value}`);
  console.log(`   Payload: ${JSON.stringify(payload, null, 2)}`);

  try {
    const response = await fetch(`https://api.smartthings.com/v1/devices/${deviceId}/commands`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${pat}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error(`   Response (${response.status}): ${responseText.substring(0, 200)}`);
      throw new Error(`HTTP ${response.status}: ${responseText}`);
    }

    console.log(`   ✓ Success (${response.status}): ${responseText.substring(0, 100)}`);
    return { success: true, deviceId, response: responseText };
  } catch (error) {
    console.error(`   ✗ Failed: ${error.message}`);
    return { success: false, deviceId, error: error.message };
  }
}

/**
 * Build SmartThings command object based on action type
 */
function buildSmartThingsCommand(action, value) {
  switch (action) {
    case 'setThermostatMode':
      return {
        component: 'main',
        capability: 'thermostatMode',
        command: 'setThermostatMode',
        arguments: [value]
      };

    case 'setCoolingSetpoint':
      return {
        component: 'main',
        capability: 'thermostatCoolingSetpoint',
        command: 'setCoolingSetpoint',
        arguments: [value]
      };

    case 'setHeatingSetpoint':
      return {
        component: 'main',
        capability: 'thermostatHeatingSetpoint',
        command: 'setHeatingSetpoint',
        arguments: [value]
      };

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

/**
 * Main rebalancing function
 * Analyzes all HVAC devices and generates commands to optimize operation
 */
async function performRebalancing(env) {
  console.log("🔄 Starting HVAC rebalancing...");

  // 1. Fetch all device states from KV
  const list = await env.SMARTAPP_STORAGE.list({ prefix: "device:" });
  const devices = {};

  for (const key of list.keys) {
    const data = await env.SMARTAPP_STORAGE.get(key.name, "json");
    if (data && data.temperature !== undefined) {  // Only process devices with temperature
      const deviceId = key.name.substring(7);
      devices[deviceId] = data;
    }
  }

  if (Object.keys(devices).length === 0) {
    return {
      timestamp: new Date().toISOString(),
      message: "No HVAC devices found",
      commands: []
    };
  }

  // 2. Analyze devices and generate commands
  const analysis = analyzeHVACSystem(devices);
  const commands = generateRebalancingCommands(analysis);

  // 3. Get SmartApp authToken from KV storage
  let authToken = null;
  const installList = await env.SMARTAPP_STORAGE.list({ prefix: "install:" });
  if (installList.keys.length > 0) {
    // Get the first (and typically only) installation
    const installData = await env.SMARTAPP_STORAGE.get(installList.keys[0].name, "json");
    authToken = installData?.authToken;
  }

  // 4. Execute commands if authToken is available
  let executed = false;
  let executionResults = [];

  if (authToken && commands.length > 0) {
    console.log(`📤 Executing ${commands.length} commands via SmartThings API...`);

    for (const cmd of commands) {
      const result = await executeDeviceCommand(cmd.deviceId, cmd.action, cmd.value, authToken);
      executionResults.push(result);

      if (result.success) {
        console.log(`  ✓ ${cmd.action} on ${cmd.deviceId}`);
      } else {
        console.error(`  ✗ Failed ${cmd.action} on ${cmd.deviceId}: ${result.error}`);
      }
    }

    executed = true;
    const successCount = executionResults.filter(r => r.success).length;
    console.log(`✅ Execution complete: ${successCount}/${commands.length} successful`);
  } else if (commands.length > 0) {
    console.log(`⚠️  SmartApp not installed or authToken unavailable - commands generated but not executed`);
  }

  // 4. Store commands and status in KV (single write operation)
  const result = {
    timestamp: new Date().toISOString(),
    analysis: {
      totalDevices: Object.keys(devices).length,
      conflicts: analysis.conflicts,
      inefficiencies: analysis.inefficiencies,
      summary: analysis.summary
    },
    commands: commands,
    executed: executed,
    executionResults: executionResults.length > 0 ? executionResults : undefined
  };

  // Single KV write for commands
  await env.SMARTAPP_STORAGE.put("rebalance:commands", JSON.stringify(result));

  // Single KV write for status/history
  await env.SMARTAPP_STORAGE.put("rebalance:status", JSON.stringify({
    lastRun: result.timestamp,
    commandCount: commands.length,
    executed: executed,
    summary: analysis.summary
  }));

  console.log(`✅ Rebalancing complete: ${commands.length} commands generated`);

  return result;
}

/**
 * Analyze HVAC system for conflicts and inefficiencies
 */
function analyzeHVACSystem(devices) {
  const conflicts = [];
  const inefficiencies = [];
  const heatingZones = [];
  const coolingZones = [];

  // Analyze each device
  for (const [deviceId, device] of Object.entries(devices)) {
    const temp = device.temperature;
    const mode = device.thermostatMode;
    const operatingState = device.thermostatOperatingState || "idle";
    const coolSetpoint = device.coolingSetpoint || REBALANCE_CONFIG.DEFAULT_COOL_SETPOINT;
    const heatSetpoint = device.heatingSetpoint || REBALANCE_CONFIG.DEFAULT_HEAT_SETPOINT;

    // Track zones by mode
    if (mode === "heat") {
      heatingZones.push({ deviceId, device, temp, setpoint: heatSetpoint, operatingState });
    } else if (mode === "cool") {
      coolingZones.push({ deviceId, device, temp, setpoint: coolSetpoint, operatingState });
    }

    // Check for inefficiencies - ONLY if unit is actively running
    if (mode === "cool" && operatingState === "cooling" && temp < coolSetpoint - REBALANCE_CONFIG.HYSTERESIS) {
      inefficiencies.push({
        deviceId,
        type: "overcooling",
        message: `${device.label || deviceId} is actively cooling but temp (${temp}°F) is ${coolSetpoint - temp}°F below setpoint (${coolSetpoint}°F)`,
        temp,
        setpoint: coolSetpoint,
        mode,
        operatingState
      });
    }

    if (mode === "heat" && operatingState === "heating" && temp > heatSetpoint + REBALANCE_CONFIG.HYSTERESIS) {
      inefficiencies.push({
        deviceId,
        type: "overheating",
        message: `${device.label || deviceId} is actively heating but temp (${temp}°F) is ${temp - heatSetpoint}°F above setpoint (${heatSetpoint}°F)`,
        temp,
        setpoint: heatSetpoint,
        mode,
        operatingState
      });
    }
  }

  // Check for heating vs cooling conflicts
  if (heatingZones.length > 0 && coolingZones.length > 0) {
    conflicts.push({
      type: "heating-cooling-conflict",
      message: `System has ${heatingZones.length} zones in HEAT mode and ${coolingZones.length} zones in COOL mode`,
      heating: heatingZones.map(z => ({
        deviceId: z.deviceId,
        label: z.device.label,
        temp: z.temp,
        setpoint: z.setpoint
      })),
      cooling: coolingZones.map(z => ({
        deviceId: z.deviceId,
        label: z.device.label,
        temp: z.temp,
        setpoint: z.setpoint
      }))
    });
  }

  const summary = `Found ${conflicts.length} conflicts and ${inefficiencies.length} inefficiencies`;

  return { conflicts, inefficiencies, heatingZones, coolingZones, summary };
}

/**
 * Generate rebalancing commands based on analysis
 */
function generateRebalancingCommands(analysis) {
  const commands = [];
  const processedDevices = new Set(); // Track devices to avoid duplicates

  // 1. Handle inefficiencies - turn off units that are running when they shouldn't
  for (const issue of analysis.inefficiencies) {
    if (issue.type === "overcooling" || issue.type === "overheating") {
      commands.push({
        deviceId: issue.deviceId,
        action: "setThermostatMode",
        value: "off",
        reason: issue.message
      });
      processedDevices.add(issue.deviceId); // Mark as processed
    }
  }

  // 2. Handle conflicts - favor cooling if any zone is significantly overheated
  if (analysis.conflicts.length > 0) {
    for (const conflict of analysis.conflicts) {
      if (conflict.type === "heating-cooling-conflict") {
        // Check if any cooling zone is significantly overheated
        const significantOverheat = conflict.cooling.some(z =>
          z.temp > z.setpoint + REBALANCE_CONFIG.SIGNIFICANT_OVERHEAT
        );

        if (significantOverheat) {
          // Turn off all heating zones
          for (const zone of conflict.heating) {
            if (!processedDevices.has(zone.deviceId)) { // Skip if already processed
              commands.push({
                deviceId: zone.deviceId,
                action: "setThermostatMode",
                value: "off",
                reason: `Turning off heating in ${zone.label} to prioritize cooling (conflict resolution)`
              });
              processedDevices.add(zone.deviceId);
            }
          }
        } else {
          // Check if heating zones are already satisfied
          for (const zone of conflict.heating) {
            if (zone.temp >= zone.setpoint + REBALANCE_CONFIG.HYSTERESIS && !processedDevices.has(zone.deviceId)) {
              commands.push({
                deviceId: zone.deviceId,
                action: "setThermostatMode",
                value: "off",
                reason: `${zone.label} has reached target temperature`
              });
              processedDevices.add(zone.deviceId);
            }
          }

          // Check if cooling zones are already satisfied
          for (const zone of conflict.cooling) {
            if (zone.temp <= zone.setpoint - REBALANCE_CONFIG.HYSTERESIS && !processedDevices.has(zone.deviceId)) {
              commands.push({
                deviceId: zone.deviceId,
                action: "setThermostatMode",
                value: "off",
                reason: `${zone.label} has reached target temperature`
              });
              processedDevices.add(zone.deviceId);
            }
          }
        }
      }
    }
  }

  return commands;
}