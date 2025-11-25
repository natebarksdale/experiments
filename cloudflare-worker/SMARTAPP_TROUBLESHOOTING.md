# SmartApp Troubleshooting Guide

## Issue: SmartApp Not Showing in Mobile App

### Quick Diagnosis Checklist

Run through these checks in order:

## 1. Verify Worker Deployment

**Test the endpoint:**
```bash
curl https://hvac-monitor.natebarksdale.workers.dev/
```

**Expected response:**
```json
{
  "error": "Not found",
  "endpoints": [
    "GET /temperatures - Get all current temperatures",
    "GET /temperature/{deviceId} - Get temperature for specific device",
    "GET /history/{deviceId} - Get temperature history for specific device",
    "POST / - SmartThings webhook endpoint"
  ]
}
```

**If you see "Access denied":**
The wrong worker is deployed at this URL. You need to either:
- Deploy to a different worker name/URL, OR
- Replace the existing worker

**To check what workers you have:**
```bash
wrangler list
```

**To deploy with a different name:**
Edit `wrangler-smartapp.toml` and change:
```toml
name = "hvac-monitor-smartapp"  # Change this to a unique name
```

Then deploy:
```bash
wrangler deploy --config wrangler-smartapp.toml
```

## 2. Verify KV Namespace is Configured

**Check your `wrangler-smartapp.toml`:**
```toml
[[kv_namespaces]]
binding = "SMARTAPP_STORAGE"
id = "your-actual-kv-namespace-id"  # Must be uncommented and filled in
```

**If this is commented out or missing:**
```bash
# Create the namespace
wrangler kv:namespace create "SMARTAPP_STORAGE" --config wrangler-smartapp.toml

# Add the ID to wrangler-smartapp.toml
# Then redeploy
wrangler deploy --config wrangler-smartapp.toml
```

## 3. Test SmartThings Webhook with PING

**Create a test file `test-ping.json`:**
```json
{
  "lifecycle": "PING",
  "executionId": "test-123",
  "locale": "en",
  "version": "1.0.0",
  "pingData": {
    "challenge": "test-challenge-abc123"
  }
}
```

**Test the webhook:**
```bash
curl -X POST https://hvac-monitor.natebarksdale.workers.dev/ \
  -H "Content-Type: application/json" \
  -d @test-ping.json
```

**Expected response:**
```json
{
  "pingData": {
    "challenge": "test-challenge-abc123"
  }
}
```

**Watch logs while testing:**
```bash
wrangler tail --config wrangler-smartapp.toml
```

You should see:
```
Received PING lifecycle event
Handling PING event
```

## 4. Check SmartThings Developer Workspace

### A. Verify Registration Status

1. Go to https://smartthings.developer.samsung.com/
2. Click **Workspace** → **Projects**
3. Find your **"HVAC Temperature Monitor"** project
4. Click on it

**Check these settings:**

#### Automation Settings
- **SmartApp Type**: Must be **"Webhook"**
- **Target URL**: Must exactly match your worker URL
  ```
  https://hvac-monitor.natebarksdale.workers.dev
  ```
- **Status**: Should show a green checkmark (verified)

If not verified:
- Click **"Verify"** button
- Watch `wrangler tail` for CONFIRMATION request
- Check that endpoint returns proper response

#### OAuth Settings
- For a basic SmartApp, you can skip OAuth (not required for device monitoring)
- If OAuth is enabled, it requires additional setup

### B. Check Deployment Status

**Self-Published Status:**
1. In your project, click **"Deploy to Test"** (not just "Register")
2. You should see: **"Self Published: Testing"**
3. Status should be **"Published"** not "Draft"

**Common Issue:** Just registering isn't enough - you must click "Deploy to Test"!

### C. Check App Visibility

1. In project settings, check **"App Visibility"**
2. For testing: Should be set to **"Hidden"** (only visible with developer mode)
3. Verify your Samsung account email is listed as a test user

## 5. Mobile App Troubleshooting (iOS)

### A. Verify Developer Mode

**Enable Developer Mode:**
1. Open SmartThings app
2. Go to **Menu (☰)** → **Settings**
3. Scroll to bottom → **About SmartThings**
4. Tap **"SmartThings Version"** 5 times quickly
5. You should see **"Developer Mode: ON"**

### B. Force Refresh App

**Option 1: Sign Out and Back In**
1. Menu → Settings → Sign Out
2. Close app completely (swipe up from app switcher)
3. Reopen app
4. Sign back in with same Samsung account

**Option 2: Clear App Cache**
1. iOS Settings → SmartThings
2. Clear cache if option available
3. Or delete and reinstall app (settings sync from cloud)

### C. Check for SmartApp

**Where to find it:**
1. **NOT** in "Devices" section
2. **NOT** in "Automations" section
3. **Try:** Menu → **"SmartApps"** (legacy location)
4. **Or:** Menu → **"Life"** → **"Automations"** → **"+"** → **"SmartApp"**
5. **Or:** Settings → **"Linked Services"** → Add new service

**SmartApp Categories:**
The app should appear under whatever category you set during registration. If you didn't set one, try:
- Menu → SmartApps → "More" or "Custom"
- Look for "HVAC Temperature Monitor" or "HVAC Monitor"

### D. Check Account Consistency

**Verify same account everywhere:**
1. SmartThings mobile app account
2. SmartThings Developer Workspace account
3. Samsung account used for SmartThings

All three MUST be the same email address!

## 6. Alternative: Use SmartThings CLI

The mobile app interface for SmartApps can be unreliable. Try using the CLI:

### Install SmartThings CLI

```bash
npm install -g @smartthings/cli
```

### Authenticate

```bash
smartthings login
```

### List Your SmartApps

```bash
smartthings apps
```

You should see your app listed. Note the `appId`.

### Install the SmartApp via CLI

```bash
smartthings apps:install <appId> --location=<locationId>
```

Get your location ID:
```bash
smartthings locations
```

## 7. Common SmartApp Registration Issues

### Issue: "Target URL verification failed"

**Cause:** Worker not responding correctly to CONFIRMATION request

**Fix:**
1. Verify worker is deployed: `curl https://hvac-monitor.natebarksdale.workers.dev/`
2. Check logs: `wrangler tail --config wrangler-smartapp.toml`
3. Test CONFIRMATION manually (see Section 3)

### Issue: "App not visible in mobile app"

**Cause:** App not deployed to test, or wrong account

**Fix:**
1. Click "Deploy to Test" in Developer Workspace (not just Register)
2. Verify developer mode is ON in mobile app
3. Ensure same Samsung account everywhere
4. Sign out/in to mobile app to refresh

### Issue: No logs in `wrangler tail`

**Cause:** No requests reaching the worker, or wrong worker

**Fix:**
1. Verify correct worker name: `wrangler list`
2. Check worker is deployed: `wrangler deployments list --config wrangler-smartapp.toml`
3. Test endpoint manually: `curl https://...`
4. Check Developer Workspace has correct URL

## 8. Debugging Workflow

**Step-by-step debugging:**

```bash
# Terminal 1: Watch logs
wrangler tail --config wrangler-smartapp.toml

# Terminal 2: Test endpoint
# Test 1: GET request (should return endpoint list)
curl https://hvac-monitor.natebarksdale.workers.dev/

# Test 2: PING request
curl -X POST https://hvac-monitor.natebarksdale.workers.dev/ \
  -H "Content-Type: application/json" \
  -d '{"lifecycle":"PING","pingData":{"challenge":"test"}}'

# Test 3: Check KV storage
wrangler kv:key list --binding=SMARTAPP_STORAGE --config wrangler-smartapp.toml
```

**If logs appear:** Worker is working!
**If no logs appear:** Worker isn't receiving requests - check URL in Developer Workspace

## 9. Starting Over (If Needed)

If you're stuck, here's the nuclear option:

```bash
# 1. Delete and recreate worker
wrangler delete hvac-monitor --config wrangler-smartapp.toml
wrangler deploy --config wrangler-smartapp.toml

# 2. In Developer Workspace:
#    - Delete the SmartApp project
#    - Create a new project
#    - Register webhook with new worker URL
#    - Deploy to Test

# 3. In mobile app:
#    - Sign out
#    - Clear app cache or reinstall
#    - Sign in
#    - Look for SmartApp
```

## 10. Success Indicators

**You'll know it's working when:**

1. ✅ `curl https://hvac-monitor.natebarksdale.workers.dev/` returns endpoint list
2. ✅ `wrangler tail` shows "Received PING lifecycle event" when you test
3. ✅ Developer Workspace shows green checkmark for webhook verification
4. ✅ Status shows "Self Published: Testing"
5. ✅ Mobile app shows the SmartApp in one of the menus
6. ✅ Installing the app shows device selection page
7. ✅ After installation, temperature events appear in logs

## Next Steps After It's Working

Once installed successfully, you should see:
```bash
# In wrangler tail
Received INSTALL lifecycle event
Creating N temperature subscriptions
Stored installation data for ...

# Shortly after (when temp changes):
Received EVENT lifecycle event
Temperature update: Device abc-123 = 72°F
```

Then test the API:
```bash
curl https://hvac-monitor.natebarksdale.workers.dev/temperatures
```

## Still Stuck?

Check these resources:
- [SmartThings Community](https://community.smartthings.com/)
- [SmartThings Developer Forums](https://community.smartthings.com/c/developer-programs/)
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)

Or share:
1. Output of: `curl https://hvac-monitor.natebarksdale.workers.dev/`
2. Output of: `wrangler list`
3. Screenshot of Developer Workspace registration page
4. Any errors in `wrangler tail`
