#!/bin/bash
# Install SmartApp via SmartThings CLI

echo "📱 SmartThings CLI Installation Guide"
echo ""

# Check if CLI is installed
if ! command -v smartthings &> /dev/null; then
    echo "Installing SmartThings CLI..."
    npm install -g @smartthings/cli
fi

echo "Step 1: Login to SmartThings"
echo "Run: smartthings login"
echo ""

echo "Step 2: List your SmartApps to find the app ID"
echo "Run: smartthings apps"
echo ""
echo "Look for your app (HVAC Temperature Monitor) and copy its 'appId'"
echo ""

echo "Step 3: List your locations to find location ID"
echo "Run: smartthings locations"
echo ""
echo "Copy your location ID (usually your home name)"
echo ""

echo "Step 4: Install the SmartApp"
echo "Run: smartthings apps:install <appId> --location=<locationId>"
echo ""

echo "Example:"
echo "  smartthings apps:install abc-123-def-456 --location=xyz-789"
echo ""

echo "After installation, you should see it under Automations in the mobile app"
