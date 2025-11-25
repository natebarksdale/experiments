# SmartThings CLI Updated Commands Guide

The SmartThings CLI has been updated. Here's how to work with SmartApps now:

## Step 1: Login

```bash
smartthings login
```

## Step 2: List Your SmartApps

```bash
smartthings apps
```

Or get more details:
```bash
smartthings apps --help
```

This should show subcommands available for apps.

## Step 3: List Locations

```bash
smartthings locations
```

## Step 4: Install the SmartApp

The install command may have changed. Try these:

### Option A: Check apps subcommands
```bash
smartthings apps --help
```

Look for subcommands like:
- `smartthings apps:install`
- `smartthings apps install`
- `smartthings apps create`

### Option B: Check installedapps
```bash
smartthings installedapps --help
```

The new CLI might use `installedapps` for managing app installations.

### Option C: Interactive mode
Some CLI versions support interactive installation:
```bash
smartthings apps
# Then follow prompts to install
```

## Finding the Right Command

Run these to explore:

```bash
# See all apps commands
smartthings apps --help

# See all installedapps commands
smartthings installedapps --help

# Check if there's an install subcommand
smartthings apps install --help
```

## Alternative: Use SmartThings API Directly

If the CLI doesn't have an easy install command, you can use the API:

```bash
# Get your token
smartthings config

# Use the API (replace TOKEN, APP_ID, LOCATION_ID)
curl -X POST https://api.smartthings.com/v1/installedapps \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "appId": "YOUR_APP_ID",
    "locationId": "YOUR_LOCATION_ID",
    "config": {
      "tempSensors": [
        {"deviceConfig": {"deviceId": "DEVICE_ID_1"}},
        {"deviceConfig": {"deviceId": "DEVICE_ID_2"}}
      ]
    }
  }'
```

## Next Steps

1. Run `smartthings apps --help` to see available subcommands
2. Find your appId with `smartthings apps`
3. Find your locationId with `smartthings locations`
4. Look for the install command in the help output
5. Report back what you find, and we'll adjust the instructions!
