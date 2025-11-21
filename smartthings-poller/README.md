# SmartThings Thermostat Polling

This directory contains a script that polls the SmartThings API to retrieve temperature readings from multiple thermostats across your home.

## How It Works

1. **poll-thermostat.js** - Node.js script that:
   - Connects to the SmartThings API using a Personal Access Token
   - Queries 8 thermostats simultaneously for current temperatures
   - Fetches exterior weather data (temperature, humidity) for zip code 20010 via OpenWeatherMap API
   - Calculates 24-hour and 5-day rolling average temperatures for exterior conditions
   - Stores readings in `../data/temperature-readings.json` with timestamps, organized by device
   - Updates Google Sheets control panel (`1819 Control Panel Panel!A57:H57`) with current temperatures
   - Keeps the last 1000 readings per device and per weather data to prevent unlimited growth

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
- **x:devices:\*** - Execute commands (required if using HVAC Control dashboard for thermostat control)

**Important**: Make sure to select these specific permissions when creating the token. A token without the correct permissions will result in "Access denied" errors.

**Note**: The polling script only needs read permissions. The `x:devices:*` permission is only required if you're also using the HVAC Control dashboard to send commands to thermostats.

### 2. Get OpenWeatherMap API Key (Optional but Recommended)

The script can track exterior weather conditions to provide context for your HVAC data.

1. Visit https://openweathermap.org/api and sign up for a free account
2. Go to **API keys** section in your account
3. Copy your API key (free tier includes 1,000 calls/day, more than enough for 15-minute polling)

The weather tracking includes:
- Current temperature and humidity for zip code 20010
- 24-hour rolling average temperature
- 5-day rolling average temperature
- Additional data: feels like, pressure, wind speed, cloudiness, weather description

**Note**: If you don't provide this key, the script will skip weather tracking and only collect thermostat data.

### 3. Add GitHub Secrets

In your GitHub repository:
1. Go to **Settings** → **Secrets and variables** → **Actions**
2. Create these secrets:
   - **`SMARTTHINGS_TOKEN`** (Required) - Your SmartThings Personal Access Token
   - **`VITE_GOOGLE_SHEETS_API_KEY`** (Optional) - Your Google Sheets API key (for updating the control panel)
   - **`OPENWEATHER_API_KEY`** (Optional) - Your OpenWeatherMap API key (for weather tracking)

**Notes**:
- The Google Sheets API key should have permission to edit the spreadsheet `1W12hiuSTZSzDNrcuf9RxCYmQcKJxmm_WCQ9--cJ9BGo`. If you don't have this secret set, the script will still work but skip the Google Sheets update.
- The OpenWeatherMap API key enables exterior weather tracking. If not set, the script will skip weather data collection.

### 4. Configure Devices (optional)

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

Temperature readings are stored in `data/temperature-readings.json`, organized by device with comprehensive thermostat data and weather tracking:

```json
{
  "devices": {
    "8021826e-78ca-4f3d-bd33-bdac1cadd3f2": {
      "location": "Original Thermostat",
      "deviceLabel": "Living Room Thermostat",
      "sheetName": "NBs Office",
      "readings": [
        {
          "timestamp": "2025-11-21T19:45:00.000Z",
          "temperature": { "value": 72, "unit": "F" },
          "humidity": 45,
          "mode": "heat",
          "operatingState": "heating",
          "heatingSetpoint": 70,
          "coolingSetpoint": 75,
          "fanMode": "auto",
          "lights": {
            "anyOn": true,
            "onCount": 2,
            "totalCount": 3,
            "lights": [
              { "name": "Main Lights", "status": "on" },
              { "name": "Desk Lamp", "status": "on" },
              { "name": "Floor Lamp", "status": "off" }
            ]
          }
        }
      ]
    }
  },
  "weather": {
    "location": {
      "zipCode": "20010",
      "name": "Washington"
    },
    "readings": [
      {
        "timestamp": "2025-11-21T19:45:00.000Z",
        "temperature": { "value": 45.2, "unit": "F" },
        "humidity": 65,
        "feelsLike": 42.1,
        "pressure": 1013,
        "description": "clear sky",
        "windSpeed": 5.2,
        "cloudiness": 10
      }
    ],
    "average24hr": 47.3,
    "average5day": 48.8
  },
  "lastUpdated": "2025-11-21T19:45:00.000Z",
  "totalDevices": 8,
  "successfulReads": 8,
  "failedReads": 0,
  "totalReadings": 16
}
```

**Data Collection Details**:
- Each device stores up to 1000 historical readings
- Weather data stores up to 1000 historical readings
- Thermostat readings include: temperature, humidity, mode, operating state, setpoints, fan mode, and associated light status
- Weather readings include: temperature, humidity, feels like, pressure, wind speed, cloudiness, and description
- Rolling averages are calculated automatically for 24-hour and 5-day periods

## Google Sheets Integration

The poller automatically updates your Google Sheets control panel at `1819 Control Panel Panel!A57:H57` with the latest temperatures in this order:

| Column | Location |
|--------|----------|
| A57 | Basement |
| B57 | JRs office |
| C57 | Main kitchen |
| D57 | Kids Bedroom |
| E57 | Front hall |
| F57 | Primary Bedroom |
| G57 | NB's Office |
| H57 | Denn |

The update happens after polling all devices and before committing the data file. If the Google Sheets API key is not configured, this step is skipped and only the local data file is updated.

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
