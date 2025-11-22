#!/usr/bin/env node

/**
 * SmartThings Device Discovery Script
 * Lists all devices in your SmartThings account and their capabilities
 * Helps map devices to the current webhook-based configuration
 */

const SMARTTHINGS_API_BASE = 'https://api.smartthings.com/v1';
const TOKEN = process.env.SMARTTHINGS_TOKEN;

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
    const errorText = await response.text();
    throw new Error(`SmartThings API error: ${response.status} ${response.statusText}\n${errorText}`);
  }

  return response.json();
}

/**
 * Get all devices from SmartThings
 */
async function getAllDevices() {
  const data = await smartthingsRequest('/devices');
  return data.items || [];
}

/**
 * Get detailed device information including status
 */
async function getDeviceDetails(deviceId) {
  const [device, status] = await Promise.all([
    smartthingsRequest(`/devices/${deviceId}`),
    smartthingsRequest(`/devices/${deviceId}/status`)
  ]);

  return { device, status };
}

/**
 * Categorize devices by their capabilities
 */
function categorizeDevice(device) {
  const capabilities = device.components?.[0]?.capabilities?.map(c => c.id) || [];

  const categories = [];

  if (capabilities.includes('switch')) {
    categories.push('switch');
  }
  if (capabilities.includes('switchLevel')) {
    categories.push('dimmer');
  }
  if (capabilities.includes('lock')) {
    categories.push('lock');
  }
  if (capabilities.includes('thermostatMode')) {
    categories.push('thermostat');
  }
  if (capabilities.includes('temperatureMeasurement')) {
    categories.push('temperature');
  }
  if (capabilities.includes('contactSensor')) {
    categories.push('contact');
  }
  if (capabilities.includes('motionSensor')) {
    categories.push('motion');
  }
  if (capabilities.includes('garageDoorControl')) {
    categories.push('garageDoor');
  }

  return categories.length > 0 ? categories : ['other'];
}

/**
 * Main discovery function
 */
async function discoverDevices() {
  if (!TOKEN) {
    console.error('Error: SMARTTHINGS_TOKEN environment variable is not set');
    process.exit(1);
  }

  console.log('Discovering SmartThings devices...\n');

  try {
    const devices = await getAllDevices();

    console.log(`Found ${devices.length} devices\n`);
    console.log('='.repeat(80));

    // Group devices by category
    const devicesByCategory = {
      switch: [],
      dimmer: [],
      lock: [],
      thermostat: [],
      garageDoor: [],
      temperature: [],
      contact: [],
      motion: [],
      other: []
    };

    for (const device of devices) {
      const categories = categorizeDevice(device);
      const primaryCategory = categories[0];

      const info = {
        id: device.deviceId,
        name: device.label || device.name,
        type: device.type,
        categories: categories,
        capabilities: device.components?.[0]?.capabilities?.map(c => c.id) || [],
        manufacturer: device.manufacturerName,
        model: device.presentationId
      };

      devicesByCategory[primaryCategory].push(info);
    }

    // Print devices by category
    const categoryNames = {
      switch: 'SWITCHES (Lights & Plugs)',
      dimmer: 'DIMMERS',
      lock: 'LOCKS',
      thermostat: 'THERMOSTATS',
      garageDoor: 'GARAGE DOORS',
      temperature: 'TEMPERATURE SENSORS',
      contact: 'CONTACT SENSORS',
      motion: 'MOTION SENSORS',
      other: 'OTHER DEVICES'
    };

    for (const [category, categoryDevices] of Object.entries(devicesByCategory)) {
      if (categoryDevices.length === 0) continue;

      console.log(`\n${categoryNames[category]}`);
      console.log('-'.repeat(80));

      for (const device of categoryDevices) {
        console.log(`\nName: ${device.name}`);
        console.log(`  ID: ${device.id}`);
        console.log(`  Type: ${device.type}`);
        console.log(`  Categories: ${device.categories.join(', ')}`);
        console.log(`  Manufacturer: ${device.manufacturer || 'Unknown'}`);

        // Show key capabilities
        const keyCaps = device.capabilities.filter(c =>
          !c.startsWith('health') &&
          !c.startsWith('execute') &&
          c !== 'refresh'
        );
        if (keyCaps.length > 0) {
          console.log(`  Capabilities: ${keyCaps.join(', ')}`);
        }
      }
    }

    // Print summary for easy mapping
    console.log('\n' + '='.repeat(80));
    console.log('\nSUMMARY FOR CONFIGURATION');
    console.log('='.repeat(80));

    // Switches (lights and plugs)
    if (devicesByCategory.switch.length > 0 || devicesByCategory.dimmer.length > 0) {
      console.log('\n// SWITCHES & LIGHTS');
      [...devicesByCategory.switch, ...devicesByCategory.dimmer].forEach(device => {
        console.log(`// ${device.name}`);
        console.log(`'${device.id}': { name: '${device.name}', type: 'switch' },`);
      });
    }

    // Locks
    if (devicesByCategory.lock.length > 0) {
      console.log('\n// LOCKS');
      devicesByCategory.lock.forEach(device => {
        console.log(`// ${device.name}`);
        console.log(`'${device.id}': { name: '${device.name}', type: 'lock' },`);
      });
    }

    // Garage Doors
    if (devicesByCategory.garageDoor.length > 0) {
      console.log('\n// GARAGE DOORS');
      devicesByCategory.garageDoor.forEach(device => {
        console.log(`// ${device.name}`);
        console.log(`'${device.id}': { name: '${device.name}', type: 'garageDoor' },`);
      });
    }

    console.log('\n' + '='.repeat(80));

  } catch (error) {
    console.error('Error discovering devices:', error);
    process.exit(1);
  }
}

// Run the discovery
discoverDevices();
