# Troubleshooting Guide

## White Screen Issues

### Local Development (localhost)

**Issue:** White screen when running `npm run dev`

**Fixed!** The `index.html` was referencing old built assets. This has been fixed in commit `41b2093`.

**To test locally:**
```bash
npm run dev
```

Open http://localhost:5173 - you should see the dashboard.

---

### Production Site (https://natebarksdale.xyz/experiments/hvac-control/)

**Issue:** White screen on live site

**Cause:** GitHub Actions deployment hasn't been set up yet, so the old (broken) version is still live.

**Solution:** Complete the GitHub Actions setup to deploy the fixed version.

#### Quick Setup Steps:

1. **Enable GitHub Pages**
   - Go to: https://github.com/natebarksdale/experiments/settings/pages
   - Under "Build and deployment"
   - Source: Select **"GitHub Actions"** (NOT "Deploy from a branch")
   - Click Save

2. **Add GitHub Secrets**
   - Go to: https://github.com/natebarksdale/experiments/settings/secrets/actions
   - Click "New repository secret" for each:

   | Name | Value |
   |------|-------|
   | `VITE_GOOGLE_SHEETS_API_KEY` | Your NEW Google Sheets API key |
   | `VITE_GOOGLE_CLIENT_ID` | `75675388492-bejhnig3igchno6js5eemqkng8h4qcfm.apps.googleusercontent.com` |
   | `VITE_IFTTT_WEBHOOK_KEY` | `czrIULp6_2rKCrSTv8L4Rz` |

3. **Trigger Deployment**
   - Go to: https://github.com/natebarksdale/experiments/actions
   - Click "Deploy to GitHub Pages" workflow
   - Click "Run workflow" → "Run workflow"
   - Wait ~2 minutes for build to complete

4. **Verify**
   - Visit: https://natebarksdale.xyz/experiments/hvac-control/
   - Should now show the dashboard!

---

## Common Errors

### "Missing environment variable"

**Symptom:** Build fails with error about missing VITE_* variable

**Solution:** Make sure all three secrets are added in GitHub Settings → Secrets → Actions

---

### "404 Not Found" on GitHub Pages

**Symptom:** Site shows 404 error instead of white screen

**Solution:**
1. Verify GitHub Pages source is set to "GitHub Actions"
2. Check that workflow completed successfully in Actions tab
3. May take 1-2 minutes after deployment for DNS to update

---

### OAuth Login Doesn't Work

**Symptom:** Can view dashboard but sign-in button doesn't work

**Solution:** Update Google OAuth authorized origins:
1. Go to: https://console.cloud.google.com/apis/credentials
2. Click your OAuth Client ID
3. Under "Authorized JavaScript origins", add:
   ```
   https://natebarksdale.xyz
   ```
4. Save and try again

---

### Console Errors About API Keys

**Symptom:** Browser console shows errors about invalid API keys

**Solutions:**

1. **For localhost:**
   - Check your `.env` file has valid keys
   - Make sure `.env` is in the project root (hvac-control/)
   - Restart dev server: `npm run dev`

2. **For production:**
   - Check GitHub Secrets are set correctly
   - Trigger a new deployment to pick up updated secrets

---

## Checking Deployment Status

### View Workflow Runs
1. Go to: https://github.com/natebarksdale/experiments/actions
2. Click on latest "Deploy to GitHub Pages" run
3. Check each step for errors:
   - ✅ Checkout (should be green)
   - ✅ Setup Node (should be green)
   - ✅ Install dependencies (should be green)
   - ✅ Build with environment variables (check for errors here)
   - ✅ Deploy to GitHub Pages (should be green)

### View Deployment Logs
Click on any step to see detailed logs. Common issues:
- Missing secrets → Add them in Settings → Secrets
- Build errors → Check the "Build with environment variables" step
- Permission errors → Check Pages permissions in repo settings

---

## Still Having Issues?

### Local Development
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install

# Try building locally
npm run build

# If build succeeds, try running
npm run preview
```

### Production Deployment
1. Check latest commit deployed: https://github.com/natebarksdale/experiments/commits/main
2. Check workflow status: https://github.com/natebarksdale/experiments/actions
3. Manually trigger deployment: Actions → Deploy to GitHub Pages → Run workflow

---

## Quick Reference

- **Local dev:** `npm run dev` → http://localhost:5173
- **Build test:** `npm run build` → check `dist/` folder
- **Preview build:** `npm run preview` → http://localhost:4173
- **Deploy:** Just `git push origin main` (after setup complete)

---

## Setup Documentation

For complete setup instructions, see:
- [GITHUB_PAGES_SETUP.md](./GITHUB_PAGES_SETUP.md) - GitHub Actions setup
- [SECURITY_CHECKLIST.md](./SECURITY_CHECKLIST.md) - API key rotation
- [DEPLOYMENT_SUMMARY.md](./DEPLOYMENT_SUMMARY.md) - Migration overview
