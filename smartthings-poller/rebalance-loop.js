#!/usr/bin/env node

/**
 * Manual HVAC Loop Rebalance Script
 *
 * Runs the HVAC control logic on-demand for a specific loop or all loops
 * Usage:
 *   node rebalance-loop.js [loop-id]
 *
 * Examples:
 *   node rebalance-loop.js 1     # Rebalance Loop 1 (Front)
 *   node rebalance-loop.js 2     # Rebalance Loop 2 (Back)
 *   node rebalance-loop.js       # Rebalance all loops
 */

const fs = require('fs').promises;
const path = require('path');
const { analyzeLoop, analyzeAllLoops } = require('./hvac-control-logic');

const SMARTTHINGS_API_BASE = 'https://api.smartthings.com/v1';
const TOKEN = process.env.SMARTTHINGS_TOKEN;
const DATA_FILE = path.join(__dirname, '../data/temperature-readings.json');
const CONTROL_LOG_FILE = path.join(__dirname, '../data/hvac-control-log.json');

// Device configuration (matches poll-thermostat.js)
const DEVICES = [
  { id: '8021826e-78ca-4f3d-bd33-bdac1cadd3f2', location: 'NBs Office' },
  { id: '8051fd90-ab24-467c-8746-3dadbce02252', location: 'Basement' },
  { id: '87f9fbe2-f6b7-4877-9486-01b896a0acb5', location: 'Denn' },
  { id: '999d0c8c-2caa-4ea6-a7ef-f8d73d1a5147', location: 'Front Hall' },
  { id: 'c44c9f12-1029-43c0-af5f-a5ff572d37c7', location: 'Jrs Office' },
  { id: '8f5a0b61-76de-4add-bcb7-9cb5e7e8d3bd', location: 'Kids Bedroom' },
  { id: 'dd6b54be-a667-4acc-a112-d89c9923c29d', location: 'Main Kitchen' },
  { id: '9ced4ff7-4376-47c8-b882-5724bfb14306', location: 'Primary Bedroom' }
];

/**
 * Execute a command on a SmartThings device
 */
async function executeDeviceCommand(deviceId, commands) {
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
}

/**
 * Set thermostat mode
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
 * Load temperature readings
 */
async function loadReadings() {
  try {
    const data = await fs.readFile(DATA_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    throw new Error(`Failed to load readings: ${error.message}`);
  }
}

/**
 * Load control log
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
 * Execute control actions
 */
async function executeActions(actions, loopName) {
  const results = [];

  if (actions.length === 0) {
    console.log(`   ✅ No actions needed for ${loopName}`);
    return { success: true, actionsExecuted: 0, results: [] };
  }

  console.log(`   ⚡ Executing ${actions.length} action(s) for ${loopName}...`);

  for (const action of actions) {
    try {
      console.log(`\n   → ${action.zoneName}`);
      console.log(`     Current: ${action.currentMode} → New: ${action.newMode}`);
      console.log(`     Reason: ${action.reason}`);
      console.log(`     Priority: ${action.priority}`);

      const result = await setThermostatMode(action.deviceId, action.newMode);

      console.log(`     ✅ Success`);

      results.push({
        ...action,
        success: true,
        result,
        executedAt: new Date().toISOString()
      });

      // Small delay between commands
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
  console.log(`\n   📊 Completed: ${successCount}/${actions.length} actions successful`);

  return {
    success: successCount === actions.length,
    actionsExecuted: successCount,
    results
  };
}

/**
 * Main rebalance function
 */
async function rebalance(loopId) {
  try {
    if (!TOKEN) {
      console.error('❌ SMARTTHINGS_TOKEN environment variable not set');
      process.exit(1);
    }

    console.log('🎛️  HVAC Loop Rebalance');
    console.log('═══════════════════════════════════════════════════');

    // Load current readings
    console.log('\n📊 Loading current readings...');
    const data = await loadReadings();

    // Prepare device data
    const devicesData = {};
    for (const deviceConfig of DEVICES) {
      const deviceData = data.devices[deviceConfig.id];
      if (deviceData && deviceData.readings.length > 0) {
        const latestReading = deviceData.readings[deviceData.readings.length - 1];
        devicesData[deviceConfig.location] = latestReading;
      }
    }

    console.log(`   Found data for ${Object.keys(devicesData).length} devices`);

    // Analyze loops
    let analysis;
    let executionResults;

    if (loopId) {
      // Single loop rebalance
      const loopNum = parseInt(loopId);
      if (loopNum !== 1 && loopNum !== 2) {
        console.error(`❌ Invalid loop ID: ${loopId}. Must be 1 or 2.`);
        process.exit(1);
      }

      console.log(`\n🔍 Analyzing Loop ${loopNum}...`);
      const loopAnalysis = analyzeLoop(loopNum, devicesData);

      console.log(`\n📍 ${loopAnalysis.loopName}`);
      console.log(`   Recommended mode: ${loopAnalysis.decision.recommendedMode}`);
      console.log(`   ${loopAnalysis.decision.reason}`);
      console.log(`   Priority: ${loopAnalysis.decision.priority}`);

      executionResults = await executeActions(loopAnalysis.actions, loopAnalysis.loopName);

      // Create analysis object for logging
      analysis = {
        timestamp: new Date().toISOString(),
        loop1: loopNum === 1 ? loopAnalysis : null,
        loop2: loopNum === 2 ? loopAnalysis : null,
        allActions: loopAnalysis.actions.map(a => ({ ...a, loop: loopNum })),
        summary: {
          totalActions: loopAnalysis.actions.length,
          highPriority: loopAnalysis.actions.filter(a => a.priority === 'high').length,
          loop1Mode: loopNum === 1 ? loopAnalysis.decision.recommendedMode : null,
          loop2Mode: loopNum === 2 ? loopAnalysis.decision.recommendedMode : null
        }
      };

    } else {
      // Full analysis of both loops
      console.log('\n🔍 Analyzing all loops...');
      analysis = analyzeAllLoops(devicesData);

      console.log(`\n📍 ${analysis.loop1.loopName}`);
      console.log(`   Recommended mode: ${analysis.loop1.decision.recommendedMode}`);
      console.log(`   ${analysis.loop1.decision.reason}`);
      console.log(`   Priority: ${analysis.loop1.decision.priority}`);

      console.log(`\n📍 ${analysis.loop2.loopName}`);
      console.log(`   Recommended mode: ${analysis.loop2.decision.recommendedMode}`);
      console.log(`   ${analysis.loop2.decision.reason}`);
      console.log(`   Priority: ${analysis.loop2.decision.priority}`);

      // Execute all actions
      executionResults = await executeActions(analysis.allActions, 'both loops');
    }

    // Save to control log
    const logEntry = {
      timestamp: new Date().toISOString(),
      trigger: 'manual',
      loopId: loopId || 'all',
      analysis: {
        loop1: analysis.loop1 ? {
          mode: analysis.loop1.decision.recommendedMode,
          reason: analysis.loop1.decision.reason,
          priority: analysis.loop1.decision.priority
        } : null,
        loop2: analysis.loop2 ? {
          mode: analysis.loop2.decision.recommendedMode,
          reason: analysis.loop2.decision.reason,
          priority: analysis.loop2.decision.priority
        } : null
      },
      actionsPlanned: analysis.allActions.length,
      actionsExecuted: executionResults.actionsExecuted,
      results: executionResults.results
    };

    await saveControlLog(logEntry);

    console.log('\n═══════════════════════════════════════════════════');
    console.log('✅ Rebalance complete');
    console.log('═══════════════════════════════════════════════════');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Parse command line arguments
const loopId = process.argv[2];

// Run rebalance
rebalance(loopId);
