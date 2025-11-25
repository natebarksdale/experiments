#!/bin/bash
# Deploy SmartThings SmartApp webhook to Cloudflare Workers
# Run this from the cloudflare-worker directory

set -e  # Exit on error

echo "🚀 Deploying SmartThings SmartApp webhook..."
echo ""

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler CLI not found. Installing..."
    npm install -g wrangler
fi

# Check if wrangler-smartapp.toml exists
if [ ! -f "wrangler-smartapp.toml" ]; then
    echo "❌ wrangler-smartapp.toml not found!"
    echo "Make sure you're in the cloudflare-worker directory"
    exit 1
fi

# Check if account_id is set
if grep -q "# account_id" wrangler-smartapp.toml; then
    echo "⚠️  Warning: account_id is commented out in wrangler-smartapp.toml"
    echo "Please uncomment and add your Cloudflare account ID"
    echo ""
    echo "Get it by running: wrangler whoami"
    exit 1
fi

# Check if KV namespace is set
if grep -q "# \[\[kv_namespaces\]\]" wrangler-smartapp.toml; then
    echo "⚠️  Warning: KV namespace is commented out in wrangler-smartapp.toml"
    echo "Please uncomment and add your KV namespace ID"
    echo ""
    echo "Create it by running:"
    echo "  wrangler kv:namespace create SMARTAPP_STORAGE --config wrangler-smartapp.toml"
    exit 1
fi

echo "📝 Configuration looks good!"
echo ""

# Deploy
echo "🔨 Deploying worker..."
wrangler deploy --config wrangler-smartapp.toml

echo ""
echo "✅ Deployment complete!"
echo ""
echo "Your worker is now available at:"
echo "  https://smartthings-hvac-webhook.YOUR-SUBDOMAIN.workers.dev"
echo ""
echo "Next steps:"
echo "1. Test the endpoint:"
echo "   curl https://smartthings-hvac-webhook.YOUR-SUBDOMAIN.workers.dev/"
echo ""
echo "2. Update SmartThings Developer Workspace with this URL"
echo ""
echo "3. Watch logs with:"
echo "   wrangler tail --config wrangler-smartapp.toml"
