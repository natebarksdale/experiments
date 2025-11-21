# HVAC Control API Proxy Setup

This guide will help you deploy a secure Cloudflare Worker proxy to protect your SmartThings and IFTTT API keys.

## Why Use a Proxy?

**The Problem**: Frontend JavaScript apps expose all environment variables in the bundled code. Anyone can open DevTools and extract your API keys.

**The Solution**: A Cloudflare Worker proxy keeps your API keys server-side. The frontend authenticates users with Google OAuth, then makes requests through the proxy.

## Security Benefits

✅ API keys never exposed in frontend code
✅ Google OAuth authentication required for all control operations
✅ Origin checking prevents unauthorized domains
✅ Read operations remain fast (direct API for monitoring)
✅ Write operations secured (proxied with auth check)

## Prerequisites

1. A Cloudflare account (free tier is sufficient)
2. Node.js installed locally
3. Your SmartThings and IFTTT API keys

## Step 1: Install Wrangler CLI

```bash
npm install -g wrangler
```

## Step 2: Login to Cloudflare

```bash
wrangler login
```

This will open a browser window for authentication.

## Step 3: Get Your Account ID

1. Go to https://dash.cloudflare.com/
2. Click on "Workers & Pages" in the left sidebar
3. Your Account ID is shown in the right panel
4. Copy this ID

## Step 4: Configure Wrangler

Edit `wrangler-hvac.toml` and add your account ID:

```toml
account_id = "your-account-id-here"
```

## Step 5: Set Environment Secrets

Set your API keys as Cloudflare Worker secrets (they won't be visible in code):

```bash
# Navigate to the cloudflare-worker directory
cd cloudflare-worker

# Set SmartThings token
wrangler secret put SMARTTHINGS_TOKEN --config wrangler-hvac.toml
# Paste your token when prompted

# Set IFTTT webhook key
wrangler secret put IFTTT_WEBHOOK_KEY --config wrangler-hvac.toml
# Paste your key when prompted
```

## Step 6: Deploy the Worker

```bash
wrangler deploy --config wrangler-hvac.toml
```

After deployment, you'll see output like:

```
Published hvac-control-proxy (X.XX sec)
  https://hvac-control-proxy.your-subdomain.workers.dev
```

**Copy this URL** - you'll need it for the next step.

## Step 7: Configure Frontend

Update your `.env` file (or add GitHub secrets for production):

```env
# Enable proxy mode
VITE_USE_PROXY=true

# Your Cloudflare Worker URL (from step 6)
VITE_PROXY_URL=https://hvac-control-proxy.your-subdomain.workers.dev
```

### For GitHub Pages Deployment

Add these secrets in GitHub:
- Settings → Secrets and variables → Actions → New repository secret

1. **`VITE_USE_PROXY`**: Set to `true`
2. **`VITE_PROXY_URL`**: Your worker URL from step 6

## Step 8: Update Allowed Origins (Optional)

If you have custom domains, edit `hvac-proxy-worker.js`:

```javascript
const allowedOrigins = [
  'https://natebarksdale.xyz',
  'https://natebarksdale.github.io',
  'https://your-custom-domain.com',  // Add your domain here
  'http://localhost:5173',
  // ...
];
```

Then redeploy:

```bash
wrangler deploy --config wrangler-hvac.toml
```

## Step 9: Test the Proxy

1. Build and run your HVAC control app locally:
   ```bash
   cd hvac-control
   npm run dev
   ```

2. Open the app in your browser
3. Sign in with Google OAuth
4. Try controlling a thermostat or light
5. Check the browser console - you should see:
   - "SmartThings control sent successfully" (from frontend)
   - No raw API calls to smartthings.com or maker.ifttt.com
   - All control requests go to your worker URL

## How It Works

### Authentication Flow

1. User clicks "Sign In"
2. Google OAuth consent screen appears
3. User grants permission
4. Frontend receives OAuth access token
5. Token stored in localStorage

### Control Request Flow

1. User adjusts thermostat setting
2. Frontend calls `controlThermostat()`
3. `executeCommand()` detects proxy is available
4. Request sent to: `https://your-worker.workers.dev/smartthings/devices/{id}/commands`
5. Worker verifies OAuth token with Google
6. If valid, worker forwards request to SmartThings API with stored token
7. Worker returns response to frontend

### Read Request Flow (Monitoring)

Temperature reads remain direct (no proxy) for speed:
- `fetchZoneTemperatures()` calls SmartThings API directly
- Uses read-only token
- Fast response (<2s)

## Security Model

| Operation | Route | Authentication | Token Location |
|-----------|-------|----------------|----------------|
| Read temperatures | Direct API | None | Frontend (read-only) |
| Control thermostats | Worker proxy | Google OAuth | Worker (execute) |
| Trigger IFTTT | Worker proxy | Google OAuth | Worker (webhook) |

## Monitoring and Logs

View worker logs in real-time:

```bash
wrangler tail --config wrangler-hvac.toml
```

This shows:
- Incoming requests
- Authentication attempts
- API errors
- Blocked origins

## Updating the Worker

After making changes to `hvac-proxy-worker.js`:

```bash
wrangler deploy --config wrangler-hvac.toml
```

Changes are live within seconds.

## Cost

Cloudflare Workers free tier includes:
- 100,000 requests per day
- Unlimited deploys
- 10ms CPU time per request

For HVAC control, this is more than sufficient (even with 24/7 monitoring).

## Troubleshooting

### "Proxy not available" error

Check that `.env` has:
```env
VITE_USE_PROXY=true
VITE_PROXY_URL=https://your-worker-url-here
```

### "Unauthorized" errors

1. Make sure you're signed in with Google OAuth
2. Check that token hasn't expired (refresh the page)
3. Verify the OAuth scope includes Google Sheets access

### "Origin blocked" errors

Add your domain to `allowedOrigins` in `hvac-proxy-worker.js` and redeploy.

### Worker deployment fails

1. Verify `account_id` is set in `wrangler-hvac.toml`
2. Run `wrangler login` again
3. Check you have permission to create workers in your Cloudflare account

## Development Mode (Without Proxy)

For local development without deploying the worker:

```env
VITE_USE_PROXY=false
```

This uses direct API calls with tokens from `.env`. **Never commit `.env` to git!**

## Rotating API Keys

If you need to rotate keys:

```bash
wrangler secret put SMARTTHINGS_TOKEN --config wrangler-hvac.toml
# Enter new token

wrangler secret put IFTTT_WEBHOOK_KEY --config wrangler-hvac.toml
# Enter new key
```

No code changes needed - secrets are loaded at runtime.

## Next Steps

Once the proxy is deployed and working:

1. **Remove tokens from frontend**: Delete `VITE_SMARTTHINGS_TOKEN` and `VITE_IFTTT_WEBHOOK_KEY` from production `.env`
2. **Update GitHub secrets**: Remove the token secrets (or set to empty)
3. **Test thoroughly**: Verify all control operations work through proxy
4. **Monitor usage**: Check Cloudflare dashboard for request patterns

## Questions?

- Cloudflare Workers docs: https://developers.cloudflare.com/workers/
- Wrangler CLI docs: https://developers.cloudflare.com/workers/wrangler/
