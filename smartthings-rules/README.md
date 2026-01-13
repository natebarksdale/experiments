# SmartThings Rules for Thermostat Temperature Alerts

This directory contains SmartThings Rules API configurations for monitoring thermostat temperatures every 15 minutes.

## ⚠️ Important Limitation

**The SmartThings Rules API does NOT support HTTP/webhook actions directly.** The original files with webhook actions won't work.

Your current **GitHub Actions approach is actually the best solution** for webhook notifications since it has full control.

## Files

### 1. `thermostat-monitor-corrected.json` ✅
A properly formatted rule that demonstrates the correct Rules API schema.

**Features:**
- Runs every 15 minutes using the correct interval format
- Monitors temperature and can trigger device commands
- Example: Sets cooling mode if temperature exceeds 85°F

**Limitations:**
- Cannot send HTTP webhooks
- Cannot write to Google Sheets directly
- Can only control SmartThings devices

### 2. `thermostat-alert-rule.json` ❌ (Won't work)
Contains invalid `location` action type - webhooks not supported in Rules API.

### 3. `multi-thermostat-webhook-rule.json` ❌ (Won't work)
Contains invalid `location` action type - webhooks not supported in Rules API.

## What Rules API CAN Do

- ✅ **command**: Control SmartThings devices
- ✅ **if**: Conditional logic based on device states
- ✅ **sleep**: Delay execution
- ✅ **every**: Schedule recurring actions (interval or specific times)

## What Rules API CANNOT Do

- ❌ Send HTTP webhooks
- ❌ Call external APIs
- ❌ Write to Google Sheets
- ❌ Send push notifications directly

## How to Deploy the Corrected Rule

### Using the SmartThings Web App
1. Go to https://my.smartthings.com
2. Navigate to Automations > Rules
3. Click "Create Rule"
4. Paste the JSON from `thermostat-monitor-corrected.json`
5. Update device IDs to match your thermostats
6. Customize temperature thresholds as needed

### Using the SmartThings CLI

```bash
# Install SmartThings CLI
npm install -g @smartthings/cli

# Login
smartthings login

# Create rule from file
smartthings rules:create -i thermostat-monitor-corrected.json

# List all rules
smartthings rules

# Get rule details
smartthings rules RULE_ID

# Delete a rule
smartthings rules:delete RULE_ID
```

### Using the API directly

```bash
curl -X POST https://api.smartthings.com/v1/rules \
  -H "Authorization: Bearer YOUR_SMARTTHINGS_TOKEN" \
  -H "Content-Type: application/json" \
  -d @thermostat-monitor-corrected.json
```

## Recommended Solution: Keep Your Current GitHub Actions!

Your existing setup in `.github/workflows/poll-thermostat.yml` is actually **better** than Rules API for this use case:

✅ Can send HTTP webhooks
✅ Can write to Google Sheets
✅ Can log data to Git
✅ Full Node.js capabilities
✅ Already working perfectly

## Alternative Options for Webhook Alerts

Since Rules API can't do webhooks, here are your options:

### Option 1: Stick with GitHub Actions (Recommended)
Your current setup already:
- Polls every 15 minutes
- Updates Google Sheets
- Logs to Git
- **Add webhook support** by inserting this code in `poll-thermostat.js`:

```javascript
// After polling each device, send webhook alert
if (thermostatData.temperature.value > 85 || thermostatData.temperature.value < 60) {
  await fetch('https://YOUR_WEBHOOK_URL/thermostat-alert', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      location: location,
      temperature: thermostatData.temperature.value,
      humidity: thermostatData.humidity,
      timestamp: new Date().toISOString(),
      alert: 'Temperature out of range'
    })
  });
}
```

### Option 2: Add IFTTT Integration to Your Script
Add IFTTT webhook calls to your existing `poll-thermostat.js`:

```javascript
// Send to IFTTT
await fetch(`https://maker.ifttt.com/trigger/thermostat_alert/with/key/YOUR_KEY`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    value1: location,
    value2: thermostatData.temperature.value,
    value3: thermostatData.temperature.unit
  })
});
```

### Option 3: Discord/Slack Notifications
Add to your existing script:

```javascript
// Discord webhook
await fetch('https://discord.com/api/webhooks/YOUR_WEBHOOK_URL', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    content: `🌡️ Alert: ${location} is ${thermostatData.temperature.value}°F`
  })
});
```

## Comparison: GitHub Actions vs SmartThings Rules

| Feature | GitHub Actions | SmartThings Rules |
|---------|---------------|-------------------|
| Execution | External (GitHub servers) | SmartThings Cloud |
| Webhooks | ✅ Yes | ❌ No |
| Google Sheets | ✅ Yes | ❌ No |
| Data Logging | ✅ Git commits | ❌ No storage |
| Device Control | ✅ Via API | ✅ Native |
| Flexibility | High (full Node.js) | Limited (device commands) |
| Latency | Moderate | Very low |
| Cost | Free (within limits) | Free |

**Verdict: GitHub Actions is superior for your use case!**

## What You CAN Use Rules For

SmartThings Rules are good for:
- ✅ Automated device control based on conditions
- ✅ Temperature-based HVAC adjustments
- ✅ Local execution (faster response)
- ✅ Simple if/then automations

Example use cases:
- "If basement temperature > 85°F, set cooling mode"
- "If bedroom temperature < 65°F, set heating mode"
- "Every hour, check all zones and adjust modes"

## Correct Rules API Schema

The key to avoiding the "422 Malformed body" error is using the correct schema:

```json
{
  "name": "Rule Name",
  "actions": [
    {
      "every": {
        "interval": {
          "value": { "integer": 15 },  // IMPORTANT: value must be an object!
          "unit": "Minute"             // Options: Minute, Hour, Day
        },
        "actions": [
          {
            "command": {
              "devices": ["YOUR-DEVICE-ID"],
              "commands": [{
                "component": "main",
                "capability": "thermostatMode",
                "command": "cool",
                "arguments": []
              }]
            }
          }
        ]
      }
    }
  ]
}
```

### Common Mistakes

❌ **Wrong**: `"value": 15`
✅ **Correct**: `"value": {"integer": 15}`

❌ **Wrong**: Using `"location"` action for webhooks
✅ **Correct**: Use `"command"` for device control only

❌ **Wrong**: Using cron syntax `"*/15 * * * *"`
✅ **Correct**: Use `"interval"` or `"specific"` time objects

## Testing Your Rule

To test your rule:

1. Create a test rule with a 1-minute interval: `{"integer": 1}`
2. Watch the device state change in the SmartThings app
3. Check rule execution in SmartThings logs
4. Once working, change interval back to 15 minutes

## Troubleshooting

**422 Malformed body on line 1:31**
- Check that `interval.value` is `{"integer": N}` not just `N`
- Ensure all JSON is properly formatted
- Remove any comments from JSON (they're not allowed)

**Rule not executing**
- Verify device IDs are correct
- Check that devices support the capabilities used
- Ensure timezone is correct if using specific times

**No webhook support**
- This is a Rules API limitation
- Use GitHub Actions instead for webhooks

## Sources

- [SmartThings Sample-RulesAPI GitHub](https://github.com/SmartThingsDevelopers/Sample-RulesAPI)
- [SmartThings Rules Documentation](https://developer.smartthings.com/docs/automations/rules)
- [SmartThings Community - Rules API FAQ](https://community.smartthings.com/t/faq-getting-started-with-the-new-rules-api/184078)
