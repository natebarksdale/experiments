// Cloudflare Worker - SmartThings SmartApp Webhook Handler
// Handles real-time temperature updates from SmartThings devices

export default {
  async fetch(request, env, ctx) {
    console.log('🚀 Worker received request:', request.method, request.url);

    const url = new URL(request.url);
    const path = url.pathname;

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return handleCORS();
    }

    // Handle GET requests for temperature data
    if (request.method === 'GET') {
      return handleGetRequest(path, env);
    }

    // Handle POST requests from SmartThings
    if (request.method === 'POST') {
      return handleSmartThingsWebhook(request, env);
    }

    return new Response('Method not allowed', { status: 405 });
  }
};

/**
 * Handle GET requests for temperature data
 */
async function handleGetRequest(path, env) {
  const origin = '*'; // You can restrict this to specific origins

  // Get all current temperatures
  if (path === '/temperatures') {
    if (!env.SMARTAPP_STORAGE) {
      return new Response(JSON.stringify({
        error: 'Storage not configured'
      }), {
        status: 500,
        headers: corsHeaders(origin)
      });
    }

    try {
      // List all temperature readings
      const list = await env.SMARTAPP_STORAGE.list({ prefix: 'temp:' });
      const temperatures = {};

      for (const key of list.keys) {
        const data = await env.SMARTAPP_STORAGE.get(key.name, 'json');
        if (data) {
          const deviceId = key.name.replace('temp:', '');
          temperatures[deviceId] = data;
        }
      }

      return new Response(JSON.stringify(temperatures), {
        status: 200,
        headers: corsHeaders(origin)
      });
    } catch (error) {
      console.error('Error fetching temperatures:', error);
      return new Response(JSON.stringify({
        error: 'Failed to fetch temperatures',
        message: error.message
      }), {
        status: 500,
        headers: corsHeaders(origin)
      });
    }
  }

  // Get temperature for specific device
  const deviceMatch = path.match(/^\/temperature\/(.+)$/);
  if (deviceMatch) {
    const deviceId = deviceMatch[1];

    if (!env.SMARTAPP_STORAGE) {
      return new Response(JSON.stringify({
        error: 'Storage not configured'
      }), {
        status: 500,
        headers: corsHeaders(origin)
      });
    }

    try {
      const data = await env.SMARTAPP_STORAGE.get(`temp:${deviceId}`, 'json');

      if (!data) {
        return new Response(JSON.stringify({
          error: 'Device not found'
        }), {
          status: 404,
          headers: corsHeaders(origin)
        });
      }

      return new Response(JSON.stringify(data), {
        status: 200,
        headers: corsHeaders(origin)
      });
    } catch (error) {
      console.error('Error fetching temperature:', error);
      return new Response(JSON.stringify({
        error: 'Failed to fetch temperature',
        message: error.message
      }), {
        status: 500,
        headers: corsHeaders(origin)
      });
    }
  }

  // Get temperature history for specific device
  const historyMatch = path.match(/^\/history\/(.+)$/);
  if (historyMatch) {
    const deviceId = historyMatch[1];

    if (!env.SMARTAPP_STORAGE) {
      return new Response(JSON.stringify({
        error: 'Storage not configured'
      }), {
        status: 500,
        headers: corsHeaders(origin)
      });
    }

    try {
      const history = await env.SMARTAPP_STORAGE.get(`history:${deviceId}`, 'json') || [];

      return new Response(JSON.stringify(history), {
        status: 200,
        headers: corsHeaders(origin)
      });
    } catch (error) {
      console.error('Error fetching history:', error);
      return new Response(JSON.stringify({
        error: 'Failed to fetch history',
        message: error.message
      }), {
        status: 500,
        headers: corsHeaders(origin)
      });
    }
  }

  return new Response(JSON.stringify({
    error: 'Not found',
    endpoints: [
      'GET /temperatures - Get all current temperatures',
      'GET /temperature/{deviceId} - Get temperature for specific device',
      'GET /history/{deviceId} - Get temperature history for specific device',
      'POST / - SmartThings webhook endpoint'
    ]
  }), {
    status: 404,
    headers: corsHeaders(origin)
  });
}

/**
 * Handle POST requests from SmartThings webhook
 */
async function handleSmartThingsWebhook(request, env) {
  try {
    const body = await request.json();
    const lifecycle = body.lifecycle;

    console.log(`Received ${lifecycle} lifecycle event`);

    // Route to appropriate lifecycle handler
    switch (lifecycle) {
      case 'PING':
        return handlePing(body);
      case 'CONFIRMATION':
        return handleConfirmation(body, env);
      case 'CONFIGURATION':
        return handleConfiguration(body, env);
      case 'INSTALL':
        return handleInstall(body, env);
      case 'UPDATE':
        return handleUpdate(body, env);
      case 'EVENT':
        return handleEvent(body, env);
      case 'UNINSTALL':
        return handleUninstall(body, env);
      default:
        console.error(`Unknown lifecycle: ${lifecycle}`);
        return new Response(JSON.stringify({
          statusCode: 400,
          message: `Unknown lifecycle: ${lifecycle}`
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
    }
  } catch (error) {
    console.error('Error handling request:', error);
    return new Response(JSON.stringify({
      statusCode: 500,
      message: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * PING - Legacy verification (deprecated but still used)
 * Respond with challenge to verify webhook ownership
 */
function handlePing(body) {
  console.log('Handling PING event');

  return new Response(JSON.stringify({
    pingData: {
      challenge: body.pingData?.challenge
    }
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * CONFIRMATION - Verify webhook URL ownership
 * This is the modern replacement for PING
 */
function handleConfirmation(body, env) {
  console.log('Handling CONFIRMATION event');

  const confirmationUrl = body.confirmationData?.confirmationUrl;

  if (!confirmationUrl) {
    return new Response(JSON.stringify({
      statusCode: 400,
      message: 'Missing confirmation URL'
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // In a production app, you would verify the confirmation URL
  // by making a GET request to it. For now, we'll just acknowledge it.
  console.log('Confirmation URL:', confirmationUrl);

  return new Response(JSON.stringify({
    statusCode: 200
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * CONFIGURATION - Define the SmartApp configuration UI
 * This tells SmartThings what devices the user can select
 */
function handleConfiguration(body, env) {
  console.log('Handling CONFIGURATION event');

  const phase = body.configurationData?.phase;

  // INITIALIZE phase - Define the configuration page
  if (phase === 'INITIALIZE') {
    return new Response(JSON.stringify({
      configurationData: {
        initialize: {
          name: 'HVAC Temperature Monitor',
          description: 'Monitor HVAC temperature sensors in real-time',
          id: 'hvac-temp-monitor',
          permissions: [
            'r:devices:*'
          ],
          firstPageId: 'selectDevices'
        }
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // PAGE phase - Define the device selection page
  if (phase === 'PAGE') {
    const pageId = body.configurationData?.pageId;

    if (pageId === 'selectDevices') {
      return new Response(JSON.stringify({
        configurationData: {
          page: {
            pageId: 'selectDevices',
            name: 'Select Temperature Sensors',
            nextPageId: null,
            previousPageId: null,
            complete: true,
            sections: [
              {
                name: 'Select your HVAC temperature sensors',
                settings: [
                  {
                    id: 'tempSensors',
                    name: 'Temperature Sensors',
                    description: 'Select all temperature sensors to monitor',
                    type: 'DEVICE',
                    required: true,
                    multiple: true,
                    capabilities: ['temperatureMeasurement'],
                    permissions: ['r']
                  }
                ]
              }
            ]
          }
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // Default response
  return new Response(JSON.stringify({
    statusCode: 200
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * INSTALL - Set up subscriptions when SmartApp is installed
 * Subscribe to temperature events from selected devices
 */
async function handleInstall(body, env) {
  console.log('Handling INSTALL event');

  const installData = body.installData;
  const authToken = installData?.authToken;
  const refreshToken = installData?.refreshToken;
  const installedAppId = installData?.installedApp?.installedAppId;
  const config = installData?.installedApp?.config;

  // Store installation data in KV storage
  if (env.SMARTAPP_STORAGE && installedAppId) {
    await env.SMARTAPP_STORAGE.put(`install:${installedAppId}`, JSON.stringify({
      authToken,
      refreshToken,
      config,
      installedAt: new Date().toISOString()
    }));
    console.log(`Stored installation data for ${installedAppId}`);
  }

  // Subscribe to temperature events
  const devices = config?.tempSensors || [];
  const subscriptions = [];

  for (const device of devices) {
    subscriptions.push({
      sourceType: 'DEVICE',
      device: {
        deviceId: device.deviceConfig.deviceId,
        componentId: 'main',
        capability: 'temperatureMeasurement',
        attribute: 'temperature',
        stateChangeOnly: true
      }
    });
  }

  console.log(`Creating ${subscriptions.length} temperature subscriptions`);

  return new Response(JSON.stringify({
    installData: {
      subscriptions
    }
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * UPDATE - Handle configuration updates
 * Update subscriptions when user changes device selection
 */
async function handleUpdate(body, env) {
  console.log('Handling UPDATE event');

  const updateData = body.updateData;
  const authToken = updateData?.authToken;
  const refreshToken = updateData?.refreshToken;
  const installedAppId = updateData?.installedApp?.installedAppId;
  const config = updateData?.installedApp?.config;

  // Update installation data in KV storage
  if (env.SMARTAPP_STORAGE && installedAppId) {
    await env.SMARTAPP_STORAGE.put(`install:${installedAppId}`, JSON.stringify({
      authToken,
      refreshToken,
      config,
      updatedAt: new Date().toISOString()
    }));
    console.log(`Updated installation data for ${installedAppId}`);
  }

  // Update subscriptions
  const devices = config?.tempSensors || [];
  const subscriptions = [];

  for (const device of devices) {
    subscriptions.push({
      sourceType: 'DEVICE',
      device: {
        deviceId: device.deviceConfig.deviceId,
        componentId: 'main',
        capability: 'temperatureMeasurement',
        attribute: 'temperature',
        stateChangeOnly: true
      }
    });
  }

  console.log(`Updating to ${subscriptions.length} temperature subscriptions`);

  return new Response(JSON.stringify({
    updateData: {
      subscriptions
    }
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * EVENT - Process device events (temperature changes)
 * This is where the real-time temperature updates are received
 */
async function handleEvent(body, env) {
  console.log('Handling EVENT');

  const eventData = body.eventData;
  const installedAppId = eventData?.installedApp?.installedAppId;
  const events = eventData?.events || [];

  console.log(`Processing ${events.length} events for app ${installedAppId}`);

  // Process each temperature event
  for (const event of events) {
    if (event.eventType === 'DEVICE_EVENT') {
      const deviceEvent = event.deviceEvent;
      const deviceId = deviceEvent?.deviceId;
      const componentId = deviceEvent?.componentId;
      const capability = deviceEvent?.capability;
      const attribute = deviceEvent?.attribute;
      const value = deviceEvent?.value;
      const unit = deviceEvent?.unit;

      if (capability === 'temperatureMeasurement' && attribute === 'temperature') {
        console.log(`Temperature update: Device ${deviceId} = ${value}${unit}`);

        // Store temperature reading in KV storage
        if (env.SMARTAPP_STORAGE) {
          const timestamp = new Date().toISOString();
          const reading = {
            deviceId,
            componentId,
            temperature: value,
            unit,
            timestamp
          };

          // Store latest reading
          await env.SMARTAPP_STORAGE.put(
            `temp:${deviceId}`,
            JSON.stringify(reading)
          );

          // Also append to history (limited to last 100 readings per device)
          const historyKey = `history:${deviceId}`;
          const existingHistory = await env.SMARTAPP_STORAGE.get(historyKey, 'json') || [];
          existingHistory.unshift(reading);

          // Keep only last 100 readings
          if (existingHistory.length > 100) {
            existingHistory.length = 100;
          }

          await env.SMARTAPP_STORAGE.put(historyKey, JSON.stringify(existingHistory));

          console.log(`Stored temperature reading for device ${deviceId}`);
        }

        // Optional: Update Google Sheets if configured
        if (env.GOOGLE_SHEETS_WEBHOOK_URL) {
          try {
            await fetch(env.GOOGLE_SHEETS_WEBHOOK_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                deviceId,
                temperature: value,
                unit,
                timestamp: new Date().toISOString()
              })
            });
            console.log('Updated Google Sheets');
          } catch (error) {
            console.error('Failed to update Google Sheets:', error);
          }
        }
      }
    }
  }

  return new Response(JSON.stringify({
    statusCode: 200
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * UNINSTALL - Clean up when SmartApp is uninstalled
 */
async function handleUninstall(body, env) {
  console.log('Handling UNINSTALL event');

  const uninstallData = body.uninstallData;
  const installedAppId = uninstallData?.installedApp?.installedAppId;

  // Remove installation data from KV storage
  if (env.SMARTAPP_STORAGE && installedAppId) {
    await env.SMARTAPP_STORAGE.delete(`install:${installedAppId}`);
    console.log(`Removed installation data for ${installedAppId}`);
  }

  return new Response(JSON.stringify({
    statusCode: 200
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * CORS headers helper
 */
function corsHeaders(origin) {
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400'
  };
}

/**
 * Handle CORS preflight
 */
function handleCORS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    }
  });
}
