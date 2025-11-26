#!/usr/bin/env node

/**
 * SmartThings HVAC Rebalancing Command Executor
 *
 * This script polls the Cloudflare Worker KV storage for rebalancing commands
 * and executes them via the SmartThings API using a Personal Access Token (PAT).
 *
 * Setup:
 * 1. Create a SmartThings Personal Access Token:
 *    https://account.smartthings.com/tokens
 *    Required scopes: r:devices:*, x:devices:*
 *
 * 2. Set environment variable:
 *    export SMARTTHINGS_PAT="your-personal-access-token"
 *
 * 3. Set the worker URL:
 *    export WORKER_URL="https://your-worker.workers.dev"
 *
 * Usage:
 *    node execute-rebalance-commands.js
 *
 * For periodic execution, use cron:
 *    */15 * * * * /usr/bin/node /path/to/execute-rebalance-commands.js >> /var/log/hvac-rebalance.log 2>&1
 */

const https = require('https');

// Configuration
const SMARTTHINGS_PAT = process.env.SMARTTHINGS_PAT;
const WORKER_URL = process.env.WORKER_URL || 'https://your-worker.workers.dev';
const SMARTTHINGS_API_BASE = 'https://api.smartthings.com/v1';

// Validate configuration
if (!SMARTTHINGS_PAT) {
  console.error('❌ Error: SMARTTHINGS_PAT environment variable not set');
  console.error('Create a token at: https://account.smartthings.com/tokens');
  process.exit(1);
}

if (WORKER_URL.includes('your-worker')) {
  console.error('❌ Error: WORKER_URL environment variable not set correctly');
  console.error('Set it to your Cloudflare Worker URL');
  process.exit(1);
}

/**
 * Fetch rebalancing commands from Cloudflare Worker
 */
async function fetchCommands() {
  return new Promise((resolve, reject) => {
    const url = new URL(`${WORKER_URL}/rebalance-commands`);

    https.get(url, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve(result);
        } catch (error) {
          reject(new Error(`Failed to parse response: ${error.message}`));
        }
      });
    }).on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Execute a single device command via SmartThings API
 */
async function executeDeviceCommand(deviceId, action, value) {
  return new Promise((resolve, reject) => {
    const command = buildSmartThingsCommand(action, value);
    const postData = JSON.stringify({ commands: [command] });

    const options = {
      hostname: 'api.smartthings.com',
      port: 443,
      path: `/v1/devices/${deviceId}/commands`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SMARTTHINGS_PAT}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log(`  ✓ Command executed successfully`);
          resolve({ success: true, statusCode: res.statusCode, data });
        } else {
          console.error(`  ✗ Command failed with status ${res.statusCode}: ${data}`);
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(postData);
    req.end();
  });
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
 * Mark commands as executed in KV storage
 */
async function markCommandsExecuted() {
  // Note: This would require a POST endpoint in the worker to update the executed flag
  // For now, we'll just log that commands were executed
  console.log('ℹ️  Commands have been executed. Consider adding a POST endpoint to mark as executed in KV.');
}

/**
 * Main execution function
 */
async function main() {
  console.log(`\n🔄 SmartThings HVAC Rebalancing Command Executor`);
  console.log(`   Time: ${new Date().toISOString()}`);
  console.log(`   Worker: ${WORKER_URL}\n`);

  try {
    // Fetch commands from worker
    console.log('📡 Fetching commands from Cloudflare Worker...');
    const commandData = await fetchCommands();

    if (!commandData.commands || commandData.commands.length === 0) {
      console.log('✓ No pending commands to execute\n');
      return;
    }

    if (commandData.executed) {
      console.log('ℹ️  Commands have already been executed\n');
      return;
    }

    console.log(`📋 Found ${commandData.commands.length} commands to execute:`);
    console.log(`   Analysis: ${commandData.analysis?.summary || 'N/A'}`);
    console.log(`   Timestamp: ${commandData.timestamp}\n`);

    // Execute each command
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < commandData.commands.length; i++) {
      const cmd = commandData.commands[i];
      console.log(`[${i + 1}/${commandData.commands.length}] Executing: ${cmd.action} on device ${cmd.deviceId}`);
      console.log(`   Reason: ${cmd.reason}`);

      try {
        await executeDeviceCommand(cmd.deviceId, cmd.action, cmd.value);
        successCount++;
      } catch (error) {
        console.error(`   Error: ${error.message}`);
        failCount++;
      }
    }

    console.log(`\n✅ Execution complete:`);
    console.log(`   Successful: ${successCount}`);
    console.log(`   Failed: ${failCount}`);
    console.log();

  } catch (error) {
    console.error(`\n❌ Fatal error: ${error.message}\n`);
    process.exit(1);
  }
}

// Run the script
main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
