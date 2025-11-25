#!/bin/bash
# Fixed SmartApp installation with correct API format

TOKEN="60ba6432-ec8e-4714-8d71-0add19ed48d8"
APP_ID="b4c3aef5-9ffa-4a1e-b5ed-5b955d823113"
LOCATION_ID="a289f1e8-abed-40eb-a06d-d3e556ae5162"

# Device IDs
DEVICES=(
  "8021826e-78ca-4f3d-bd33-bdac1cadd3f2"
  "dd6b54be-a667-4acc-a112-d89c9923c29d"
  "999d0c8c-2caa-4ea6-a7ef-f8d73d1a5147"
  "8f5a0b61-76de-4add-bcb7-9cb5e7e8d3bd"
  "87f9fbe2-f6b7-4877-9486-01b896a0acb5"
  "c44c9f12-1029-43c0-af5f-a5ff572d37c7"
  "9ced4ff7-4376-47c8-b882-5724bfb14306"
  "8051fd90-ab24-467c-8746-3dadbce02252"
)

# Build device config array with proper valueType
DEVICE_CONFIG="["
for i in "${!DEVICES[@]}"; do
  DEVICE_CONFIG+="{\"valueType\":\"DEVICE\",\"deviceConfig\":{\"deviceId\":\"${DEVICES[$i]}\",\"componentId\":\"main\"}}"
  if [ $i -lt $((${#DEVICES[@]} - 1)) ]; then
    DEVICE_CONFIG+=","
  fi
done
DEVICE_CONFIG+="]"

echo "Installing SmartApp with proper API format..."
echo ""

curl -X POST "https://api.smartthings.com/v1/installedapps" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"appId\": \"$APP_ID\",
    \"locationId\": \"$LOCATION_ID\",
    \"installedAppType\": \"WEBHOOK_SMART_APP\",
    \"configurationStatus\": \"DONE\",
    \"config\": {
      \"tempSensors\": $DEVICE_CONFIG
    }
  }" | jq .

echo ""
echo "Check wrangler tail for lifecycle events!"
