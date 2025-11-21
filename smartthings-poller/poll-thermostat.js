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

// Your thermostat devices - add or remove devices as needed
const DEVICES = [
  { id: '8021826e-78ca-4f3d-bd33-bdac1cadd3f2', location: 'Original Thermostat' },
  { id: '8051fd90-ab24-467c-8746-3dadbce02252', location: 'Basement' },
  { id: '87f9fbe2-f6b7-4877-9486-01b896a0acb5', location: 'Denn' },
  { id: '999d0c8c-2caa-4ea6-a7ef-f8d73d1a5147', location: 'Front Hall' },
  { id: 'c44c9f12-1029-43c0-af5f-a5ff572d37c7', location: 'Jrs Office' },
  { id: '8f5a0b61-76de-4add-bcb7-9cb5e7e8d3bd', location: 'Kids Bedroom' },
  { id: 'dd6b54be-a667-4acc-a112-d89c9923c29d', location: 'Main Kitchen' },
  { id: '9ced4ff7-4376-47c8-b882-5724bfb14306', location: 'Primary Bedroom' }
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
          unit: temperature.unit
        });

        successCount++;

      } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
        failureCount++;
      }
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
