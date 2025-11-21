#!/usr/bin/env node

/**
 * SmartThings Token Diagnostic Script
 * Tests if your Personal Access Token has the correct permissions
 */

const TOKEN = process.env.SMARTTHINGS_TOKEN;
const SMARTTHINGS_API_BASE = 'https://api.smartthings.com/v1';

async function testEndpoint(name, endpoint) {
  console.log(`\n🔍 Testing: ${name}`);
  console.log(`   Endpoint: ${endpoint}`);

  try {
    const response = await fetch(`${SMARTTHINGS_API_BASE}${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Accept': 'application/json'
      }
    });

    console.log(`   Status: ${response.status} ${response.statusText}`);

    if (response.ok) {
      const data = await response.json();
      console.log(`   ✅ Success!`);

      // Show summary of results
      if (data.items) {
        console.log(`   Found ${data.items.length} items`);
        if (data.items.length > 0) {
          console.log(`   First item:`, JSON.stringify(data.items[0], null, 2).split('\n').slice(0, 10).join('\n'));
        }
      } else {
        console.log(`   Data:`, JSON.stringify(data, null, 2).split('\n').slice(0, 10).join('\n'));
      }

      return { success: true, data };
    } else {
      const text = await response.text();
      console.log(`   ❌ Failed: ${text}`);
      return { success: false, error: text, status: response.status };
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function diagnose() {
  console.log('═══════════════════════════════════════════════════');
  console.log('🔧 SmartThings Token Diagnostic Tool');
  console.log('═══════════════════════════════════════════════════');

  if (!TOKEN) {
    console.error('\n❌ SMARTTHINGS_TOKEN environment variable not set');
    console.error('\nUsage:');
    console.error('  export SMARTTHINGS_TOKEN="your-token-here"');
    console.error('  node test-token.js');
    process.exit(1);
  }

  console.log(`\n✓ Token found (${TOKEN.substring(0, 8)}...${TOKEN.substring(TOKEN.length - 4)})`);

  // Test various endpoints
  const tests = [
    { name: 'List Locations', endpoint: '/locations' },
    { name: 'List Devices', endpoint: '/devices' },
  ];

  const results = {};

  for (const test of tests) {
    results[test.name] = await testEndpoint(test.name, test.endpoint);
  }

  // If devices test succeeds, try to get the specific device
  if (results['List Devices']?.success) {
    const devices = results['List Devices'].data.items || [];

    if (devices.length > 0) {
      console.log('\n📱 Found devices:');
      devices.forEach((device, i) => {
        console.log(`   ${i + 1}. ${device.label || device.name} (${device.deviceId})`);
        console.log(`      Type: ${device.type || 'N/A'}`);
      });

      // Test getting status of the first device
      const firstDevice = devices[0];
      await testEndpoint(
        'Get Device Status',
        `/devices/${firstDevice.deviceId}/status`
      );
    }
  }

  // Summary
  console.log('\n═══════════════════════════════════════════════════');
  console.log('📊 Summary');
  console.log('═══════════════════════════════════════════════════');

  let allPassed = true;
  for (const [name, result] of Object.entries(results)) {
    const status = result.success ? '✅' : '❌';
    console.log(`${status} ${name}`);
    if (!result.success) allPassed = false;
  }

  if (allPassed) {
    console.log('\n🎉 All tests passed! Your token is configured correctly.');
  } else {
    console.log('\n⚠️  Some tests failed. Please check your token permissions.');
    console.log('\nRequired permissions:');
    console.log('  • List all devices (r:devices:*)');
    console.log('  • See device status (r:devices:*:status)');
    console.log('\nTo fix:');
    console.log('  1. Go to https://account.smartthings.com/tokens');
    console.log('  2. Delete the old token');
    console.log('  3. Create a new token with these permissions:');
    console.log('     - r:devices:* (Read Devices)');
    console.log('     - r:locations:* (Read Locations) [optional but recommended]');
    process.exit(1);
  }
}

// Run diagnostics
diagnose();
