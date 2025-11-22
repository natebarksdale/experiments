// Google Sheets API integration
// Sheet ID: 1W12hiuSTZSzDNrcuf9RxCYmQcKJxmm_WCQ9--cJ9BGo

import { getAccessToken } from './auth';
import { fetchZoneTemperatures, isSmartThingsAvailable } from './smartthings';
import { isProxyAvailable, proxyIFTTT } from './proxy';

const SHEET_ID = '1W12hiuSTZSzDNrcuf9RxCYmQcKJxmm_WCQ9--cJ9BGo';
const API_KEY = import.meta.env.VITE_GOOGLE_SHEETS_API_KEY || '';

// Using gapi for Google Sheets API
const BASE_URL = 'https://sheets.googleapis.com/v4/spreadsheets';

// Map zone IDs to SmartThings device IDs for sparkline historical data
export const ZONE_DEVICE_MAP = {
  'apartment': '8051fd90-ab24-467c-8746-3dadbce02252',      // Basement
  'jrs_office': 'c44c9f12-1029-43c0-af5f-a5ff572d37c7',    // JR's Office
  'main_kitchen': 'dd6b54be-a667-4acc-a112-d89c9923c29d',  // Main Kitchen
  'kids_bedroom': '8f5a0b61-76de-4add-bcb7-9cb5e7e8d3bd',  // Kids Bedroom
  'front_hall': '999d0c8c-2caa-4ea6-a7ef-f8d73d1a5147',    // Front Hall
  'primary_bedroom': '9ced4ff7-4376-47c8-b882-5724bfb14306', // Primary Bedroom
  'nbs_office': '8021826e-78ca-4f3d-bd33-bdac1cadd3f2',    // NB's Office
  'denn': '87f9fbe2-f6b7-4877-9486-01b896a0acb5',          // Den
};

// Zone configuration matching the Control sheet order (rows 1-8)
// Loop 1: Primary Bedroom, NBs Office, Denn, Front hall
// Loop 2: Basement, JRs Office, Main kitchen, Kids Bedroom
// Light rows are from Lights sheet column D (names in D, state in B)
export const ZONES = [
  // Row 1: Apartment (Basement HVAC with lights folded in)
  {
    id: 'apartment',
    name: 'Apartment',
    floor: 0,
    position: 'center',
    hasHvac: true,
    loop: 2,
    lights: [
      { name: 'Kitchen', row: 13 },
      { name: 'Bathroom', row: 8 },
      { name: 'Studio Ceiling', row: 7 },
      { name: 'Studio Floor Lamp', row: 9 },
      { name: 'Studio Desk Lamp', row: 10 }
    ],
    locks: [
      { name: 'Patio Door', id: 'patio_door' }
    ]
  },

  // Row 2: JRs Office
  {
    id: 'jrs_office',
    name: 'Office',
    floor: 2,
    position: 'north',
    hasHvac: true,
    loop: 2,
    lights: [
      { name: 'Main Lights', row: 29 }
    ]
  },

  // Row 3: Main kitchen
  {
    id: 'main_kitchen',
    name: 'Kitchen',
    floor: 1,
    position: 'north',
    hasHvac: true,
    loop: 2,
    lights: [
      { name: 'Main Lights', row: 26 },
      { name: 'Island Pendants', row: 25 },
      { name: 'Under Cabinet', row: 27 }
    ]
  },

  // Row 4: Kids Bedroom - has main lights (row 3)
  {
    id: 'kids_bedroom',
    name: 'Bedroom',
    floor: 2,
    position: 'center',
    hasHvac: true,
    loop: 2,
    lights: [
      { name: 'Main Lights', row: 3 }
    ]
  },

  // Row 5: Front hall
  {
    id: 'front_hall',
    name: 'Hall',
    floor: 1,
    position: 'south',
    hasHvac: true,
    loop: 1,
    lights: [
      { name: 'Entryway', row: 17 },
      { name: 'Foyer Lights', row: 20 },
      { name: 'Chandelier', row: 19 }
    ],
    locks: [
      { name: 'Front Door', id: 'front_door' }
    ]
  },

  // Row 6: Primary Bedroom - has Floor Lamp (row 5) and ceiling (row 6)
  {
    id: 'primary_bedroom',
    name: 'Bedroom',
    floor: 3,
    position: 'south',
    hasHvac: true,
    loop: 1,
    lights: [
      { name: 'Floor Lamp', row: 5 },
      { name: 'Ceiling', row: 6 }
    ],
    plugs: [
      { name: 'TV', id: '3fl_bed_tv' }
    ]
  },

  // Row 7: NB's Office (3rd floor, no "3fl" prefix )
  {
    id: 'nbs_office',
    name: 'Office',
    floor: 3,
    position: 'north',
    hasHvac: true,
    loop: 1,
    lights: [
      { name: 'Main Lights', row: 30 }
    ]
  },

  // Row 8: Denn
  {
    id: 'denn',
    name: 'Den',
    floor: 2,
    position: 'south',
    hasHvac: true,
    loop: 1,
    lights: [
      { name: 'Main Lights', row: 15 }
    ],
    plugs: [
      { name: 'TV', id: '2fl_den_tv' }
    ]
  },
];

// Smart plug configuration
// Maps plug IDs to webhook event names and Lights sheet rows
// Status in Lights!D column - OFF = off, ON = on
// Timestamps in Lights!B (on) and Lights!C (off)
export const PLUG_CONFIG = {
  '2fl_den_tv': {
    name: 'Den TV',
    row: 32, // Update this to the actual row in your Lights sheet
    webhooks: { on: '2fl_den_tv_on', off: '2fl_den_tv_off' },
  },
  '3fl_bed_tv': {
    name: 'Bedroom TV',
    row: 33, // Update this to the actual row in your Lights sheet
    webhooks: { on: '3fl_bed_tv_on', off: '3fl_bed_tv_off' },
  },
};

// Legacy export for backward compatibility
export const PLUG_WEBHOOKS = Object.fromEntries(
  Object.entries(PLUG_CONFIG).map(([id, config]) => [id, config.webhooks])
);

// Door lock configuration
// Maps lock IDs to webhook event names and Lights sheet rows
// Status in Lights!D40:D44 - OFF = locked/closed, ON = unlocked/open
export const LOCK_CONFIG = {
  'basement_door': {
    name: 'Basement Door',
    row: 40,
    webhooks: { unlock: 'basement_door_unlock', lock: 'basement_door_lock' },
  },
  'front_door': {
    name: 'Front Door',
    row: 41,
    webhooks: { unlock: 'front_door_unlock', lock: 'front_door_lock' },
  },
  'patio_door': {
    name: 'Patio Door',
    row: 42,
    webhooks: { unlock: 'patio_door_unlock', lock: 'patio_door_lock' },
  },
  'alley_door': {
    name: 'Alley Door',
    row: 43,
    webhooks: { unlock: 'alley_door_unlock', lock: 'alley_door_lock' },
  },
  'garage_door': {
    name: 'Garage Door',
    row: 44,
    webhooks: { lock: 'garage_door_close' }, // Close only - no open webhook
    closeOnly: true, // Flag to indicate this is a close-only device
  },
};

/**
 * Fetch plug status from Lights sheet
 * Reads from configured rows in PLUG_CONFIG
 */
export async function fetchPlugStatus() {
  try {
    const plugEntries = Object.entries(PLUG_CONFIG);
    if (plugEntries.length === 0) return [];

    // Get the range covering all plug rows
    const rows = plugEntries.map(([_, config]) => config.row);
    const minRow = Math.min(...rows);
    const maxRow = Math.max(...rows);

    const states = await fetchRange(`Lights!D${minRow}:D${maxRow}`);

    const plugs = plugEntries.map(([id, config]) => {
      const rowIndex = config.row - minRow;
      const cellValue = states[rowIndex]?.[0];
      const state = cellValue?.toLowerCase() === 'on' ? 'on' : 'off';

      return {
        id,
        name: config.name,
        row: config.row,
        state,
      };
    });

    console.log('Fetched plug states:', plugs);
    return plugs;
  } catch (error) {
    console.error('Error fetching plug status:', error);
    return Object.entries(PLUG_CONFIG).map(([id, config]) => ({
      id,
      name: config.name,
      row: config.row,
      state: 'off', // Default to off on error
    }));
  }
}

/**
 * Toggle smart plug via IFTTT webhook
 * @param {string} plugId - Plug ID (e.g., '2fl_den_tv')
 * @param {string} currentState - Current state ('on' or 'off')
 */
export async function togglePlug(plugId, currentState = 'off') {
  try {
    const targetState = currentState === 'on' ? 'off' : 'on';

    const plugConfig = PLUG_CONFIG[plugId];
    if (!plugConfig) {
      throw new Error(`No configuration found for plug ${plugId}`);
    }

    const eventName = plugConfig.webhooks[targetState];
    console.log(`Toggling plug: ${plugConfig.name} -> ${targetState}`);

    // Route through proxy if available (secure), otherwise direct IFTTT (dev mode)
    if (isProxyAvailable()) {
      console.log(`Using proxy for IFTTT webhook: ${eventName}`);
      await proxyIFTTT(eventName, {});
    } else {
      // Fallback to direct IFTTT webhook call
      if (!IFTTT_KEY) {
        throw new Error('IFTTT webhook key not configured and proxy not available');
      }

      const url = `https://maker.ifttt.com/trigger/${eventName}/with/key/${IFTTT_KEY}`;
      console.log(`Using direct IFTTT webhook: ${url}`);

      await fetch(url, {
        method: 'POST',
        mode: 'no-cors',
      });
    }

    // Update timestamp in Lights sheet
    await updateLightTimestamp(plugConfig.row, targetState);

    console.log(`Plug control sent successfully`);
    return { success: true, targetState };
  } catch (error) {
    console.error('Error toggling plug:', error);
    throw error;
  }
}

// Additional rooms without HVAC but with lights
export const LIGHT_ONLY_ZONES = [
  // 3rd Floor (simplified, no "3F" prefix)
  {
    id: '3f_bathroom',
    name: 'Bathroom',
    floor: 3,
    position: 'center',
    hasHvac: false,
    lights: [
      { name: 'Ceiling Fan', row: 4 }
    ]
  },
  {
    id: '3f_stairs',
    name: 'Stairs',
    floor: 3,
    position: 'center',
    hasHvac: false,
    lights: [
      { name: 'Stairs', row: 31 }
    ]
  },

  // 2nd Floor
  {
    id: '2f_bathroom',
    name: '2F Bathroom',
    floor: 2,
    position: 'center',
    hasHvac: false,
    lights: [
      { name: 'Ceiling Fan', row: 2 }
    ]
  },

  // 1st Floor (simplified names)
  {
    id: 'dining_room',
    name: 'Dining',
    floor: 1,
    position: 'center',
    hasHvac: false,
    lights: [
      { name: 'Dining', row: 16 }
    ]
  },
  {
    id: 'parlor',
    name: 'Parlor',
    floor: 1,
    position: 'center',
    hasHvac: false,
    lights: [
      { name: 'Parlor', row: 28 }
    ]
  },
  {
    id: 'kitchen_deck',
    name: 'Deck',
    floor: 1,
    position: 'rear',
    hasHvac: false,
    lights: [
      { name: 'Deck', row: 24 }
    ]
  },
  {
    id: 'front_porch',
    name: 'Front Porch',
    floor: 1,
    position: 'front',
    hasHvac: false,
    lights: [
      { name: 'Front Porch', row: 21 }
    ]
  },

  // Basement (remaining rooms not in Apartment, simplified names)
  {
    id: 'basement_utility',
    name: 'Utility',
    floor: 0,
    position: 'center',
    hasHvac: false,
    lights: [
      { name: 'Utility', row: 12 }
    ],
    locks: [
      { name: 'Basement Door', id: 'basement_door' }
    ]
  },
  {
    id: 'basement_stairs',
    name: 'Stairs',
    floor: 0,
    position: 'center',
    hasHvac: false,
    lights: [
      { name: 'Stairs', row: 11 }
    ]
  },
  {
    id: 'basement_porch',
    name: 'Porch',
    floor: 0,
    position: 'rear',
    hasHvac: false,
    lights: [
      { name: 'Porch', row: 14 }
    ]
  },
  {
    id: 'basement_garage',
    name: 'Garage',
    floor: 0,
    position: 'center',
    hasHvac: false,
    lights: [
      { name: 'Garage Left', row: 22 },
      { name: 'Garage Right', row: 23 }
    ]
  },
  {
    id: 'exterior_backyard',
    name: 'Backyard',
    floor: 0,
    position: 'exterior',
    hasHvac: false,
    lights: [
      { name: 'Backyard', row: 18 }
    ],
    locks: [
      { name: 'Alley Door', id: 'alley_door' },
      { name: 'Garage Door', id: 'garage_door' }
    ]
  }
];

/**
 * Fetch data from Google Sheets
 * @param {string} range - A1 notation range (e.g., 'Panel!C2:C9')
 */
async function fetchRange(range) {
  try {
    const url = `${BASE_URL}/${SHEET_ID}/values/${range}?key=${API_KEY}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Sheets API error: ${response.status}`);
    }

    const data = await response.json();
    return data.values || [];
  } catch (error) {
    console.error('Error fetching from Sheets:', error);
    return [];
  }
}

/**
 * Update a range in Google Sheets
 * Requires OAuth for write access
 */
async function updateRange(range, values) {
  const accessToken = getAccessToken();

  if (!accessToken) {
    throw new Error('Not authenticated. Please sign in to update controls.');
  }

  try {
    const url = `${BASE_URL}/${SHEET_ID}/values/${range}?valueInputOption=RAW`;
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        range,
        values,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Sheets API error: ${error.error?.message || response.status}`);
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('Error updating Sheets:', error);
    throw error;
  }
}

/**
 * Fetch current panel status
 * Reads temperatures from SmartThings API (source of truth)
 * Reads control settings from Google Sheets (Control sheet overrides and Panel sheet defaults)
 */
export async function fetchPanelStatus() {
  try {
    // Fetch SmartThings temperatures in parallel with Google Sheets data
    const [
      smartthingsTemps,
      names,
      sheetsTemps,
      minutesAgo,
      // Control sheet - override values
      controlOverride,
      controlPower,
      controlMode,
      controlTarget,
      // Panel sheet - default values
      defaultPower,
      defaultMode,
      defaultTarget,
    ] = await Promise.all([
      isSmartThingsAvailable() ? fetchZoneTemperatures() : Promise.resolve(null),
      fetchRange('Panel!C2:C9'),
      fetchRange('Panel!F2:F9'),  // Fallback if SmartThings unavailable
      fetchRange('Panel!E2:E9'),
      // Control sheet columns
      fetchRange('Control!B1:B8'),  // Override flag (TRUE/FALSE)
      fetchRange('Control!D1:D8'),  // Power (Onn/Off)
      fetchRange('Control!E1:E8'),  // Mode (Heat/Cool)
      fetchRange('Control!I1:I8'),  // Target temp (e.g., 68a)
      // Panel sheet default columns
      fetchRange('Panel!G2:G9'),    // Default power
      fetchRange('Panel!H2:H9'),    // Default mode
      fetchRange('Panel!J2:J9'),    // Default thermostat
    ]);

    return ZONES.map((zone, index) => {
      const hasOverride = controlOverride[index]?.[0] === true ||
                          controlOverride[index]?.[0] === 'TRUE' ||
                          controlOverride[index]?.[0] === true;

      // Parse default state from Panel sheet
      const defaultState = {
        power: defaultPower[index]?.[0]?.toLowerCase().includes('on') ? 'on' : 'off',
        mode: defaultMode[index]?.[0]?.toLowerCase() || 'heat',
        target: parseInt(defaultTarget[index]?.[0]) || null,
      };

      // Determine current state based on override
      let currentState;
      if (hasOverride) {
        // Use Control sheet values
        const powerVal = controlPower[index]?.[0] || 'Off';
        const modeVal = controlMode[index]?.[0] || 'Heat';
        const targetVal = controlTarget[index]?.[0] || '68a';

        currentState = {
          power: powerVal.toLowerCase().includes('on') ? 'on' : 'off',
          mode: modeVal.toLowerCase(),
          target: parseInt(targetVal) || null,
          fan: targetVal.slice(-1) === 'a' ? 'auto' : 'high',
        };
      } else {
        // Use Panel sheet defaults
        currentState = {
          ...defaultState,
          fan: 'auto',
        };
      }

      // Get temperature from SmartThings (source of truth) with fallback to Google Sheets
      let temperature = null;
      let temperatureSource = 'sheets'; // Track data source for debugging

      if (smartthingsTemps && smartthingsTemps[zone.id]) {
        temperature = smartthingsTemps[zone.id].temperature;
        temperatureSource = 'smartthings';
      } else {
        // Fallback to Google Sheets temperature
        temperature = parseFloat(sheetsTemps[index]?.[0]) || null;
      }

      return {
        ...zone,
        unitName: names[index]?.[0] || zone.name,
        temperature: temperature,
        temperatureSource: temperatureSource, // Add source tracking
        minutesSinceUpdate: parseInt(minutesAgo[index]?.[0]) || null,
        preferredState: currentState,
        defaultState: defaultState,
        hasOverride: hasOverride,
      };
    });
  } catch (error) {
    console.error('Error fetching panel status:', error);
    return ZONES.map(zone => ({
      ...zone,
      temperature: null,
      minutesSinceUpdate: null,
      preferredState: { power: 'off', mode: 'heat', target: null, fan: 'auto' },
      defaultState: { power: 'off', mode: 'heat', target: null },
      hasOverride: false,
    }));
  }
}

/**
 * Parse preferred state string (e.g., "On-Heat-67a")
 */
function parsePreferredState(stateStr) {
  if (!stateStr) return { power: 'off', mode: 'heat', target: null, fan: 'auto' };

  const parts = stateStr.split('-');
  return {
    power: parts[0]?.toLowerCase().includes('on') ? 'on' : 'off',
    mode: parts[1]?.toLowerCase() || 'heat',
    target: parseInt(parts[2]) || null,
    fan: parts[2]?.slice(-1) === 'a' ? 'auto' : 'high',
  };
}

/**
 * Fetch control settings
 */
export async function fetchControlSettings() {
  try {
    const [power, mode, action] = await Promise.all([
      fetchRange('Control!D1:D8'),
      fetchRange('Control!E1:E8'),
      fetchRange('Control!B1:B8'),
    ]);

    return ZONES.map((zone, index) => ({
      zoneId: zone.id,
      power: power[index]?.[0] || 'off',
      mode: mode[index]?.[0] || 'heat',
      actionToggle: action[index]?.[0] || '',
    }));
  } catch (error) {
    console.error('Error fetching control settings:', error);
    return [];
  }
}

/**
 * Update control setting for a zone
 */
export async function updateControl(zoneIndex, field, value) {
  const rowNum = zoneIndex + 1;
  let column;
  let transformedValue = value;

  switch (field) {
    case 'power':
      column = 'D';
      // Transform 'on'/'off' to 'Onn'/'Off' (sheet format)
      transformedValue = value === 'on' ? 'Onn' : 'Off';
      break;
    case 'mode':
      column = 'E';
      // Capitalize mode for sheet format (Heat/Cool)
      transformedValue = value.charAt(0).toUpperCase() + value.slice(1);
      break;
    case 'target':
      column = 'I';
      // Format as temperature with 'a' suffix (e.g., 68a, 72a)
      transformedValue = `${value}a`;
      break;
    case 'action':
      column = 'B';
      // Use boolean TRUE for checkbox format
      transformedValue = true;
      break;
    case 'clearOverride':
      column = 'B';
      // Clear the override flag
      transformedValue = false;
      break;
    default:
      return { success: false, error: 'Invalid field' };
  }

  const range = `Control!${column}${rowNum}`;
  return updateRange(range, [[transformedValue]]);
}

/**
 * Get zones in the same loop as the given zone
 */
export function getLoopZones(zoneId) {
  const zone = ZONES.find(z => z.id === zoneId);
  if (!zone || !zone.loop) return [];

  return ZONES.filter(z => z.loop === zone.loop && z.id !== zoneId);
}

/**
 * Parse log entry
 * Format: "Basement-Off-Heat-65h+JRs office-Onn-Heat-67a+...+|71|63|63|67|63|73|65|69|X|H|H|X|H|X|H|X| 55"
 */
export function parseLogEntry(logStr) {
  if (!logStr) return null;

  try {
    const parts = logStr.split('|');
    const zonePart = parts[0]; // "Basement-Off-Heat-65h+JRs office-Onn-Heat-67a+..."
    const zoneEntries = zonePart.split('+').map(z => z.trim()).filter(Boolean);

    // After zonePart, next 8 elements are temperatures
    const temps = parts.slice(1, 9).map(t => parseInt(t)).filter(t => !isNaN(t));

    // After temps, next 8 elements are status codes (X, H, C, etc.)
    const statuses = parts.slice(9, 17).filter(Boolean);

    return zoneEntries.map((entry, index) => {
      const entryParts = entry.split('-');
      const name = entryParts[0]?.trim();
      const power = entryParts[1]?.toLowerCase().includes('on') ? 'on' : 'off';
      const mode = entryParts[2]?.toLowerCase() || 'heat';
      const target = parseInt(entryParts[3]) || null;

      return {
        name,
        power,
        mode,
        target,
        temperature: temps[index] || null,
        status: statuses[index] || 'X',
      };
    });
  } catch (error) {
    console.error('Error parsing log entry:', error, logStr);
    return null;
  }
}

/**
 * Fetch log history - last 7 days in reverse chronological order
 */
export async function fetchLogHistory(daysBack = 7) {
  try {
    // Fetch a large range to ensure we get enough recent data
    // Assuming ~50 entries per day max, fetch 500 rows to cover 7+ days
    const logs = await fetchRange(`Log!A1:B500`);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - daysBack);

    const parsedLogs = logs
      .map((row) => {
        if (!row || row.length < 2) return null;

        const dateStr = row[0]; // e.g., "November 3, 2025 at 06:48AM"
        const logStr = row[1]; // e.g., "Basement-Off-Heat-65a+..."

        // Parse the date string
        let timestamp;
        try {
          // Convert "November 3, 2025 at 06:48AM" to parseable format
          // Remove "at" and handle AM/PM
          let cleanDate = dateStr.replace(' at ', ' ');

          // Handle the AM/PM format - convert to 24-hour
          const ampmMatch = cleanDate.match(/(\d+):(\d+)(AM|PM)/i);
          if (ampmMatch) {
            let hours = parseInt(ampmMatch[1]);
            const minutes = ampmMatch[2];
            const ampm = ampmMatch[3].toUpperCase();

            // Convert to 24-hour format
            if (ampm === 'PM' && hours !== 12) {
              hours += 12;
            } else if (ampm === 'AM' && hours === 12) {
              hours = 0;
            }

            // Replace time with 24-hour format
            cleanDate = cleanDate.replace(/\d+:\d+(AM|PM)/i, `${hours}:${minutes}`);
          }

          timestamp = new Date(cleanDate);

          // Fallback if still invalid
          if (isNaN(timestamp.getTime())) {
            return null; // Skip invalid dates
          }
        } catch (e) {
          console.error('Date parsing error:', e, dateStr);
          return null;
        }

        return {
          timestamp,
          rawLog: logStr,
          parsed: parseLogEntry(logStr),
        };
      })
      .filter(entry => {
        // Filter out null entries and entries older than 7 days
        return entry && entry.parsed && entry.timestamp >= sevenDaysAgo;
      })
      .sort((a, b) => {
        // Sort by timestamp descending (newest first)
        return b.timestamp - a.timestamp;
      });

    return parsedLogs;
  } catch (error) {
    console.error('Error fetching log history:', error);
    return [];
  }
}

/**
 * Fetch light status from Lights sheet
 * Column D has state (On/Off) and names
 */
export async function fetchLightStatus() {
  try {
    const states = await fetchRange('Lights!D2:D39'); // State column D contains the state

    const lights = [];
    for (let i = 0; i < states.length; i++) {
      const cellValue = states[i]?.[0];
      if (cellValue) {
        // Check if cell value is "on" or "off" (case insensitive)
        const state = cellValue.toLowerCase() === 'on' ? 'on' : 'off';
        lights.push({
          index: i,
          name: `Light ${i + 2}`, // Generic name based on row
          state: state,
          row: i + 2, // Sheet row number (accounting for header)
        });
      }
    }

    console.log('Fetched light states:', lights);
    return lights;
  } catch (error) {
    console.error('Error fetching light status:', error);
    return [];
  }
}

// IFTTT webhook configuration
const IFTTT_KEY = import.meta.env.VITE_IFTTT_WEBHOOK_KEY || '';

// HVAC webhook configuration for direct Cielo control
// Maps zone IDs to webhook event names for faster response
// Order matches Control sheet rows 1-8:
// Row 1: Apartment (Basement), Row 2: JRs Office, Row 3: Main Kitchen, Row 4: Kids Bedroom
// Row 5: Front Hall, Row 6: Primary Bedroom, Row 7: NBs Office, Row 8: Den
const HVAC_WEBHOOKS = {
  'apartment': 'b_kitchen_hvac',        // Row 1: Basement/Apartment
  'jrs_office': '2fl_office_hvac',      // Row 2: JR's Office
  'main_kitchen': '1fl_kitchen_hvac',   // Row 3: Main Kitchen
  'kids_bedroom': '2fl_bedroom_hvac',   // Row 4: Kids Bedroom
  'front_hall': '1fl_hall_hvac',        // Row 5: Front Hall
  'primary_bedroom': '3fl_bedroom_hvac', // Row 6: Primary Bedroom
  'nbs_office': '3fl_office_hvac',      // Row 7: NB's Office
  'denn': '2fl_den_hvac',               // Row 8: Den
};

/**
 * Trigger HVAC webhook for direct Cielo control
 * @param {string} zoneId - Zone ID (e.g., 'nbs_office')
 * @param {string} power - 'on' or 'off'
 * @param {string} mode - 'heat' or 'cool'
 * @param {number} target - Target temperature in Fahrenheit
 */
export async function triggerHvacWebhook(zoneId, power, mode, target) {
  const webhookName = HVAC_WEBHOOKS[zoneId];
  if (!webhookName) {
    console.log(`No direct HVAC webhook configured for zone ${zoneId}`);
    return { success: false, reason: 'no_webhook' };
  }

  if (!IFTTT_KEY) {
    console.error('IFTTT webhook key not configured');
    return { success: false, reason: 'no_key' };
  }

  try {
    // Format values for IFTTT filter code
    // Value1: 'Onn' or 'Off'
    // Value2: 'Heat' or 'Cool'
    // Value3: target temperature (e.g., '67')
    const value1 = power === 'on' ? 'Onn' : 'Off';
    const value2 = mode.charAt(0).toUpperCase() + mode.slice(1); // 'heat' -> 'Heat'
    const value3 = target?.toString() || '68'; // Default to 68 if no target specified

    // Use query parameters for IFTTT webhooks
    const url = `https://maker.ifttt.com/trigger/${webhookName}/with/key/${IFTTT_KEY}?value1=${encodeURIComponent(value1)}&value2=${encodeURIComponent(value2)}&value3=${encodeURIComponent(value3)}`;

    console.log(`Triggering HVAC webhook: ${webhookName}`);
    console.log(`Values: power=${value1}, mode=${value2}, temp=${value3}`);

    await fetch(url, {
      method: 'POST',
      mode: 'no-cors', // IFTTT doesn't support CORS
    });

    console.log(`HVAC webhook sent successfully for ${zoneId}`);
    return { success: true, values: { value1, value2, value3 } };
  } catch (error) {
    console.error('Error triggering HVAC webhook:', error);
    return { success: false, reason: 'error', error };
  }
}

// Mapping of Lights sheet rows to webhook event names
// Based on the order in your Lights sheet
const LIGHT_WEBHOOKS = {
  2: { on: '2fl_bath_fan_on', off: '2fl_bath_fan_off' },               // 2fl Bathroom Ceiling Fan Light
  3: { on: '2fl_bed_on', off: '2fl_bed_off' },                         // 2fl Bedroom Front Bedroom Main Lights
  4: { on: '3fl_bath_fan_on', off: '3fl_bath_fan_off' },               // 3fl Bathroom Ceiling Fan Light
  5: { on: '3fl_bed_floor_lamp_on', off: '3fl_bed_floor_lamp_off' },   // 3fl Bedroom Floor Lamp
  6: { on: '3fl_bed_ceiling_on', off: '3fl_bed_ceiling_off' },         // Aeotec Dimmer Switch (Primary Bedroom Ceiling)
  7: { on: 'b_accent_on', off: 'b_accent_off' },                       // Basement Accent Wall
  8: { on: 'b_bath_on', off: 'b_bath_off' },                           // Basement Bath
  9: { on: 'b_studio_on', off: 'b_studio_off' },                       // Basement Bedroom
  10: { on: 'b_lamp_on', off: 'b_lamp_off' },                          // Basement Lamp (note: typo in sheet "b_lamp_of")
  11: { on: 'b_stairs_on', off: 'b_stairs_off' },                      // Basement Stairs
  12: { on: 'b_utility_on', off: 'b_utility_off' },                    // Basement Utility
  13: { on: 'b_kitchen_on', off: 'b_kitchen_off' },                    // Basement kitchen
  14: { on: 'b_porch_on', off: 'b_porch_off' },                        // Basement porch
  15: { on: '2fl_den_on', off: '2fl_den_off' },                        // Den Main Lights
  16: { on: '1fl_dining_on', off: '1fl_dining_off' },                  // Dining Room Main Lights
  17: { on: '1fl_entry_on', off: '1fl_entry_off' },                    // Entryway Light
  18: { on: 'b_backyard_on', off: 'b_backyard_off' },                  // Exterior Landscape Lights
  19: { on: '1fl_chandelier_on', off: '1fl_chandelier_off' },          // Front Foyer Chandelier
  20: { on: '1fl_foyer_on', off: '1fl_foyer_off' },                    // Front Foyer Main Lights
  21: { on: '1fl_porch_on', off: '1fl_porch_off' },                    // Front Porch Overhead Light
  22: { on: 'b_garage_left_on', off: 'b_garage_left_off' },            // Garage Left
  23: { on: 'b_garage_right_on', off: 'b_garage_right_off' },          // Garage Right
  24: { on: '1fl_deck_on', off: '1fl_deck_off' },                      // Kitchen Deck Deck Lights
  25: { on: '1fl_pendants_on', off: '1fl_pendants_off' },              // Kitchen Island Pendants
  26: { on: '1fl_kitchen_on', off: '1fl_kitchen_off' },                // Kitchen Main Lights
  27: { on: '1fl_cabinet_on', off: '1fl_cabinet_off' },                // Kitchen Under Cabinet
  28: { on: '1fl_parlor_on', off: '1fl_parlor_off' },                  // Living Room Main Lights
  29: { on: '2fl_office_on', off: '2fl_office_off' },                  // JRs Office Main Lights
  30: { on: '3fl_office_on', off: '3fl_office_off' },                  // Office Main Lights
  31: { on: '3fl_stairs_on', off: '3fl_stairs_off' },                  // Stairs Main Lights
};

// OPTION 2: Universal webhooks with URL path parameters
// Set to true to use universal webhooks instead of individual ones
// NOTE: Setting device dynamically via filter code doesn't seem to work in IFTTT
const USE_UNIVERSAL_WEBHOOKS = false;

/**
 * Format date for Lights sheet timestamp
 * Format: "November 19, 2025 at 06:26:02PM"
 */
function formatLightTimestamp(date = new Date()) {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const month = months[date.getMonth()];
  const day = date.getDate();
  const year = date.getFullYear();

  let hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // 0 should be 12
  const hoursStr = hours.toString().padStart(2, '0');

  return `${month} ${day}, ${year} at ${hoursStr}:${minutes}:${seconds}${ampm}`;
}

/**
 * Update the last-updated timestamp for a light/plug/lock in the Lights sheet
 * Column B for On, Column C for Off
 * @param {number} row - Row number in Lights sheet
 * @param {string} state - 'on' or 'off' (or 'unlocked'/'locked' for locks)
 */
async function updateLightTimestamp(row, state) {
  const accessToken = getAccessToken();

  if (!accessToken) {
    console.log('Not authenticated - skipping timestamp update');
    return;
  }

  try {
    // Column B for On/Unlocked, Column C for Off/Locked
    const isOn = state === 'on' || state === 'unlocked';
    const column = isOn ? 'B' : 'C';
    const timestamp = formatLightTimestamp();

    const range = `Lights!${column}${row}`;
    await updateRange(range, [[timestamp]]);

    console.log(`Updated timestamp for row ${row}, column ${column}: ${timestamp}`);
  } catch (error) {
    console.error('Error updating light timestamp:', error);
    // Don't throw - timestamp update is secondary to the webhook
  }
}

/**
 * Fetch lock status from Lights sheet
 * Rows 40-44 contain lock status in column D (OFF = locked, ON = unlocked)
 */
export async function fetchLockStatus() {
  try {
    const states = await fetchRange('Lights!D40:D44');

    const locks = Object.entries(LOCK_CONFIG).map(([id, config], index) => {
      const cellValue = states[index]?.[0];
      // OFF = locked, ON = unlocked
      const isUnlocked = cellValue?.toLowerCase() === 'on';

      return {
        id,
        name: config.name,
        row: config.row,
        state: isUnlocked ? 'unlocked' : 'locked',
      };
    });

    console.log('Fetched lock states:', locks);
    return locks;
  } catch (error) {
    console.error('Error fetching lock status:', error);
    return Object.entries(LOCK_CONFIG).map(([id, config]) => ({
      id,
      name: config.name,
      row: config.row,
      state: 'locked', // Default to locked on error
    }));
  }
}

/**
 * Toggle lock via IFTTT webhook
 * @param {string} lockId - Lock ID (e.g., 'front_door')
 * @param {string} currentState - Current state ('locked' or 'unlocked')
 */
export async function toggleLock(lockId, currentState = 'locked') {
  try {
    const lockConfig = LOCK_CONFIG[lockId];
    if (!lockConfig) {
      throw new Error(`No configuration found for lock ${lockId}`);
    }

    // For close-only locks (like garage), only allow closing
    if (lockConfig.closeOnly) {
      if (currentState === 'locked') {
        console.log(`${lockConfig.name} is already closed`);
        return { success: false, reason: 'already_closed' };
      }
      // Always close when toggling a close-only lock
      const webhookName = lockConfig.webhooks.lock;
      console.log(`Closing ${lockConfig.name}`);

      // Route through proxy if available (secure), otherwise direct IFTTT (dev mode)
      if (isProxyAvailable()) {
        console.log(`Using proxy for IFTTT webhook: ${webhookName}`);
        await proxyIFTTT(webhookName, {});
      } else {
        // Fallback to direct IFTTT webhook call
        if (!IFTTT_KEY) {
          throw new Error('IFTTT webhook key not configured and proxy not available');
        }

        const url = `https://maker.ifttt.com/trigger/${webhookName}/with/key/${IFTTT_KEY}`;
        console.log(`Using direct IFTTT webhook: ${url}`);

        await fetch(url, {
          method: 'POST',
          mode: 'no-cors',
        });
      }

      // Update timestamp in Lights sheet
      await updateLightTimestamp(lockConfig.row, 'locked');

      console.log(`Close command sent successfully`);
      return { success: true, targetState: 'locked' };
    }

    // Normal toggle behavior for regular locks
    const targetState = currentState === 'locked' ? 'unlocked' : 'locked';

    const webhookName = targetState === 'unlocked'
      ? lockConfig.webhooks.unlock
      : lockConfig.webhooks.lock;

    console.log(`Toggling lock: ${lockConfig.name} -> ${targetState}`);

    // Route through proxy if available (secure), otherwise direct IFTTT (dev mode)
    if (isProxyAvailable()) {
      console.log(`Using proxy for IFTTT webhook: ${webhookName}`);
      await proxyIFTTT(webhookName, {});
    } else {
      // Fallback to direct IFTTT webhook call
      if (!IFTTT_KEY) {
        throw new Error('IFTTT webhook key not configured and proxy not available');
      }

      const url = `https://maker.ifttt.com/trigger/${webhookName}/with/key/${IFTTT_KEY}`;
      console.log(`Using direct IFTTT webhook: ${url}`);

      await fetch(url, {
        method: 'POST',
        mode: 'no-cors',
      });
    }

    // Update timestamp in Lights sheet
    await updateLightTimestamp(lockConfig.row, targetState);

    console.log(`Lock control sent successfully`);
    return { success: true, targetState };
  } catch (error) {
    console.error('Error toggling lock:', error);
    throw error;
  }
}

/**
 * Toggle light via IFTTT webhook
 * @param {number} row - Row number in Lights sheet (2-based)
 * @param {string} lightName - Name of the light for logging
 * @param {string} currentState - Current state ('on' or 'off')
 */
export async function toggleLight(row, lightName, currentState = 'off') {
  try {
    const targetState = currentState === 'on' ? 'off' : 'on';

    // Determine event name and data based on configuration
    let eventName;
    let webhookData = {};

    if (USE_UNIVERSAL_WEBHOOKS) {
      // OPTION 2: Universal webhooks with device name
      const deviceName = LIGHT_DEVICE_NAMES[row];
      if (!deviceName) {
        throw new Error(`No device configured for light at row ${row}`);
      }

      eventName = targetState === 'on' ? 'light_on' : 'light_off';
      webhookData = { value1: deviceName };

      console.log(`Toggling light: ${lightName} (row ${row}) -> ${targetState}`);
      console.log(`Device: ${deviceName}`);
    } else {
      // OPTION 1: Individual webhooks per light
      const webhookEvents = LIGHT_WEBHOOKS[row];
      if (!webhookEvents) {
        throw new Error(`No webhook configured for light at row ${row}`);
      }

      eventName = webhookEvents[targetState];
      console.log(`Toggling light: ${lightName} (row ${row}) -> ${targetState}`);
    }

    // Route through proxy if available (secure), otherwise direct IFTTT (dev mode)
    if (isProxyAvailable()) {
      console.log(`Using proxy for IFTTT webhook: ${eventName}`);
      await proxyIFTTT(eventName, webhookData);
    } else {
      // Fallback to direct IFTTT webhook call
      if (!IFTTT_KEY) {
        throw new Error('IFTTT webhook key not configured and proxy not available');
      }

      const url = USE_UNIVERSAL_WEBHOOKS
        ? `https://maker.ifttt.com/trigger/${eventName}/with/key/${IFTTT_KEY}?value1=${encodeURIComponent(webhookData.value1)}`
        : `https://maker.ifttt.com/trigger/${eventName}/with/key/${IFTTT_KEY}`;

      console.log(`Using direct IFTTT webhook: ${url}`);
      await fetch(url, {
        method: 'POST',
        mode: 'no-cors', // IFTTT doesn't support CORS
      });
    }

    // Update timestamp in Lights sheet
    await updateLightTimestamp(row, targetState);

    console.log(`Light control sent successfully`);
    return { success: true, targetState };
  } catch (error) {
    console.error('Error toggling light:', error);
    throw error;
  }
}

// Mock data for development
export const MOCK_PANEL_DATA = ZONES.map((zone, i) => ({
  ...zone,
  unitName: zone.name,
  temperature: 65 + Math.random() * 8,
  minutesSinceUpdate: Math.floor(Math.random() * 30),
  preferredState: {
    power: i % 3 === 0 ? 'off' : 'on',
    mode: i % 2 === 0 ? 'heat' : 'cool',
    target: 67 + Math.floor(Math.random() * 6),
    fan: 'auto',
  },
}));
