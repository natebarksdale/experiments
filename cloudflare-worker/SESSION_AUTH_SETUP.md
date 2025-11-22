# Persistent Session Authentication Setup

Upgrade your HVAC Control authentication to use server-side sessions for **much longer login persistence** (6 months vs 1 hour).

## Why Upgrade?

**Current System (Access Tokens)**:
- ❌ Login expires after ~1 hour
- ❌ Silent refresh often fails
- ❌ Must re-login frequently
- ❌ Access tokens exposed in frontend

**New System (Server Sessions)**:
- ✅ Sessions last up to 6 months
- ✅ Automatic token refresh (server-side)
- ✅ Refresh tokens stored securely in Cloudflare KV
- ✅ Zero tokens in frontend code
- ✅ Seamless re-authentication

## Prerequisites

1. Cloudflare account with Workers
2. Basic HVAC proxy already deployed (from `HVAC_PROXY_SETUP.md`)
3. Google Cloud project with OAuth 2.0 credentials

## Step 1: Create KV Namespace

KV (Key-Value) storage will hold session data and refresh tokens.

```bash
# Login to Cloudflare
wrangler login

# Create KV namespace
wrangler kv:namespace create "hvac-sessions"
```

This will output something like:
```
 ⛅️ wrangler 3.0.0
------------------
🌀 Creating namespace with title "hvac-sessions"
✨ Success!
Add the following to your configuration file in your kv_namespaces array:
{ binding = "SESSIONS", id = "abc123def456..." }
```

**Copy the ID** - you'll need it next.

## Step 2: Update Wrangler Configuration

Edit `wrangler-hvac-sessions.toml`:

```toml
account_id = "your-account-id-here"

[[kv_namespaces]]
binding = "SESSIONS"
id = "abc123def456..."  # ← Paste your KV namespace ID here
```

## Step 3: Get Google OAuth Client Secret

The current setup only uses the Client ID. For server-side OAuth, you also need the Client Secret.

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Find your OAuth 2.0 Client ID
3. Click to view details
4. **Copy the Client Secret** (you already have the Client ID)

## Step 4: Configure OAuth Redirect URI

1. Still in Google Cloud Console → OAuth Client ID settings
2. Under **Authorized redirect URIs**, add:
   ```
   https://hvac-control-proxy-sessions.your-subdomain.workers.dev/auth/callback
   ```
   (Replace with your actual worker URL after deployment)

3. Click **Save**

## Step 5: Set Worker Secrets

Set all required secrets for the session-enabled worker:

```bash
cd cloudflare-worker

# Existing secrets
wrangler secret put SMARTTHINGS_TOKEN --config wrangler-hvac-sessions.toml
wrangler secret put IFTTT_WEBHOOK_KEY --config wrangler-hvac-sessions.toml

# New secrets for OAuth
wrangler secret put GOOGLE_CLIENT_ID --config wrangler-hvac-sessions.toml
# Paste your Google OAuth Client ID

wrangler secret put GOOGLE_CLIENT_SECRET --config wrangler-hvac-sessions.toml
# Paste your Google OAuth Client Secret

wrangler secret put OAUTH_REDIRECT_URI --config wrangler-hvac-sessions.toml
# Paste: https://hvac-control-proxy-sessions.your-subdomain.workers.dev/auth/callback
```

## Step 6: Deploy the Session Worker

```bash
wrangler deploy --config wrangler-hvac-sessions.toml
```

Note the deployed URL, e.g.:
```
https://hvac-control-proxy-sessions.abc123.workers.dev
```

## Step 7: Update Frontend Configuration

### Option A: Replace Existing Auth (Recommended)

Rename `auth.js` to `auth-legacy.js` and `auth-sessions.js` to `auth.js`:

```bash
cd hvac-control/src/services
mv auth.js auth-legacy.js
mv auth-sessions.js auth.js
```

### Option B: Gradual Migration

Keep both files and update imports manually in `App.jsx`.

### Update Environment Variables

Update `.env` (or GitHub secrets for production):

```env
# Enable proxy and set URL to session-enabled worker
VITE_USE_PROXY=true
VITE_PROXY_URL=https://hvac-control-proxy-sessions.abc123.workers.dev

# Still needed for development mode
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com

# No longer needed in production (now in worker)
# VITE_SMARTTHINGS_TOKEN=  (remove or leave empty)
# VITE_IFTTT_WEBHOOK_KEY=  (remove or leave empty)
```

## Step 8: Update App.jsx for OAuth Callback

Add callback handling to `App.jsx`:

```javascript
import { isOAuthCallback, handleOAuthCallback } from './services/auth';

function App() {
  // ... existing state

  useEffect(() => {
    // Handle OAuth callback
    if (isOAuthCallback()) {
      handleOAuthCallback()
        .then(() => {
          // Redirect to clean URL
          window.history.replaceState({}, document.title, window.location.pathname);
          setAuthenticated(true);
          loadData();
        })
        .catch(err => {
          console.error('OAuth callback failed:', err);
          alert('Authentication failed. Please try again.');
        });
    } else {
      // Normal initialization
      initializeAuth()
        .then(() => setAuthenticated(isAuthenticated()))
        .catch(console.error);
    }
  }, []);

  // ... rest of component
}
```

## Step 9: Test the Flow

### Local Development

1. Start dev server:
   ```bash
   npm run dev
   ```

2. Open app in browser
3. Click "Sign In"
4. Should redirect to Google OAuth
5. After authorization, redirects to worker callback
6. Worker exchanges code for tokens
7. Redirects back to app with session ID
8. You're signed in!

### Verify Session Persistence

1. Sign in
2. Close browser
3. Open browser again (hours or days later)
4. App should still be signed in
5. Session lasts up to 6 months!

## Step 10: Deploy to Production

### GitHub Secrets

Update these secrets in your repository:

1. **`VITE_USE_PROXY`**: Set to `true`
2. **`VITE_PROXY_URL`**: Your session worker URL
3. **Remove or empty**: `VITE_SMARTTHINGS_TOKEN`, `VITE_IFTTT_WEBHOOK_KEY`

### Deploy

```bash
git add .
git commit -m "Upgrade to persistent session authentication"
git push origin main
```

## How It Works

### Sign In Flow

1. User clicks "Sign In"
2. Frontend redirects to Google OAuth
3. Google redirects to worker `/auth/callback` with authorization code
4. Worker exchanges code for access token + **refresh token**
5. Worker stores refresh token in KV with session ID
6. Worker redirects back to frontend with session ID
7. Frontend stores session ID (not tokens!)

### Automatic Token Refresh

1. Frontend makes API call through proxy
2. Proxy checks if access token is valid
3. If expired, proxy uses refresh token to get new access token
4. All automatic - no user interaction needed
5. Refresh tokens last 6 months

### Data Storage

- **Frontend**: Session ID only (no tokens)
- **Cloudflare KV**: Refresh tokens (encrypted at rest)
- **Worker Memory**: Access tokens (temporary)
- **Never exposed**: API keys, refresh tokens, access tokens

## Monitoring

View worker logs to see auth activity:

```bash
wrangler tail --config wrangler-hvac-sessions.toml
```

Look for:
- OAuth callbacks
- Session checks
- Token refreshes
- Authentication errors

## Troubleshooting

### "Session invalid or expired"

- Session was manually deleted from KV
- Refresh token revoked by user
- 6 month session expired
- **Solution**: Sign in again

### "Failed to complete authentication"

- Check Google OAuth redirect URI is configured correctly
- Verify worker secrets are set (especially `GOOGLE_CLIENT_SECRET`)
- Check worker logs for detailed error

### OAuth redirect loops

- Clear `oauth_state` from localStorage
- Verify redirect URI matches exactly in Google Console and worker config

### Session not persisting

- Check `session_id` is in localStorage
- Verify KV namespace is correctly bound in wrangler.toml
- Check worker logs during session check

## Cost

With Cloudflare free tier:
- **Workers**: 100,000 requests/day (plenty)
- **KV**: 100,000 reads/day, 1,000 writes/day
- **Typical usage**: ~50 reads/day per user (checking session)
- **Well within free tier** for personal use

## Reverting to Old System

If you need to revert:

```bash
cd hvac-control/src/services
mv auth.js auth-sessions-new.js
mv auth-legacy.js auth.js
```

Update `.env`:
```env
VITE_USE_PROXY=false
# Restore token values
```

## Security Benefits

- ✅ No tokens in frontend code
- ✅ Refresh tokens encrypted in KV
- ✅ Access tokens short-lived (1 hour)
- ✅ Session IDs can be revoked instantly
- ✅ OAuth flow server-side
- ✅ State parameter prevents CSRF

## Next Steps

Once working:
1. Monitor for a week to ensure stability
2. Can remove old auth files
3. Enjoy not having to re-login constantly!
