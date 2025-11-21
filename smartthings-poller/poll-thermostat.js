#!/usr/bin/env node

/**
 * SmartThings Thermostat Polling Script
 * Queries the SmartThings API for thermostat temperature data
 * and stores readings in a JSON file with timestamps
 */

const fs = require('fs').promises;
const path = require('path');

const SMARTTHINGS_API_BASE = 'https://api.smartthings.com/v1';
const TOKEN = process.env.SMARTTHINGS_TOKEN;
const DATA_FILE = path.join(__dirname, '../data/temperature-readings.json');

// Google Sheets configuration
const GOOGLE_SHEETS_API_KEY = process.env.GOOGLE_SHEETS_API_KEY;
const SHEET_ID = '1W12hiuSTZSzDNrcuf9RxCYmQcKJxmm_WCQ9--cJ9BGo';
const SHEET_RANGE = '1819 Control Panel Panel!A57:H57';

// Your thermostat devices - add or remove devices as needed
const DEVICES = [
  { id: '8021826e-78ca-4f3d-bd33-bdac1cadd3f2', location: 'Original Thermostat', sheetName: 'NBs Office' },
  { id: '8051fd90-ab24-467c-8746-3dadbce02252', location: 'Basement', sheetName: 'Basement' },
  { id: '87f9fbe2-f6b7-4877-9486-01b896a0acb5', location: 'Denn', sheetName: 'Denn' },
  { id: '999d0c8c-2caa-4ea6-a7ef-f8d73d1a5147', location: 'Front Hall', sheetName: 'Front hall' },
  { id: 'c44c9f12-1029-43c0-af5f-a5ff572d37c7', location: 'Jrs Office', sheetName: 'JRs office' },
  { id: '8f5a0b61-76de-4add-bcb7-9cb5e7e8d3bd', location: 'Kids Bedroom', sheetName: 'Kids Bedroom' },
  { id: 'dd6b54be-a667-4acc-a112-d89c9923c29d', location: 'Main Kitchen', sheetName: 'Main kitchen' },
  { id: '9ced4ff7-4376-47c8-b882-5724bfb14306', location: 'Primary Bedroom', sheetName: 'Primary Bedroom' }
];

// Order for Google Sheets update (A57:H57)
// Basement, JRs office, Main kitchen, Kids Bedroom, Front hall, Primary Bedroom, NB's Office, Denn
const SHEET_ORDER = [
  'Basement',
  'JRs office',
  'Main kitchen',
  'Kids Bedroom',
  'Front hall',
  'Primary Bedroom',
  'NBs Office',
  'Denn'
];

/**
 * Make an authenticated request to the SmartThings API
 */
async function smartthingsRequest(endpoint) {
  const url = `${SMARTTHINGS_API_BASE}${endpoint}`;

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`SmartThings API error: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Get device details and current status
 */
async function getDeviceStatus(deviceId) {
  try {
    // Get device details
    const device = await smartthingsRequest(`/devices/${deviceId}`);

    // Get device status (includes all capabilities and their current values)
    const status = await smartthingsRequest(`/devices/${deviceId}/status`);

    return {
      device,
      status
    };
  } catch (error) {
    console.error('Error fetching device status:', error.message);
    throw error;
  }
}

/**
 * Extract temperature reading from device status
 */
function extractTemperature(status) {
  // SmartThings thermostats typically have a 'temperatureMeasurement' capability
  const tempCapability = status.components?.main?.temperatureMeasurement;

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
 * Load existing readings from file
 */
async function loadReadings() {
  try {
    const data = await fs.readFile(DATA_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      // File doesn't exist yet
      return { devices: {}, lastUpdated: null };
    }
    throw error;
  }
}

/**
 * Save readings to file
 */
async function saveReadings(data) {
  // Ensure data directory exists
  const dataDir = path.dirname(DATA_FILE);
  await fs.mkdir(dataDir, { recursive: true });

  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
}

/**
 * Update Google Sheets with current temperatures
 * @param {Object} temperatureMap - Map of sheetName to temperature value
 */
async function updateGoogleSheet(temperatureMap) {
  if (!GOOGLE_SHEETS_API_KEY) {
    console.log('⏭️  Skipping Google Sheets update (no API key configured)');
    return { success: false, reason: 'no_api_key' };
  }

  try {
    console.log('\n📊 Updating Google Sheets...');

    // Build row of temperatures in the correct order
    const values = SHEET_ORDER.map(sheetName => {
      const temp = temperatureMap[sheetName];
      return temp !== undefined ? temp : ''; // Empty string if no data
    });

    console.log(`   Sheet: ${SHEET_ID}`);
    console.log(`   Range: ${SHEET_RANGE}`);
    console.log(`   Values: [${values.join(', ')}]`);

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(SHEET_RANGE)}?valueInputOption=RAW&key=${GOOGLE_SHEETS_API_KEY}`;

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        range: SHEET_RANGE,
        values: [values], // Single row
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Google Sheets API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log(`   ✅ Updated ${result.updatedCells || 0} cells`);

    return { success: true, updatedCells: result.updatedCells };
  } catch (error) {
    console.error('   ❌ Error updating Google Sheets:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Main polling function
 */
async function poll() {
  try {
    if (!TOKEN) {
      console.error('❌ SMARTTHINGS_TOKEN environment variable not set');
      process.exit(1);
    }

    console.log('🌡️  Polling SmartThings thermostats...');
    console.log(`Devices to poll: ${DEVICES.length}`);
    console.log('');

    // Load existing readings
    const data = await loadReadings();

    // Ensure devices object exists
    if (!data.devices) {
      data.devices = {};
    }

    const currentTimestamp = new Date().toISOString();
    const readings = [];
    let successCount = 0;
    let failureCount = 0;

    // Poll each device
    for (const deviceConfig of DEVICES) {
      const { id, location } = deviceConfig;

      try {
        console.log(`📍 ${location} (${id.substring(0, 8)}...)`);

        // Get device status
        const { device, status } = await getDeviceStatus(id);

        // Extract temperature
        const temperature = extractTemperature(status);

        if (!temperature) {
          console.log(`   ⚠️  Could not extract temperature`);
          failureCount++;
          continue;
        }

        console.log(`   ✅ ${temperature.value}°${temperature.unit}`);

        // Initialize device data if it doesn't exist
        if (!data.devices[id]) {
          data.devices[id] = {
            location: location,
            deviceLabel: device.label || device.name,
            readings: []
          };
        }

        // Update device info (in case it changed)
        data.devices[id].location = location;
        data.devices[id].deviceLabel = device.label || device.name;

        // Add new reading
        const reading = {
          temperature: temperature.value,
          unit: temperature.unit,
          timestamp: temperature.timestamp
        };

        data.devices[id].readings.push(reading);

        // Keep only last 1000 readings per device
        if (data.devices[id].readings.length > 1000) {
          data.devices[id].readings = data.devices[id].readings.slice(-1000);
        }

        // Track for summary
        readings.push({
          location,
          temperature: temperature.value,
          unit: temperature.unit,
          sheetName: deviceConfig.sheetName
        });

        successCount++;

      } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
        failureCount++;
      }
    }

    // Update Google Sheets with current temperatures
    if (readings.length > 0) {
      const temperatureMap = {};
      readings.forEach(r => {
        if (r.sheetName) {
          temperatureMap[r.sheetName] = r.temperature;
        }
      });

      await updateGoogleSheet(temperatureMap);
    }

    console.log('');
    console.log('═══════════════════════════════════════════════════');
    console.log('📊 Summary');
    console.log('═══════════════════════════════════════════════════');

    // Update metadata
    data.lastUpdated = currentTimestamp;
    data.totalDevices = DEVICES.length;
    data.successfulReads = successCount;
    data.failedReads = failureCount;

    // Calculate statistics
    let totalReadings = 0;
    for (const deviceId in data.devices) {
      totalReadings += data.devices[deviceId].readings.length;
    }
    data.totalReadings = totalReadings;

    // Save readings
    await saveReadings(data);

    console.log(`✅ Successfully polled: ${successCount}/${DEVICES.length} devices`);
    if (failureCount > 0) {
      console.log(`❌ Failed: ${failureCount} devices`);
    }
    console.log(`💾 Total readings stored: ${totalReadings}`);
    console.log(`📁 Saved to: ${DATA_FILE}`);

    // Show current temperatures
    console.log('');
    console.log('Current temperatures:');
    readings.sort((a, b) => a.location.localeCompare(b.location));
    for (const reading of readings) {
      console.log(`  ${reading.location.padEnd(20)} ${reading.temperature}°${reading.unit}`);
    }

    // Output summary for GitHub Actions
    if (readings.length > 0) {
      const temps = readings.map(r => `${r.location}: ${r.temperature}°${r.unit}`).join(', ');
      console.log(`::notice::Temperatures recorded - ${temps}`);
    }

    if (failureCount > 0) {
      console.log('::warning::Some devices failed to report temperature');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run the poll
poll();
