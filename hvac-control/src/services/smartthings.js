// SmartThings API integration
// Direct integration with SmartThings for real-time thermostat data
// Control operations are proxied through Cloudflare Worker for security

import { isProxyAvailable, proxySmartThings } from './proxy';

const SMARTTHINGS_API_BASE = 'https://api.smartthings.com/v1';

// Use environment variable for token (only for read operations)
// Write operations go through proxy to keep token secure
const SMARTTHINGS_TOKEN = import.meta.env.VITE_SMARTTHINGS_TOKEN || '';

// Device mapping from sheets.js ZONES configuration
// Maps zone IDs to SmartThings device IDs
const DEVICE_MAP = {
  'apartment': '8051fd90-ab24-467c-8746-3dadbce02252',      // Basement
  'jrs_office': 'c44c9f12-1029-43c0-af5f-a5ff572d37c7',    // JR's Office
  'main_kitchen': 'dd6b54be-a667-4acc-a112-d89c9923c29d',  // Main Kitchen
  'kids_bedroom': '8f5a0b61-76de-4add-bcb7-9cb5e7e8d3bd',  // Kids Bedroom
  'front_hall': '999d0c8c-2caa-4ea6-a7ef-f8d73d1a5147',    // Front Hall
  'primary_bedroom': '9ced4ff7-4376-47c8-b882-5724bfb14306', // Primary Bedroom
  'nbs_office': '8021826e-78ca-4f3d-bd33-bdac1cadd3f2',    // NB's Office
  'denn': '87f9fbe2-f6b7-4877-9486-01b896a0acb5',          // Den
};

/**
 * Make an authenticated request to the SmartThings API
 */
async function smartthingsRequest(endpoint) {
  if (!SMARTTHINGS_TOKEN) {
    throw new Error('SmartThings token not configured');
  }

  const url = `${SMARTTHINGS_API_BASE}${endpoint}`;

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${SMARTTHINGS_TOKEN}`,
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`SmartThings API error: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Get device status from SmartThings
 */
async function getDeviceStatus(deviceId) {
  try {
    const status = await smartthingsRequest(`/devices/${deviceId}/status`);
    return status;
  } catch (error) {
    console.error(`Error fetching device ${deviceId}:`, error);
    return null;
  }
}

/**
 * Extract temperature from device status
 */
function extractTemperature(status) {
  const tempCapability = status?.components?.main?.temperatureMeasurement;

  if (tempCapability && tempCapability.temperature) {
    return {
      value: tempCapability.temperature.value,
      unit: tempCapability.temperature.unit,
      timestamp: new Date().toISOString()
    };
  }

  return null;
}

/**
 * Fetch current temperatures for all zones
 * Returns a map of zone ID to temperature data
 */
export async function fetchZoneTemperatures() {
  if (!SMARTTHINGS_TOKEN) {
    console.warn('SmartThings token not configured - using mock data');
    return null;
  }

  try {
    const temperatures = {};

    // Fetch all device statuses in parallel
    const devicePromises = Object.entries(DEVICE_MAP).map(async ([zoneId, deviceId]) => {
      const status = await getDeviceStatus(deviceId);
      if (status) {
        const temp = extractTemperature(status);
        if (temp) {
          temperatures[zoneId] = {
            temperature: temp.value,
            unit: temp.unit,
            timestamp: temp.timestamp,
            deviceId: deviceId
          };
        }
      }
    });

    await Promise.all(devicePromises);

    console.log('Fetched SmartThings temperatures:', temperatures);
    return temperatures;
  } catch (error) {
    console.error('Error fetching zone temperatures:', error);
    return null;
  }
}

/**
 * Check if SmartThings integration is available
 */
export function isSmartThingsAvailable() {
  return !!SMARTTHINGS_TOKEN;
}

/**
 * Execute a command on a SmartThings device
 * Routes through proxy if available for security
 */
async function executeCommand(deviceId, commands) {
  const endpoint = `/devices/${deviceId}/commands`;
  const body = { commands };

  // Use proxy if available (secure), otherwise direct API (dev mode)
  if (isProxyAvailable()) {
    const response = await proxySmartThings(endpoint, {
      method: 'POST',
      body: JSON.stringify(body)
    });

    return await response.json();
  } else {
    // Fallback to direct API (requires token in environment)
    if (!SMARTTHINGS_TOKEN) {
      throw new Error('SmartThings token not configured and proxy not available');
    }

    const url = `${SMARTTHINGS_API_BASE}${endpoint}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SMARTTHINGS_TOKEN}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`SmartThings command error: ${response.status} - ${errorText}`);
    }

    return await response.json();
  }
}

/**
 * Set thermostat mode
 * @param {string} deviceId - SmartThings device ID
 * @param {string} mode - 'off', 'heat', 'cool', 'auto', 'emergency heat'
 */
export async function setThermostatMode(deviceId, mode) {
  try {
    const result = await executeCommand(deviceId, [{
      component: 'main',
      capability: 'thermostatMode',
      command: 'setThermostatMode',
      arguments: [mode]
    }]);
    console.log(`Set thermostat ${deviceId} mode to ${mode}`, result);
    return { success: true, result };
  } catch (error) {
    console.error(`Failed to set thermostat mode:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Set heating setpoint
 * @param {string} deviceId - SmartThings device ID
 * @param {number} temperature - Target temperature in Fahrenheit
 */
export async function setHeatingSetpoint(deviceId, temperature) {
  try {
    const result = await executeCommand(deviceId, [{
      component: 'main',
      capability: 'thermostatHeatingSetpoint',
      command: 'setHeatingSetpoint',
      arguments: [temperature]
    }]);
    console.log(`Set thermostat ${deviceId} heating setpoint to ${temperature}°F`, result);
    return { success: true, result };
  } catch (error) {
    console.error(`Failed to set heating setpoint:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Set cooling setpoint
 * @param {string} deviceId - SmartThings device ID
 * @param {number} temperature - Target temperature in Fahrenheit
 */
export async function setCoolingSetpoint(deviceId, temperature) {
  try {
    const result = await executeCommand(deviceId, [{
      component: 'main',
      capability: 'thermostatCoolingSetpoint',
      command: 'setCoolingSetpoint',
      arguments: [temperature]
    }]);
    console.log(`Set thermostat ${deviceId} cooling setpoint to ${temperature}°F`, result);
    return { success: true, result };
  } catch (error) {
    console.error(`Failed to set cooling setpoint:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Control thermostat (convenience function)
 * @param {string} zoneId - Zone ID from DEVICE_MAP
 * @param {string} power - 'on' or 'off'
 * @param {string} mode - 'heat' or 'cool'
 * @param {number} target - Target temperature in Fahrenheit
 */
export async function controlThermostat(zoneId, power, mode, target) {
  const deviceId = DEVICE_MAP[zoneId];

  if (!deviceId) {
    console.error(`No device mapping found for zone ${zoneId}`);
    return { success: false, error: 'No device mapping' };
  }

  try {
    const results = [];

    // Set mode (off if power is off, otherwise heat/cool)
    const thermostatMode = power === 'off' ? 'off' : mode;
    const modeResult = await setThermostatMode(deviceId, thermostatMode);
    results.push({ action: 'setMode', ...modeResult });

    // Set target temperature if power is on
    if (power === 'on' && target) {
      if (mode === 'heat') {
        const setpointResult = await setHeatingSetpoint(deviceId, target);
        results.push({ action: 'setHeatingSetpoint', ...setpointResult });
      } else if (mode === 'cool') {
        const setpointResult = await setCoolingSetpoint(deviceId, target);
        results.push({ action: 'setCoolingSetpoint', ...setpointResult });
      }
    }

    const allSucceeded = results.every(r => r.success);

    return {
      success: allSucceeded,
      results,
      deviceId,
      zoneId
    };
  } catch (error) {
    console.error(`Failed to control thermostat for zone ${zoneId}:`, error);
    return { success: false, error: error.message };
  }
}
