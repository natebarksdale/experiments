# GitHub Pages Deployment Setup

## Overview
This project is now configured to automatically build and deploy to GitHub Pages using GitHub Actions. The workflow:
1. Triggers on every push to `main`
2. Builds the app with secrets from GitHub Secrets
3. Deploys the built files to GitHub Pages
4. **Never commits built files to the repository**

## Initial Setup (One-Time)

### 1. Enable GitHub Pages

1. Go to your repository: https://github.com/natebarksdale/experiments
2. Navigate to **Settings** → **Pages**
3. Under "Build and deployment":
   - **Source**: Select "GitHub Actions"
   - (Not "Deploy from a branch")

### 2. Add GitHub Secrets

Go to **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

Add these three secrets:

| Secret Name | Value | Where to Get It |
|------------|-------|-----------------|
| `VITE_GOOGLE_SHEETS_API_KEY` | Your NEW Google Sheets API key | https://console.cloud.google.com/apis/credentials |
| `VITE_GOOGLE_CLIENT_ID` | `75675388492-bejhnig3igchno6js5eemqkng8h4qcfm.apps.googleusercontent.com` | Already have this |
| `VITE_IFTTT_WEBHOOK_KEY` | `czrIULp6_2rKCrSTv8L4Rz` (or new key if rotated) | https://ifttt.com/maker_webhooks/settings |

**Important:** Use your **NEW** Google Sheets API key (the one you just created to replace the exposed key).

### 3. Update OAuth Authorized Origins

Since the app will now be served from GitHub Pages, update Google OAuth settings:

1. Go to https://console.cloud.google.com/apis/credentials
2. Click on your OAuth Client ID
3. Under "Authorized JavaScript origins", add:
   ```
   https://natebarksdale.xyz
   ```
4. Under "Authorized redirect URIs", add (if needed):
   ```
   https://natebarksdale.xyz/experiments/hvac-control/
   ```

## How It Works

### Automatic Deployment

Once set up, deployment is automatic:

```bash
# Make changes to your code
git add .
git commit -m "Update feature"
git push origin main

# GitHub Actions will:
# 1. Check out the code
# 2. Install dependencies
# 3. Build with secrets from GitHub Secrets
# 4. Deploy to GitHub Pages
# 5. Your site updates automatically!
```

### Manual Deployment

You can also trigger a deployment manually:

1. Go to **Actions** tab in GitHub
2. Select "Deploy to GitHub Pages" workflow
3. Click "Run workflow"

## Monitoring Deployments

1. Go to the **Actions** tab in your GitHub repo
2. Click on any workflow run to see:
   - Build logs
   - Deploy status
   - Any errors

## Your Site URL

After the first successful deployment, your app will be live at:
```
https://natebarksdale.xyz/experiments/hvac-control/
```

## Local Development

For local development, you still use `.env`:

```bash
# .env file (already set up)
VITE_GOOGLE_SHEETS_API_KEY=your_new_key
VITE_GOOGLE_CLIENT_ID=75675388492-bejhnig3igchno6js5eemqkng8h4qcfm.apps.googleusercontent.com
VITE_IFTTT_WEBHOOK_KEY=czrIULp6_2rKCrSTv8L4Rz

# Run locally
npm run dev
```

## Security Benefits

✅ **Secrets never committed to git** - Only stored in GitHub Secrets
✅ **Build happens on GitHub servers** - Your local `.env` stays local
✅ **Automatic builds** - No manual deployment script needed
✅ **Version control** - Every deployment is tied to a commit
✅ **Rollback capability** - Revert to any previous commit to redeploy

## Removing Old Deployment Method

The old `deploy.sh` script is no longer needed. You can either:

1. **Delete it:**
   ```bash
   git rm deploy.sh
   git commit -m "Remove old deployment script"
   git push
   ```

2. **Or keep it** as documentation, but don't use it anymore

## Troubleshooting

### Build fails with "Missing environment variable"
- Make sure all three secrets are added in GitHub Settings → Secrets

### OAuth login doesn't work on deployed site
- Verify authorized origins include `https://natebarksdale.xyz`

### Changes don't appear after push
- Check the Actions tab for workflow status
- Build might be in progress (takes 1-2 minutes)

### 404 error on GitHub Pages
- Ensure GitHub Pages source is set to "GitHub Actions" (not "Deploy from a branch")
- Check that the workflow completed successfully

## First Deployment

To trigger your first deployment:

```bash
git add .github/workflows/deploy.yml GITHUB_PAGES_SETUP.md
git commit -m "Add GitHub Actions deployment workflow"
git push origin main
```

Then:
1. Add the three secrets in GitHub Settings
2. Watch the Actions tab for the deployment
3. Your site will be live in ~2 minutes!
