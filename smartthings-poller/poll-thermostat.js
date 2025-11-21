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

// Your device ID from the SmartThings URL
const DEVICE_ID = '8021826e-78ca-4f3d-bd33-bdac1cadd3f2';

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
      return { readings: [] };
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

    console.log('🌡️  Polling SmartThings thermostat...');
    console.log(`Device ID: ${DEVICE_ID}`);

    // Get device status
    const { device, status } = await getDeviceStatus(DEVICE_ID);

    console.log(`Device: ${device.label || device.name}`);

    // Extract temperature
    const temperature = extractTemperature(status);

    if (!temperature) {
      console.error('❌ Could not extract temperature from device status');
      console.log('Status data:', JSON.stringify(status, null, 2));
      process.exit(1);
    }

    console.log(`✅ Current temperature: ${temperature.value}°${temperature.unit}`);

    // Load existing readings
    const data = await loadReadings();

    // Add new reading
    data.readings.push({
      temperature: temperature.value,
      unit: temperature.unit,
      timestamp: temperature.timestamp,
      deviceId: DEVICE_ID,
      deviceLabel: device.label || device.name
    });

    // Keep only last 1000 readings to prevent file from growing indefinitely
    if (data.readings.length > 1000) {
      data.readings = data.readings.slice(-1000);
    }

    // Add metadata
    data.lastUpdated = temperature.timestamp;
    data.totalReadings = data.readings.length;

    // Save readings
    await saveReadings(data);

    console.log(`💾 Saved reading to ${DATA_FILE}`);
    console.log(`Total readings: ${data.totalReadings}`);

    // Also output as summary for GitHub Actions
    console.log('::notice::Temperature recorded: ' + temperature.value + '°' + temperature.unit);

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
