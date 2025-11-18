# 🔐 Security Incident Response - API Key Exposure

## What Happened
GitHub's secret scanning detected your Google Sheets API key in committed files (`assets/index-*.js` and `dist/assets/index-*.js`). These files were compiled JavaScript bundles that contained hardcoded API keys.

## Immediate Actions Completed ✅

1. **Removed hardcoded secrets from source code**
   - Moved `IFTTT_KEY` to environment variable `VITE_IFTTT_WEBHOOK_KEY`
   - Already using env var for Google API key

2. **Removed exposed files from git**
   - Deleted `assets/*.js` and `assets/*.css` from repository
   - Deleted `dist/` folder from repository
   - Updated `.gitignore` to prevent future commits

3. **Fixed deployment process**
   - Updated `deploy.sh` to NOT commit built files
   - Added warnings about environment variables in build outputs

4. **Pushed security fixes to GitHub**
   - All exposed files removed from repository
   - Commit: 35e25ae

## Required Actions (DO THESE NOW) ⚠️

### 1. Rotate Google Sheets API Key
The exposed key was: `AIzaSyBvIhg3tlCoAmcroUkwXGij__WsB1aLuDc`

**Steps:**
1. Go to: https://console.cloud.google.com/apis/credentials
2. Find the exposed API key
3. Click "DELETE" or "DISABLE" to revoke it
4. Create a NEW API key
5. Add API restrictions:
   - Restrict to "Google Sheets API" only
   - Add HTTP referrer restrictions (e.g., `natebarksdale.xyz/*`)
6. Update your `.env` file with the new key:
   ```bash
   VITE_GOOGLE_SHEETS_API_KEY=<your_new_key>
   ```

### 2. Consider Rotating IFTTT Webhook Key
The exposed key was: `czrIULp6_2rKCrSTv8L4Rz`

**Steps:**
1. Go to: https://ifttt.com/maker_webhooks/settings
2. Click "Regenerate Key" (this will break existing applets temporarily)
3. Update all webhook URLs in your IFTTT applets
4. Update your `.env` file with the new key:
   ```bash
   VITE_IFTTT_WEBHOOK_KEY=<your_new_key>
   ```

### 3. Check Security Logs
- Review Google Cloud Console audit logs for unauthorized API usage
- Check your IFTTT activity log for suspicious triggers

### 4. Close GitHub Alert
After rotating keys, go to the GitHub security alert and mark it as "Resolved" or "Revoked"

## Why This Happened

The issue was caused by:
1. Your deployment script (`deploy.sh`) was copying built files to the repo root
2. The `.gitignore` had an override (`!/assets`) that allowed built files to be committed
3. Vite bundles all environment variables into the compiled JavaScript
4. These compiled files were committed and pushed to a public repository

## Prevention for Future

### ✅ Already Implemented
- Environment variables for all secrets
- `.gitignore` updated to exclude build outputs
- Deployment script no longer commits built files

### 🚀 Recommended Next Steps
1. **Use a deployment service** instead of committing built files:
   - **Netlify**: Auto-builds from source, supports environment variables
   - **Vercel**: Same as Netlify
   - **GitHub Pages** with GitHub Actions: Build on push, deploy without committing

2. **Add API key restrictions** in Google Cloud Console:
   - HTTP referrer restrictions
   - API restrictions (Sheets API only)
   - Usage quotas

3. **Consider server-side API** for sensitive operations:
   - Use a backend service (Netlify Functions, Vercel Edge, etc.)
   - Keep API keys server-side
   - Frontend calls your backend, backend calls Google/IFTTT

## Current Deployment Status

Your app is currently using environment variables properly. To deploy:

```bash
# 1. Make sure .env has valid keys
npm run build

# 2. Upload these files to your web server:
#    - index.html
#    - assets/ (entire directory)

# DO NOT commit these files to git!
```

## Questions?
- GitHub Secret Scanning Docs: https://docs.github.com/en/code-security/secret-scanning
- Google API Key Best Practices: https://cloud.google.com/docs/authentication/api-keys
