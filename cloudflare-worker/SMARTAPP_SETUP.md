# SmartThings SmartApp Setup with Cloudflare Workers

This guide will help you deploy a SmartApp that receives real-time temperature updates from SmartThings via webhooks.

## Why Use a SmartApp?

**The Problem**: Polling SmartThings API for temperature updates wastes API calls and has latency (5-15 seconds typical).

**The Solution**: A SmartApp uses webhooks to receive instant push notifications when temperatures change, providing:
- ✅ Real-time updates (< 1 second latency)
- ✅ Reduced API calls (push vs poll)
- ✅ Lower cost (fewer requests)
- ✅ Better battery life for devices

## Architecture

```
SmartThings Device → SmartThings Cloud → Webhook (Cloudflare Worker) → KV Storage
                                                                      → Your Frontend App
```

1. Temperature sensor detects change
2. SmartThings pushes event to your webhook
3. Worker stores reading in KV storage
4. Frontend fetches latest data from worker

## Prerequisites

1. A Cloudflare account (free tier is sufficient)
2. Node.js installed locally
3. Wrangler CLI: `npm install -g wrangler`
4. A SmartThings account with temperature sensors

## Step 1: Login to Cloudflare

```bash
wrangler login
```

This will open a browser window for authentication.

## Step 2: Get Your Account ID

1. Go to https://dash.cloudflare.com/
2. Click on "Workers & Pages" in the left sidebar
3. Your Account ID is shown in the right panel
4. Copy this ID

## Step 3: Configure Wrangler

Edit `wrangler-smartapp.toml` and add your account ID:

```toml
account_id = "your-account-id-here"
```

## Step 4: Create KV Namespace

The worker uses Cloudflare KV (key-value storage) to store temperature readings and installation data.

```bash
cd cloudflare-worker
wrangler kv:namespace create "SMARTAPP_STORAGE" --config wrangler-smartapp.toml
```

You'll see output like:

```
 ⛅️ wrangler 3.x.x
--------------------
🌀 Creating namespace with title "hvac-monitor-SMARTAPP_STORAGE"
✨ Success!
Add the following to your configuration file in your kv_namespaces array:
{ binding = "SMARTAPP_STORAGE", id = "abcdef1234567890" }
```

Copy the `id` value and edit `wrangler-smartapp.toml`:

```toml
[[kv_namespaces]]
binding = "SMARTAPP_STORAGE"
id = "abcdef1234567890"  # Replace with your actual ID
```

## Step 5: Deploy the Worker

```bash
wrangler deploy --config wrangler-smartapp.toml
```

After deployment, you'll see output like:

```
Published hvac-monitor (X.XX sec)
  https://hvac-monitor.your-subdomain.workers.dev
```

**Copy this URL** - you'll need it for registering the SmartApp.

**Note**: Since you mentioned your worker is at `hvac-monitor.natebarksdale.workers.dev`, your URL will be:
```
https://hvac-monitor.natebarksdale.workers.dev
```

## Step 6: Register the SmartApp in SmartThings

### A. Go to SmartThings Developer Workspace

1. Visit https://smartthings.developer.samsung.com/
2. Sign in with your SmartThings account
3. Click **"Workspace"** in the top navigation
4. Click **"New Project"**

### B. Create the SmartApp

1. **Project Name**: `HVAC Temperature Monitor`
2. **Project Type**: Select **"Automation for the SmartThings App"**
3. Click **"Create Project"**

### C. Register the Webhook

1. In your project, go to **"Automation"** → **"SmartApp"**
2. Click **"Register SmartApp"**
3. Fill in the details:
   - **SmartApp Name**: `HVAC Temperature Monitor`
   - **Description**: `Real-time HVAC temperature monitoring`
   - **SmartApp Type**: Select **"Webhook"**
   - **Target URL**: Enter your worker URL from Step 5
     ```
     https://hvac-monitor.natebarksdale.workers.dev
     ```
   - **App Display Name**: `HVAC Monitor`
   - **App Description**: `Monitor HVAC temperatures in real-time`

4. Click **"Next"**

### D. Configure Scopes

Select the following permissions:
- ✅ **r:devices:\*** - List all devices
- ✅ **r:devices:\*:status** - Read device status

Click **"Save"**

### E. Verify the Webhook

SmartThings will send a CONFIRMATION request to your worker URL to verify ownership.

Check the worker logs:
```bash
wrangler tail --config wrangler-smartapp.toml
```

You should see:
```
Received CONFIRMATION lifecycle event
Confirmation URL: https://...
```

If verification succeeds, you'll see a green checkmark in the SmartThings Developer Workspace.

### F. Publish the SmartApp

1. In the Developer Workspace, click **"Deploy to Test"**
2. This makes the SmartApp available in your SmartThings mobile app

## Step 7: Install the SmartApp in SmartThings Mobile App

### A. Open SmartThings App

1. Open the SmartThings mobile app on your phone
2. Tap the **Menu** (☰) icon
3. Tap **"SmartApps"**
4. Tap **"Add SmartApp"** or **"+"**
5. Look for **"HVAC Temperature Monitor"** in the list
6. Tap it to begin installation

### B. Configure the SmartApp

1. The app will show the configuration page you defined
2. Select your temperature sensors (thermostats, temp sensors, etc.)
3. Tap **"Done"** or **"Save"**

### C. Verify Installation

The SmartApp will:
1. Subscribe to temperature events from your selected devices
2. Start receiving real-time updates when temperatures change

Check the worker logs:
```bash
wrangler tail --config wrangler-smartapp.toml
```

You should see:
```
Received INSTALL lifecycle event
Creating 3 temperature subscriptions
```

When a temperature changes, you'll see:
```
Received EVENT lifecycle event
Processing 1 events
Temperature update: Device abc-123 = 72°F
Stored temperature reading for device abc-123
```

## Step 8: Test the API Endpoints

Your worker now exposes these endpoints:

### Get All Current Temperatures

```bash
curl https://hvac-monitor.natebarksdale.workers.dev/temperatures
```

Response:
```json
{
  "abc-123": {
    "deviceId": "abc-123",
    "componentId": "main",
    "temperature": 72,
    "unit": "F",
    "timestamp": "2025-11-24T12:34:56.789Z"
  },
  "def-456": {
    "deviceId": "def-456",
    "componentId": "main",
    "temperature": 68,
    "unit": "F",
    "timestamp": "2025-11-24T12:35:12.345Z"
  }
}
```

### Get Temperature for Specific Device

```bash
curl https://hvac-monitor.natebarksdale.workers.dev/temperature/abc-123
```

### Get Temperature History for Device

```bash
curl https://hvac-monitor.natebarksdale.workers.dev/history/abc-123
```

Response (last 100 readings):
```json
[
  {
    "deviceId": "abc-123",
    "temperature": 72,
    "unit": "F",
    "timestamp": "2025-11-24T12:34:56.789Z"
  },
  {
    "deviceId": "abc-123",
    "temperature": 71,
    "unit": "F",
    "timestamp": "2025-11-24T11:20:30.123Z"
  }
]
```

## Step 9: Update Your Frontend App

Modify your HVAC control app to fetch temperatures from the worker instead of polling SmartThings:

```javascript
// In src/services/smartthings.js or similar

// Old polling approach (REMOVE)
// const pollInterval = setInterval(() => fetchFromSmartThings(), 5000);

// New webhook approach
async function fetchTemperatures() {
  const response = await fetch('https://hvac-monitor.natebarksdale.workers.dev/temperatures');
  const data = await response.json();
  return data;
}

// Call this when component mounts and refresh every 10-30 seconds
// (or use WebSocket/SSE for even more real-time updates)
```

## Optional: Sync to Google Sheets

If you want to also update Google Sheets when temperatures change:

1. Create a Google Apps Script webhook that accepts POST requests
2. Deploy it as a web app and get the URL
3. Set the secret in your worker:

```bash
wrangler secret put GOOGLE_SHEETS_WEBHOOK_URL --config wrangler-smartapp.toml
# Paste your Google Apps Script webhook URL when prompted
```

The worker will automatically POST temperature updates to this URL.

## Monitoring and Debugging

### View Real-time Logs

```bash
wrangler tail --config wrangler-smartapp.toml
```

### Common Log Messages

**Installation:**
```
Received INSTALL lifecycle event
Creating 3 temperature subscriptions
Stored installation data for abc-123-def-456
```

**Temperature Updates:**
```
Received EVENT lifecycle event
Processing 1 events
Temperature update: Device abc-123 = 72°F
Stored temperature reading for device abc-123
```

**Errors:**
```
Error: Storage not configured
→ Make sure KV namespace is configured in wrangler-smartapp.toml
```

### Check KV Storage

List all keys:
```bash
wrangler kv:key list --binding=SMARTAPP_STORAGE --config wrangler-smartapp.toml
```

Get a specific value:
```bash
wrangler kv:key get "temp:abc-123" --binding=SMARTAPP_STORAGE --config wrangler-smartapp.toml
```

## Troubleshooting

### "Webhook verification failed"

1. Make sure your worker is deployed and accessible
2. Check that the URL in SmartThings matches your worker URL exactly
3. Check worker logs for CONFIRMATION requests

### "No temperature updates"

1. Verify the SmartApp is installed in the mobile app
2. Check that you selected the correct devices during installation
3. Trigger a temperature change (adjust thermostat) and watch logs
4. Verify subscriptions were created (check INSTALL logs)

### "Storage not configured" error

1. Make sure you created the KV namespace
2. Verify the namespace ID is in `wrangler-smartapp.toml`
3. Redeploy the worker after adding KV configuration

### Device IDs don't match your system

The worker uses SmartThings device IDs. To map these to your system:

1. Fetch device list from SmartThings API
2. Match by device name or location
3. Create a mapping in your frontend:

```javascript
const deviceNameMap = {
  'abc-123': 'Basement',
  'def-456': 'JR\'s Office',
  // ... etc
};
```

## Cost

Cloudflare Workers free tier includes:
- 100,000 requests per day
- 100,000 KV read operations per day
- 1,000 KV write operations per day
- 1 GB KV storage

For HVAC monitoring with 8 zones updating every 5 minutes:
- ~2,300 webhook events per day
- ~2,300 KV writes per day (within free tier!)
- ~5,000 API reads per day (frontend fetching)
- Well within free tier limits

## Updating the Worker

After making changes to `smartapp-webhook-worker.js`:

```bash
wrangler deploy --config wrangler-smartapp.toml
```

Changes are live within seconds. No need to re-register the SmartApp.

## Next Steps

1. **Remove polling**: Delete SmartThings API polling code from frontend
2. **Reduce API calls**: Fetch from worker instead of SmartThings directly
3. **Add real-time UI**: Update temperatures in UI immediately when data changes
4. **Historical charts**: Use the `/history/{deviceId}` endpoint for sparklines
5. **Alerts**: Add logic to check for temperature anomalies and send notifications

## Security Considerations

- The worker URL is public but only SmartThings can trigger events (verified by subscription)
- Temperature data in KV is readable by anyone with the endpoint URL
- Consider adding authentication to GET endpoints if needed
- Installation tokens are stored in KV (use for future SmartThings API calls if needed)

## Resources

- [SmartApp Basics](https://developer.smartthings.com/docs/connected-services/smartapp-basics)
- [Hosting a Webhook SmartApp](https://developer.smartthings.com/docs/connected-services/hosting/webhook-smartapp)
- [SmartApp Lifecycles](https://developer.smartthings.com/docs/connected-services/lifecycles)
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Cloudflare KV Docs](https://developers.cloudflare.com/kv/)

## Questions?

Check the worker logs first:
```bash
wrangler tail --config wrangler-smartapp.toml
```

Most issues show up as errors in the logs with helpful messages.
