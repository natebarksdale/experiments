#!/usr/bin/env node

/**
 * SmartThings Thermostat Polling Script
 * Queries the SmartThings API for thermostat temperature data
 * and stores readings in a JSON file with timestamps
 */

const fs = require('fs').promises;
const path = require('path');
const { analyzeAllLoops } = require('./hvac-control-logic');

const SMARTTHINGS_API_BASE = 'https://api.smartthings.com/v1';
const TOKEN = process.env.SMARTTHINGS_TOKEN;
const DATA_FILE = path.join(__dirname, '../data/temperature-readings.json');
const CONTROL_LOG_FILE = path.join(__dirname, '../data/hvac-control-log.json');

// Google Sheets configuration
const GOOGLE_SHEETS_API_KEY = process.env.GOOGLE_SHEETS_API_KEY;
const SHEET_ID = '1W12hiuSTZSzDNrcuf9RxCYmQcKJxmm_WCQ9--cJ9BGo';
const SHEET_RANGE = '1819 Control Panel Panel!A57:H57';

// Weather API configuration
const WEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;
const ZIP_CODE = '20010';
const COUNTRY_CODE = 'US';

// Light configuration - maps zones to their associated light rows in Google Sheets
// Based on ZONES configuration from hvac-control/src/services/sheets.js
const ZONE_LIGHTS = {
  'Basement': [
    { name: 'Kitchen', row: 13 },
    { name: 'Bathroom', row: 8 },
    { name: 'Studio Ceiling', row: 7 },
    { name: 'Studio Floor Lamp', row: 9 },
    { name: 'Studio Desk Lamp', row: 10 }
  ],
  'Jrs Office': [
    { name: 'Main Lights', row: 29 }
  ],
  'Main Kitchen': [
    { name: 'Main Lights', row: 26 },
    { name: 'Island Pendants', row: 25 },
    { name: 'Under Cabinet', row: 27 }
  ],
  'Kids Bedroom': [
    { name: 'Main Lights', row: 3 }
  ],
  'Front Hall': [
    { name: 'Entryway', row: 17 },
    { name: 'Foyer Lights', row: 20 },
    { name: 'Chandelier', row: 19 }
  ],
  'Primary Bedroom': [
    { name: 'Floor Lamp', row: 5 },
    { name: 'Ceiling', row: 6 }
  ],
  'NBs Office': [
    { name: 'Main Lights', row: 30 }
  ],
  'Denn': [
    { name: 'Main Lights', row: 15 }
  ]
};

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
 * Extract comprehensive thermostat data from device status
 */
function extractThermostatData(status) {
  const main = status.components?.main;

  if (!main) {
    return null;
  }

  const data = {
    timestamp: new Date().toISOString()
  };

  // Temperature
  const tempCapability = main.temperatureMeasurement;
  if (tempCapability && tempCapability.temperature) {
    data.temperature = {
      value: tempCapability.temperature.value,
      unit: tempCapability.temperature.unit
    };
  }

  // Humidity
  const humidityCapability = main.relativeHumidityMeasurement;
  if (humidityCapability && humidityCapability.humidity) {
    data.humidity = humidityCapability.humidity.value;
  }

  // Thermostat mode (off, heat, cool, auto, emergency heat)
  const modeCapability = main.thermostatMode;
  if (modeCapability && modeCapability.thermostatMode) {
    data.mode = modeCapability.thermostatMode.value;
  }

  // Operating state (idle, heating, cooling, pending heat, pending cool, vent economizer, fan only)
  const operatingStateCapability = main.thermostatOperatingState;
  if (operatingStateCapability && operatingStateCapability.thermostatOperatingState) {
    data.operatingState = operatingStateCapability.thermostatOperatingState.value;
  }

  // Heating setpoint
  const heatingSetpoint = main.thermostatHeatingSetpoint;
  if (heatingSetpoint && heatingSetpoint.heatingSetpoint) {
    data.heatingSetpoint = heatingSetpoint.heatingSetpoint.value;
  }

  // Cooling setpoint
  const coolingSetpoint = main.thermostatCoolingSetpoint;
  if (coolingSetpoint && coolingSetpoint.coolingSetpoint) {
    data.coolingSetpoint = coolingSetpoint.coolingSetpoint.value;
  }

  // Fan mode
  const fanMode = main.thermostatFanMode;
  if (fanMode && fanMode.thermostatFanMode) {
    data.fanMode = fanMode.thermostatFanMode.value;
  }

  return data;
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
 * Fetch light status from Google Sheets
 * Reads from Lights sheet column D (On/Off status)
 */
async function fetchLightStatus() {
  if (!GOOGLE_SHEETS_API_KEY) {
    return {};
  }

  try {
    // Fetch light status from Lights!D2:D40 (covers all lights)
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Lights!D2:D40?key=${GOOGLE_SHEETS_API_KEY}`;
    const response = await fetch(url);

    if (!response.ok) {
      console.error(`Error fetching light status: ${response.status}`);
      return {};
    }

    const data = await response.json();
    const values = data.values || [];

    // Build map of row number to status (on/off)
    const lightStatus = {};
    values.forEach((row, index) => {
      const rowNum = index + 2; // Rows start at 2
      const status = row[0]?.toLowerCase() === 'on' ? 'on' : 'off';
      lightStatus[rowNum] = status;
    });

    return lightStatus;
  } catch (error) {
    console.error('Error fetching light status:', error.message);
    return {};
  }
}

/**
 * Get light status for a specific zone
 * @param {string} location - Zone location name
 * @param {Object} lightStatus - Map of row numbers to status
 * @returns {Object} Light status summary for the zone
 */
function getZoneLightStatus(location, lightStatus) {
  const lights = ZONE_LIGHTS[location];
  if (!lights || lights.length === 0) {
    return { anyOn: false, onCount: 0, totalCount: 0 };
  }

  let onCount = 0;
  lights.forEach(light => {
    if (lightStatus[light.row] === 'on') {
      onCount++;
    }
  });

  return {
    anyOn: onCount > 0,
    onCount: onCount,
    totalCount: lights.length,
    lights: lights.map(light => ({
      name: light.name,
      status: lightStatus[light.row] || 'off'
    }))
  };
}

/**
 * Fetch current weather data from OpenWeatherMap API
 */
async function fetchWeatherData() {
  if (!WEATHER_API_KEY) {
    console.log('⚠️  OpenWeatherMap API key not configured - skipping weather data');
    return null;
  }

  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?zip=${ZIP_CODE},${COUNTRY_CODE}&appid=${WEATHER_API_KEY}&units=imperial`;
    const response = await fetch(url);

    if (!response.ok) {
      console.error(`Weather API error: ${response.status}`);
      return null;
    }

    const data = await response.json();

    return {
      timestamp: new Date().toISOString(),
      temperature: {
        value: Math.round(data.main.temp * 10) / 10, // Round to 1 decimal
        unit: 'F'
      },
      humidity: data.main.humidity,
      feelsLike: Math.round(data.main.feels_like * 10) / 10,
      pressure: data.main.pressure,
      description: data.weather[0]?.description || '',
      windSpeed: data.wind?.speed || 0,
      cloudiness: data.clouds?.all || 0,
      location: {
        name: data.name,
        zipCode: ZIP_CODE
      }
    };
  } catch (error) {
    console.error('Error fetching weather data:', error.message);
    return null;
  }
}

/**
 * Calculate rolling average from weather history
 * @param {Array} weatherHistory - Array of weather readings
 * @param {number} hours - Number of hours to average over
 * @returns {number|null} Average temperature or null
 */
function calculateRollingAverage(weatherHistory, hours) {
  if (!weatherHistory || weatherHistory.length === 0) {
    return null;
  }

  const now = new Date();
  const cutoff = new Date(now - hours * 60 * 60 * 1000);

  const relevantReadings = weatherHistory.filter(reading => {
    const readingTime = new Date(reading.timestamp);
    return readingTime >= cutoff;
  });

  if (relevantReadings.length === 0) {
    return null;
  }

  const sum = relevantReadings.reduce((acc, reading) => {
    return acc + (reading.temperature?.value || 0);
  }, 0);

  return Math.round((sum / relevantReadings.length) * 10) / 10;
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
 * Execute a command on a SmartThings device
 */
async function executeDeviceCommand(deviceId, commands) {
  try {
    const url = `${SMARTTHINGS_API_BASE}/devices/${deviceId}/commands`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ commands })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`SmartThings command error: ${response.status} - ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error executing device command:', error.message);
    throw error;
  }
}

/**
 * Set thermostat mode on a device
 */
async function setThermostatMode(deviceId, mode) {
  return executeDeviceCommand(deviceId, [{
    component: 'main',
    capability: 'thermostatMode',
    command: 'setThermostatMode',
    arguments: [mode]
  }]);
}

/**
 * Load control log history
 */
async function loadControlLog() {
  try {
    const data = await fs.readFile(CONTROL_LOG_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { logs: [] };
    }
    throw error;
  }
}

/**
 * Save control log entry
 */
async function saveControlLog(logData) {
  try {
    const existingLog = await loadControlLog();

    // Add new entry
    existingLog.logs.unshift(logData);

    // Keep only last 1000 entries
    if (existingLog.logs.length > 1000) {
      existingLog.logs = existingLog.logs.slice(0, 1000);
    }

    await fs.writeFile(CONTROL_LOG_FILE, JSON.stringify(existingLog, null, 2));
  } catch (error) {
    console.error('Error saving control log:', error.message);
  }
}

/**
 * Execute HVAC control actions
 */
async function executeControlActions(analysis) {
  const results = [];

  console.log('\n🎛️  HVAC Loop Control Analysis');
  console.log('═══════════════════════════════════════════════════');

  // Display loop summaries
  console.log(`\n📍 ${analysis.loop1.loopName}`);
  console.log(`   Recommended mode: ${analysis.loop1.decision.recommendedMode}`);
  console.log(`   ${analysis.loop1.decision.reason}`);
  console.log(`   Priority: ${analysis.loop1.decision.priority}`);

  console.log(`\n📍 ${analysis.loop2.loopName}`);
  console.log(`   Recommended mode: ${analysis.loop2.decision.recommendedMode}`);
  console.log(`   ${analysis.loop2.decision.reason}`);
  console.log(`   Priority: ${analysis.loop2.decision.priority}`);

  // Execute actions if any
  if (analysis.allActions.length === 0) {
    console.log('\n✅ No actions needed - all zones are operating correctly');
    return { success: true, actionsExecuted: 0, results: [] };
  }

  console.log(`\n⚡ Executing ${analysis.allActions.length} action(s)...`);

  for (const action of analysis.allActions) {
    try {
      console.log(`\n   → ${action.zoneName} (Loop ${action.loop})`);
      console.log(`     Current: ${action.currentMode} → New: ${action.newMode}`);
      console.log(`     Reason: ${action.reason}`);
      console.log(`     Priority: ${action.priority}`);

      // Execute the action
      const result = await setThermostatMode(action.deviceId, action.newMode);

      console.log(`     ✅ Success`);

      results.push({
        ...action,
        success: true,
        result,
        executedAt: new Date().toISOString()
      });

      // Small delay between commands to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error) {
      console.log(`     ❌ Failed: ${error.message}`);

      results.push({
        ...action,
        success: false,
        error: error.message,
        executedAt: new Date().toISOString()
      });
    }
  }

  const successCount = results.filter(r => r.success).length;
  console.log(`\n📊 Completed: ${successCount}/${analysis.allActions.length} actions successful`);

  // Save to control log
  await saveControlLog({
    timestamp: new Date().toISOString(),
    analysis: {
      loop1: {
        mode: analysis.loop1.decision.recommendedMode,
        reason: analysis.loop1.decision.reason,
        priority: analysis.loop1.decision.priority
      },
      loop2: {
        mode: analysis.loop2.decision.recommendedMode,
        reason: analysis.loop2.decision.reason,
        priority: analysis.loop2.decision.priority
      }
    },
    actionsPlanned: analysis.allActions.length,
    actionsExecuted: successCount,
    results
  });

  return {
    success: successCount === analysis.allActions.length,
    actionsExecuted: successCount,
    results
  };
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

    // Fetch light status from Google Sheets
    console.log('💡 Fetching light status...');
    const lightStatus = await fetchLightStatus();
    const lightCount = Object.keys(lightStatus).length;
    console.log(`   Found ${lightCount} lights`);
    console.log('');

    // Fetch exterior weather data
    console.log('🌤️  Fetching weather data...');
    const weatherData = await fetchWeatherData();
    if (weatherData) {
      console.log(`   ${weatherData.temperature.value}°${weatherData.temperature.unit}, ${weatherData.humidity}% humidity`);
      console.log(`   ${weatherData.description}`);
    }
    console.log('');

    // Load existing readings
    const data = await loadReadings();

    // Ensure devices object exists
    if (!data.devices) {
      data.devices = {};
    }

    // Ensure weather object exists
    if (!data.weather) {
      data.weather = {
        location: {
          zipCode: ZIP_CODE,
          name: weatherData?.location?.name || 'Washington, DC'
        },
        readings: []
      };
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

        // Extract comprehensive thermostat data
        const thermostatData = extractThermostatData(status);

        if (!thermostatData || !thermostatData.temperature) {
          console.log(`   ⚠️  Could not extract thermostat data`);
          failureCount++;
          continue;
        }

        // Get light status for this zone
        const zoneLights = getZoneLightStatus(location, lightStatus);

        // Log summary
        const tempStr = `${thermostatData.temperature.value}°${thermostatData.temperature.unit}`;
        const humidityStr = thermostatData.humidity ? ` ${thermostatData.humidity}%` : '';
        const stateStr = thermostatData.mode ? ` [${thermostatData.mode}/${thermostatData.operatingState || 'idle'}]` : '';
        const lightsStr = zoneLights.anyOn ? ` 💡${zoneLights.onCount}/${zoneLights.totalCount}` : '';
        console.log(`   ✅ ${tempStr}${humidityStr}${stateStr}${lightsStr}`);

        // Initialize device data if it doesn't exist
        if (!data.devices[id]) {
          data.devices[id] = {
            location: location,
            deviceLabel: device.label || device.name,
            sheetName: deviceConfig.sheetName,
            readings: []
          };
        }

        // Update device info (in case it changed)
        data.devices[id].location = location;
        data.devices[id].deviceLabel = device.label || device.name;
        data.devices[id].sheetName = deviceConfig.sheetName;

        // Add new reading with all available data (including lights)
        const reading = {
          ...thermostatData,
          lights: zoneLights
        };

        data.devices[id].readings.push(reading);

        // Keep only last 1000 readings per device
        if (data.devices[id].readings.length > 1000) {
          data.devices[id].readings = data.devices[id].readings.slice(-1000);
        }

        // Track for summary
        readings.push({
          location,
          temperature: thermostatData.temperature.value,
          unit: thermostatData.temperature.unit,
          humidity: thermostatData.humidity,
          mode: thermostatData.mode,
          operatingState: thermostatData.operatingState,
          sheetName: deviceConfig.sheetName
        });

        successCount++;

      } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
        failureCount++;
      }
    }

    // Add weather reading to history and calculate rolling averages
    if (weatherData) {
      data.weather.readings.push(weatherData);

      // Keep only last 1000 weather readings
      if (data.weather.readings.length > 1000) {
        data.weather.readings = data.weather.readings.slice(-1000);
      }

      // Calculate rolling averages
      data.weather.average24hr = calculateRollingAverage(data.weather.readings, 24);
      data.weather.average5day = calculateRollingAverage(data.weather.readings, 120); // 5 days = 120 hours

      console.log('🌤️  Weather tracking:');
      console.log(`   Current: ${weatherData.temperature.value}°${weatherData.temperature.unit}`);
      if (data.weather.average24hr !== null) {
        console.log(`   24hr avg: ${data.weather.average24hr}°F`);
      }
      if (data.weather.average5day !== null) {
        console.log(`   5-day avg: ${data.weather.average5day}°F`);
      }
      console.log(`   Total weather readings: ${data.weather.readings.length}`);
      console.log('');
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

    // Run HVAC loop control logic
    console.log('');
    if (successCount === DEVICES.length) {
      // Only run control logic if we successfully got data from all devices
      try {
        // Prepare device data for analysis
        const devicesDataForAnalysis = {};
        for (const deviceConfig of DEVICES) {
          const deviceData = data.devices[deviceConfig.id];
          if (deviceData && deviceData.readings.length > 0) {
            const latestReading = deviceData.readings[deviceData.readings.length - 1];
            devicesDataForAnalysis[deviceConfig.location] = latestReading;
          }
        }

        // Analyze all loops
        const analysis = analyzeAllLoops(devicesDataForAnalysis);

        // Execute recommended actions
        await executeControlActions(analysis);
      } catch (error) {
        console.error('❌ Error in HVAC control logic:', error.message);
        if (error.stack) {
          console.error(error.stack);
        }
      }
    } else {
      console.log('⏭️  Skipping HVAC control logic (not all devices reported data)');
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
