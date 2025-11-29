#!/usr/bin/env node

/**
 * Test if the SmartApp authToken has execute permissions
 * This script fetches the authToken from the worker and tests device command execution
 */

const https = require('https');

const WORKER_URL = process.env.WORKER_URL || 'https://smartthings-hvac-webhook.natebarksdale.workers.dev';

/**
 * Fetch installation data from worker
 */
async function fetchInstallData() {
  return new Promise((resolve, reject) => {
    https.get(`${WORKER_URL}/debug-install`, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 404) {
          console.log('❌ No /debug-install endpoint. Creating one...');
          reject(new Error('Need to add debug endpoint'));
          return;
        }
        try {
          resolve(JSON.parse(data));
        } catch (error) {
          reject(new Error(`Failed to parse response: ${error.message}`));
        }
      });
    }).on('error', reject);
  });
}

/**
 * Test device command with authToken
 */
async function testDeviceCommand(deviceId, authToken) {
  return new Promise((resolve, reject) => {
    const command = {
      commands: [{
        component: 'main',
        capability: 'thermostatMode',
        command: 'setThermostatMode',
        arguments: ['off']
      }]
    };

    const postData = JSON.stringify(command);
    const options = {
      hostname: 'api.smartthings.com',
      port: 443,
      path: `/v1/devices/${deviceId}/commands`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          body: data,
          success: res.statusCode >= 200 && res.statusCode < 300
        });
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function main() {
  console.log('\n🔍 SmartApp AuthToken Diagnostic Tool\n');
  console.log(`Worker URL: ${WORKER_URL}\n`);

  try {
    // Get installation data
    console.log('📡 Fetching installation data from worker...');
    const installData = await fetchInstallData();

    if (!installData.authToken) {
      console.log('❌ No authToken found in worker KV storage');
      console.log('   Solution: Reinstall the SmartApp in SmartThings\n');
      return;
    }

    console.log('✓ Found authToken:', installData.authToken.substring(0, 20) + '...\n');

    // Test with a device
    if (installData.devices && installData.devices.length > 0) {
      const deviceId = installData.devices[0];
      console.log(`🧪 Testing command execution on device: ${deviceId}`);

      const result = await testDeviceCommand(deviceId, installData.authToken);

      console.log(`\nResult: HTTP ${result.statusCode}`);
      console.log('Response:', result.body.substring(0, 200));

      if (result.success) {
        console.log('\n✅ SUCCESS! AuthToken has execute permissions.\n');
      } else if (result.statusCode === 401) {
        console.log('\n❌ FAILED! AuthToken does NOT have execute permissions.');
        console.log('   The token was created with old permissions.\n');
        console.log('   Solution:');
        console.log('   1. Open SmartThings mobile app');
        console.log('   2. Go to Menu → SmartApps → HVAC Monitor Worker');
        console.log('   3. Tap settings/gear icon');
        console.log('   4. Re-save the configuration (this gets a new token)\n');
      } else {
        console.log(`\n⚠️  Unexpected response: ${result.statusCode}\n`);
      }
    } else {
      console.log('⚠️  No devices found in installation data\n');
    }

  } catch (error) {
    console.error(`\n❌ Error: ${error.message}\n`);

    if (error.message.includes('debug endpoint')) {
      console.log('Creating a debug endpoint in the worker would help diagnose this.');
      console.log('For now, check the worker logs or KV storage directly.\n');
    }
  }
}

main().catch(console.error);
