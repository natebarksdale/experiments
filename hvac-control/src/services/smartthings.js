// SmartThings API integration
// Direct integration with SmartThings for real-time thermostat data

const SMARTTHINGS_API_BASE = 'https://api.smartthings.com/v1';

// Use environment variable for token (not recommended for client-side in production)
// Better approach: proxy through your own backend
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
