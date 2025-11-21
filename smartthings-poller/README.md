# SmartThings Thermostat Polling

This directory contains a script that polls the SmartThings API to retrieve temperature readings from multiple thermostats across your home.

## How It Works

1. **poll-thermostat.js** - Node.js script that:
   - Connects to the SmartThings API using a Personal Access Token
   - Queries 8 thermostats simultaneously for current temperatures
   - Stores readings in `../data/temperature-readings.json` with timestamps, organized by device
   - Keeps the last 1000 readings per device to prevent unlimited growth

2. **GitHub Action** - Automated workflow (`.github/workflows/poll-thermostat.yml`) that:
   - Runs every 15 minutes on a schedule
   - Executes the polling script
   - Commits updated data back to the repository
   - Can be triggered manually via workflow_dispatch

## Setup

### 1. Get SmartThings Personal Access Token

Visit https://account.smartthings.com/tokens and create a new token with these **required permissions**:

- ✅ **r:devices:\*** - List all devices
- ✅ **r:devices:\*:status** - See device status

Optional but recommended:
- **r:locations:\*** - Read locations

**Important**: Make sure to select these specific permissions when creating the token. A token without the correct permissions will result in "Access denied" errors.

### 2. Add GitHub Secret

In your GitHub repository:
1. Go to **Settings** → **Secrets and variables** → **Actions**
2. Create a new secret named `SMARTTHINGS_TOKEN`
3. Paste your SmartThings token as the value

### 3. Configure Devices (optional)

The script is pre-configured to poll 8 thermostats across different locations. To add, remove, or modify devices, edit the `DEVICES` array in `poll-thermostat.js`:

```javascript
const DEVICES = [
  { id: '8021826e-78ca-4f3d-bd33-bdac1cadd3f2', location: 'Original Thermostat' },
  { id: '8051fd90-ab24-467c-8746-3dadbce02252', location: 'Basement' },
  { id: '87f9fbe2-f6b7-4877-9486-01b896a0acb5', location: 'Denn' },
  // ... add more devices as needed
];
```

Each device requires:
- `id` - Device ID from SmartThings URL
- `location` - Friendly name for the device location

## Testing Your Token

Before running the polling script, test your token with the diagnostic tool:

```bash
cd smartthings-poller
export SMARTTHINGS_TOKEN="your-token-here"
node test-token.js
```

This will verify:
- Your token has the correct permissions
- You can access the SmartThings API
- Your devices are visible
- Device status can be retrieved

## Running Manually

You can test the script locally:

```bash
cd smartthings-poller
export SMARTTHINGS_TOKEN="your-token-here"
node poll-thermostat.js
```

Or trigger the GitHub Action manually:
1. Go to **Actions** tab in GitHub
2. Select "Poll SmartThings Thermostat"
3. Click "Run workflow"

## Data Format

Temperature readings are stored in `data/temperature-readings.json`, organized by device:

```json
{
  "devices": {
    "8021826e-78ca-4f3d-bd33-bdac1cadd3f2": {
      "location": "Original Thermostat",
      "deviceLabel": "Living Room Thermostat",
      "readings": [
        {
          "temperature": 72,
          "unit": "F",
          "timestamp": "2025-11-21T19:45:00.000Z"
        }
      ]
    },
    "8051fd90-ab24-467c-8746-3dadbce02252": {
      "location": "Basement",
      "deviceLabel": "Basement Thermostat",
      "readings": [
        {
          "temperature": 68,
          "unit": "F",
          "timestamp": "2025-11-21T19:45:00.000Z"
        }
      ]
    }
  },
  "lastUpdated": "2025-11-21T19:45:00.000Z",
  "totalDevices": 8,
  "successfulReads": 8,
  "failedReads": 0,
  "totalReadings": 16
}
```

Each device stores up to 1000 historical readings.

## Schedule

By default, the workflow runs every 15 minutes. To change the frequency, edit the cron expression in `.github/workflows/poll-thermostat.yml`:

```yaml
schedule:
  - cron: '*/15 * * * *'  # Every 15 minutes
```

Examples:
- Every 5 minutes: `'*/5 * * * *'`
- Every hour: `'0 * * * *'`
- Every 30 minutes: `'*/30 * * * *'`

## Troubleshooting

### API Errors
- Verify your token is valid and has the correct permissions
- Check that the device ID matches your thermostat
- Ensure the device supports the `temperatureMeasurement` capability

### No Data Being Committed
- Check the Actions tab for workflow run logs
- Verify the `SMARTTHINGS_TOKEN` secret is set correctly
- Make sure the repository has write permissions enabled

### Authentication Issues
- SmartThings tokens can expire - generate a new one if needed
- Ensure the token has access to the specific location/device
