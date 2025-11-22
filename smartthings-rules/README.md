# SmartThings Rules for Thermostat Temperature Alerts

This directory contains SmartThings Rules API configurations for monitoring thermostat temperatures every 15 minutes.

## Files

### 1. `thermostat-alert-rule.json`
A simple rule that monitors a single thermostat and sends data to IFTTT webhook.

**Features:**
- Runs every 15 minutes (cron: `0 */15 * * * ? *`)
- Sends temperature, unit, and device label to IFTTT
- Uses IFTTT Webhooks service

**Setup:**
1. Create an IFTTT applet with Webhooks trigger named `thermostat_reading`
2. Replace `YOUR_IFTTT_KEY` with your IFTTT webhook key
3. Update the device ID if needed

### 2. `multi-thermostat-webhook-rule.json`
A comprehensive rule that monitors all 8 thermostats and sends data to a custom webhook.

**Features:**
- Monitors all thermostats simultaneously
- Runs every 15 minutes
- Sends comprehensive data: temperature, humidity, mode, operating state
- Posts to a custom webhook endpoint

**Setup:**
1. Replace `YOUR_WEBHOOK_URL` with your actual webhook endpoint
2. The webhook will receive JSON with all thermostat readings

## How to Deploy Rules

SmartThings Rules can be created via the SmartThings API:

```bash
# Create a rule
curl -X POST https://api.smartthings.com/v1/rules \\
  -H "Authorization: Bearer YOUR_SMARTTHINGS_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d @multi-thermostat-webhook-rule.json
```

### Using the SmartThings CLI

If you have the SmartThings CLI installed:

```bash
# Install SmartThings CLI (if not installed)
npm install -g @smartthings/cli

# Login
smartthings login

# Create rule from file
smartthings rules:create -i multi-thermostat-webhook-rule.json

# List all rules
smartthings rules

# Get rule details
smartthings rules RULE_ID

# Delete a rule
smartthings rules:delete RULE_ID
```

## Alert Options

### Option 1: IFTTT Webhooks
- **Pros**: Easy setup, can trigger multiple actions (email, SMS, notifications)
- **Cons**: Limited to 3 values per trigger
- **URL format**: `https://maker.ifttt.com/trigger/{event_name}/with/key/{your_key}`

### Option 2: Custom Webhook
- **Pros**: Full control, can process complex data
- **Cons**: Requires hosting your own endpoint
- **Recommended services**:
  - Your existing Cloudflare Worker
  - AWS Lambda + API Gateway
  - Google Cloud Functions
  - Azure Functions

### Option 3: Google Sheets (via webhook)
You could create a webhook endpoint that receives the data and writes to Google Sheets, similar to your current `updateGoogleSheet()` function.

### Option 4: Discord/Slack Webhook
Send notifications directly to a chat channel:

```json
{
  "location": {
    "method": "POST",
    "url": "https://discord.com/api/webhooks/YOUR_WEBHOOK_URL",
    "contentType": "application/json",
    "body": {
      "content": "🌡️ Temperature Alert: {{$device.label}} is {{$device.temperatureMeasurement.temperature.value}}°{{$device.temperatureMeasurement.temperature.unit}}"
    }
  }
}
```

## Rule Schema Notes

SmartThings Rules use a JSON schema with these key components:

- **Triggers**: Schedule (cron), device events, location mode changes
- **Conditions**: `if` blocks to filter when actions run
- **Actions**: Device commands, HTTP requests (webhooks), scenes
- **Context variables**: Access device attributes with `{{device:DEVICE_ID.capability.attribute.value}}`

## Comparison with Current GitHub Actions Approach

| Feature | GitHub Actions | SmartThings Rules |
|---------|---------------|-------------------|
| Execution | External (GitHub servers) | SmartThings Cloud |
| Latency | Moderate (API calls) | Low (native platform) |
| Reliability | Depends on GitHub | Native to SmartThings |
| Flexibility | High (full Node.js) | Limited (JSON schema) |
| Cost | Free (within limits) | Free |
| Data storage | Git commits | External webhooks only |

## Recommended Hybrid Approach

Keep your current GitHub Actions for:
- Data logging to Git
- Complex control logic (HVAC loop analysis)
- Google Sheets integration

Add SmartThings Rules for:
- Real-time alerts (push notifications)
- Immediate webhook notifications
- Redundancy/backup monitoring

## Example Webhook Receiver

Here's a simple Node.js endpoint to receive the webhook:

```javascript
// Express.js example
app.post('/thermostat-readings', (req, res) => {
  const { timestamp, readings } = req.body;

  console.log(`Received ${readings.length} thermostat readings at ${timestamp}`);

  readings.forEach(reading => {
    console.log(`${reading.location}: ${reading.temperature}°${reading.unit}`);

    // Optional: Send alert if temperature is out of range
    if (reading.temperature > 80 || reading.temperature < 60) {
      sendAlert(reading);
    }
  });

  res.status(200).json({ success: true });
});
```

## Testing

To test without waiting 15 minutes, you can:

1. Create a test rule with a 1-minute schedule
2. Use the SmartThings API to manually execute the rule
3. Check your webhook endpoint logs for data

## Troubleshooting

- **Rule not firing**: Check timezone setting in cron schedule
- **Webhook not receiving data**: Verify URL is publicly accessible
- **Missing data**: Ensure devices support the capabilities being accessed
- **Authentication errors**: Check SmartThings API token permissions
