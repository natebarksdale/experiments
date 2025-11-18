// Google Sheets API integration
// Sheet ID: 1W12hiuSTZSzDNrcuf9RxCYmQcKJxmm_WCQ9--cJ9BGo

import { getAccessToken } from './auth';

const SHEET_ID = '1W12hiuSTZSzDNrcuf9RxCYmQcKJxmm_WCQ9--cJ9BGo';
const API_KEY = import.meta.env.VITE_GOOGLE_SHEETS_API_KEY || '';

// Using gapi for Google Sheets API
const BASE_URL = 'https://sheets.googleapis.com/v4/spreadsheets';

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
    ]
  },

  // Row 7: NB's Office (3rd floor, no "3fl" prefix)
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
    ]
  },
];

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
 */
export async function fetchPanelStatus() {
  try {
    const [names, temps, minutesAgo, preferredStates] = await Promise.all([
      fetchRange('Panel!C2:C9'),
      fetchRange('Panel!F2:F9'),
      fetchRange('Panel!E2:E9'),
      fetchRange('Panel!A2:A9'),
    ]);

    return ZONES.map((zone, index) => ({
      ...zone,
      unitName: names[index]?.[0] || zone.name,
      temperature: parseFloat(temps[index]?.[0]) || null,
      minutesSinceUpdate: parseInt(minutesAgo[index]?.[0]) || null,
      preferredState: parsePreferredState(preferredStates[index]?.[0] || ''),
    }));
  } catch (error) {
    console.error('Error fetching panel status:', error);
    return ZONES.map(zone => ({ ...zone, temperature: null, minutesSinceUpdate: null, preferredState: {} }));
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
    case 'action':
      column = 'B';
      // Use boolean TRUE for checkbox format
      transformedValue = true;
      break;
    default:
      return { success: false, error: 'Invalid field' };
  }

  const range = `Control!${column}${rowNum}`;
  return updateRange(range, [[transformedValue]]);
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
 * Toggle light via IFTTT webhook
 * @param {number} row - Row number in Lights sheet (2-based)
 * @param {string} lightName - Name of the light for logging
 * @param {string} currentState - Current state ('on' or 'off')
 */
export async function toggleLight(row, lightName, currentState = 'off') {
  try {
    const targetState = currentState === 'on' ? 'off' : 'on';

    let url;
    if (USE_UNIVERSAL_WEBHOOKS) {
      // OPTION 2: Universal webhooks with device name in URL path
      // URL format: /trigger/{event}/with/key/{key}/{value1}/{value2}/{value3}
      // IFTTT exposes these as {{Value1}}, {{Value2}}, {{Value3}}
      const deviceName = LIGHT_DEVICE_NAMES[row];
      if (!deviceName) {
        throw new Error(`No device configured for light at row ${row}`);
      }

      const eventName = targetState === 'on' ? 'light_on' : 'light_off';
      // Pass device name as value1 query parameter
      url = `https://maker.ifttt.com/trigger/${eventName}/with/key/${IFTTT_KEY}?value1=${encodeURIComponent(deviceName)}`;

      console.log(`Toggling light: ${lightName} (row ${row}) -> ${targetState}`);
      console.log(`Device: ${deviceName}`);
      console.log(`Webhook URL: ${url}`);
      console.log(`Note: Device name is in query param as value1`);
    } else {
      // OPTION 1: Individual webhooks per light
      const webhookEvents = LIGHT_WEBHOOKS[row];
      if (!webhookEvents) {
        throw new Error(`No webhook configured for light at row ${row}`);
      }

      const eventName = webhookEvents[targetState];
      url = `https://maker.ifttt.com/trigger/${eventName}/with/key/${IFTTT_KEY}`;

      console.log(`Toggling light: ${lightName} (row ${row}) -> ${targetState}`);
      console.log(`Webhook URL: ${url}`);
    }

    // Simple POST/GET request - no body needed
    await fetch(url, {
      method: 'POST',
      mode: 'no-cors', // IFTTT doesn't support CORS
    });

    // Note: no-cors mode means we can't check response status
    // We assume success and rely on Google Sheets update to confirm
    console.log(`Webhook sent successfully`);

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
