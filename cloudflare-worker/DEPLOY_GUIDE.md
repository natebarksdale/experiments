# Deploying the SmartApp Webhook Worker

You have two options for deploying the SmartApp webhook:

## Option 1: Deploy from Command Line (Recommended - Easiest)

This is the simplest way to deploy and avoids GitHub integration issues.

### Prerequisites

1. You have `wrangler` CLI installed: `npm install -g wrangler`
2. You're logged in: `wrangler login`
3. You have your account ID from: `wrangler whoami`

### Steps

1. **Update `wrangler-smartapp.toml` with your settings:**

```toml
name = "smartthings-hvac-webhook"
main = "smartapp-webhook-worker.js"
compatibility_date = "2024-01-01"

# Add your account ID here
account_id = "your-account-id-from-wrangler-whoami"

# Add your KV namespace here
[[kv_namespaces]]
binding = "SMARTAPP_STORAGE"
id = "your-kv-namespace-id"
```

2. **Create KV namespace if you haven't already:**

```bash
cd cloudflare-worker
wrangler kv:namespace create "SMARTAPP_STORAGE" --config wrangler-smartapp.toml
```

Copy the `id` from the output and add it to `wrangler-smartapp.toml`.

3. **Deploy using the script:**

```bash
cd cloudflare-worker
./deploy-smartapp.sh
```

Or manually:

```bash
cd cloudflare-worker
wrangler deploy --config wrangler-smartapp.toml
```

4. **Test the deployment:**

```bash
curl https://smartthings-hvac-webhook.YOUR-SUBDOMAIN.workers.dev/
```

You should see the endpoint list JSON response.

5. **Test POST request:**

```bash
curl -X POST https://smartthings-hvac-webhook.YOUR-SUBDOMAIN.workers.dev/ \
  -H "Content-Type: application/json" \
  -d @test-confirmation.json
```

You should see a proper JSON response with `pingData.challenge`.

6. **Watch logs:**

```bash
wrangler tail --config wrangler-smartapp.toml
```

---

## Option 2: Deploy via Cloudflare Dashboard (GitHub Integration)

If you want to use Cloudflare's GitHub integration for automatic deployments:

### Setup in Cloudflare Dashboard

1. Go to Cloudflare Dashboard → Workers & Pages
2. Click **"Create Application"** → **"Workers"** → **"Create Worker"**
3. Give it a name: `smartthings-hvac-webhook`
4. Click **"Deploy"** (this creates a dummy worker)
5. Go to **Settings** → **"Triggers"** and note your worker URL

### Connect to GitHub

1. In your worker settings, go to **"Deployments"**
2. Click **"Connect to Git"**
3. Select your repository: `natebarksdale/experiments`
4. Configure build settings:
   - **Production branch**: `main` (or your preferred branch)
   - **Build command**: Leave empty
   - **Root directory**: `cloudflare-worker`
   - Click **"Advanced"** → **"Add variable"**
     - Add `CLOUDFLARE_ACCOUNT_ID` = your account ID

### Create wrangler.toml for GitHub Integration

The GitHub integration looks for `wrangler.toml` in the root directory. Since ours is in a subdirectory with a custom name, we need to either:

**A. Rename the config file:**
```bash
cd cloudflare-worker
mv wrangler-smartapp.toml wrangler.toml
```

**B. Or create a symlink:**
```bash
cd cloudflare-worker
ln -s wrangler-smartapp.toml wrangler.toml
```

### Configure Custom Build Command

In Cloudflare Dashboard → Worker Settings → Builds & Deployments:

- **Root directory**: `cloudflare-worker`
- **Build command**: `echo "No build needed"`
- **Deploy command**: `npx wrangler deploy`

### Add KV Namespace Binding

1. Go to Worker Settings → **"Variables and Secrets"**
2. Under **"KV Namespace Bindings"**, click **"Add binding"**
3. **Variable name**: `SMARTAPP_STORAGE`
4. **KV namespace**: Select or create your KV namespace

---

## Which Option Should You Use?

### Use Command Line (Option 1) if:
- ✅ You want quick, simple deployment
- ✅ You don't need automatic deployments on git push
- ✅ You're okay with manual deploys when you update code

### Use GitHub Integration (Option 2) if:
- ✅ You want automatic deployments when you push to GitHub
- ✅ You want deployment history and rollbacks in Cloudflare dashboard
- ✅ You're comfortable setting up the build configuration

**Recommendation**: Start with **Option 1 (Command Line)** to get it working quickly, then switch to Option 2 later if you want automatic deployments.

---

## Troubleshooting

### "Missing entry-point to Worker script"

This means wrangler can't find the config file. Make sure:
- You're in the `cloudflare-worker` directory
- The file `wrangler-smartapp.toml` (or `wrangler.toml`) exists
- You're using `--config wrangler-smartapp.toml` if using custom name

### "account_id is required"

Add your account ID to the config file:
```bash
wrangler whoami  # Get your account ID
```

Then edit `wrangler-smartapp.toml`:
```toml
account_id = "paste-id-here"
```

### "KV namespace not found"

Create it:
```bash
wrangler kv:namespace create "SMARTAPP_STORAGE" --config wrangler-smartapp.toml
```

Add the ID to your config file.

### GitHub deployment fails with "Missing entry-point"

The root directory is wrong. In Cloudflare dashboard:
- Set **Root directory** to `cloudflare-worker`
- Or create a `wrangler.toml` in the repo root that points to the subdirectory

---

## After Deployment

1. **Update SmartThings Developer Workspace:**
   - Go to your SmartApp project
   - Update Target URL to your worker URL
   - Click **"Verify"** - watch logs with `wrangler tail`

2. **Deploy to Test:**
   - Click **"Deploy to Test"** in Developer Workspace
   - Check for "Self Published: Testing" status

3. **Install in Mobile App:**
   - Sign out and back in to SmartThings app
   - Look for your SmartApp
   - Install and select temperature sensors

4. **Verify Events:**
   - Watch logs: `wrangler tail --config wrangler-smartapp.toml`
   - You should see INSTALL, then EVENT lifecycle events
   - Test API: `curl https://your-worker-url/temperatures`

---

## Quick Start Summary

```bash
# 1. Setup
cd cloudflare-worker
wrangler login

# 2. Create KV namespace
wrangler kv:namespace create "SMARTAPP_STORAGE" --config wrangler-smartapp.toml

# 3. Edit wrangler-smartapp.toml
# - Add account_id
# - Add KV namespace id

# 4. Deploy
./deploy-smartapp.sh
# Or: wrangler deploy --config wrangler-smartapp.toml

# 5. Test
curl https://smartthings-hvac-webhook.YOUR-SUBDOMAIN.workers.dev/

# 6. Watch logs
wrangler tail --config wrangler-smartapp.toml
```

That's it! Your SmartApp webhook is deployed and ready to receive SmartThings events.
