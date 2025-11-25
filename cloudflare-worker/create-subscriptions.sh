#!/bin/bash
# Create subscriptions for all 8 temperature devices

TOKEN="60ba6432-ec8e-4714-8d71-0add19ed48d8"
INSTALLED_APP_ID="2f6ebecc-1c4b-4861-9150-3dcdbde69141"

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

echo "Creating temperature subscriptions for all devices..."
echo ""

for DEVICE_ID in "${DEVICES[@]}"; do
  echo "📡 Subscribing to device: $DEVICE_ID"

  RESPONSE=$(curl -s -X POST "https://api.smartthings.com/v1/installedapps/$INSTALLED_APP_ID/subscriptions" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"sourceType\": \"DEVICE\",
      \"device\": {
        \"deviceId\": \"$DEVICE_ID\",
        \"componentId\": \"main\",
        \"capability\": \"temperatureMeasurement\",
        \"attribute\": \"temperature\",
        \"stateChangeOnly\": true
      }
    }")

  if echo "$RESPONSE" | grep -q "subscriptionId"; then
    SUB_ID=$(echo "$RESPONSE" | jq -r '.subscriptionId')
    echo "✅ Created subscription: $SUB_ID"
  elif [ -z "$RESPONSE" ]; then
    echo "✅ Subscription created (no response body)"
  else
    echo "❌ Error: $RESPONSE"
  fi
  echo ""
done

echo "Done! Now:"
echo "1. Watch logs: wrangler tail --config wrangler-smartapp.toml"
echo "2. Trigger temp change (adjust a thermostat)"
echo "3. Check temperatures: curl https://smartthings-hvac-webhook.natebarksdale.workers.dev/temperatures"
