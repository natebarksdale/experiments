#!/bin/bash
# Install SmartApp via SmartThings REST API
# Since the CLI no longer has apps:install command

set -e

echo "📱 Installing SmartApp via REST API"
echo ""

# Step 1: Get authentication token
echo "Step 1: Getting your authentication token..."
TOKEN=$(smartthings config | grep "^token:" | awk '{print $2}')

if [ -z "$TOKEN" ]; then
    echo "❌ No token found. Please login first:"
    echo "   smartthings login"
    exit 1
fi

echo "✅ Token found"
echo ""

# Step 2: List apps to find your app ID
echo "Step 2: Finding your SmartApp..."
echo "Listing your apps:"
smartthings apps --type WEBHOOK_SMART_APP

echo ""
read -p "Enter your App ID (from list above): " APP_ID

if [ -z "$APP_ID" ]; then
    echo "❌ App ID required"
    exit 1
fi

# Step 3: Get location
echo ""
echo "Step 3: Finding your location..."
smartthings locations

echo ""
read -p "Enter your Location ID (from list above): " LOCATION_ID

if [ -z "$LOCATION_ID" ]; then
    echo "❌ Location ID required"
    exit 1
fi

# Step 4: Get devices with temperature capability
echo ""
echo "Step 4: Finding temperature devices..."
smartthings devices --location="$LOCATION_ID"

echo ""
echo "Enter device IDs to monitor (comma-separated):"
read -p "Device IDs: " DEVICE_IDS

if [ -z "$DEVICE_IDS" ]; then
    echo "❌ At least one device ID required"
    exit 1
fi

# Convert comma-separated device IDs to JSON array
DEVICES_JSON="["
IFS=',' read -ra DEVICE_ARRAY <<< "$DEVICE_IDS"
for i in "${!DEVICE_ARRAY[@]}"; do
    DEVICE_ID=$(echo "${DEVICE_ARRAY[$i]}" | xargs) # trim whitespace
    DEVICES_JSON+="{\"deviceConfig\":{\"deviceId\":\"$DEVICE_ID\"}}"
    if [ $i -lt $((${#DEVICE_ARRAY[@]} - 1)) ]; then
        DEVICES_JSON+=","
    fi
done
DEVICES_JSON+="]"

# Step 5: Create installed app via API
echo ""
echo "Step 5: Installing SmartApp..."

RESPONSE=$(curl -s -X POST "https://api.smartthings.com/v1/installedapps" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"appId\": \"$APP_ID\",
    \"locationId\": \"$LOCATION_ID\",
    \"config\": {
      \"tempSensors\": $DEVICES_JSON
    }
  }")

echo ""
echo "Response:"
echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"

# Check if successful
if echo "$RESPONSE" | grep -q "installedAppId"; then
    echo ""
    echo "✅ SmartApp installed successfully!"
    echo ""
    echo "Now watch for temperature events:"
    echo "  wrangler tail --config wrangler-smartapp.toml"
    echo ""
    echo "Or check current temperatures:"
    echo "  curl https://smartthings-hvac-webhook.natebarksdale.workers.dev/temperatures"
else
    echo ""
    echo "❌ Installation failed. Check the error message above."
    exit 1
fi
