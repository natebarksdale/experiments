# 🚨 CRITICAL: Enable GitHub Actions for Deployment

## Current Problem

Your GitHub Pages is set to **"Deploy from a branch"** which runs Jekyll (a static site generator). This doesn't build your Vite app - it just converts markdown files to HTML.

That's why you see a white screen!

## The Fix (Takes 30 seconds)

### Step 1: Go to Repository Settings
Visit: **https://github.com/natebarksdale/experiments/settings/pages**

### Step 2: Change the Source
Look for the **"Build and deployment"** section:

**Current (WRONG):**
```
Source: Deploy from a branch ❌
Branch: main
```

**Change to (CORRECT):**
```
Source: GitHub Actions ✅
```

### Step 3: Click Save
- After selecting "GitHub Actions", the page will automatically save
- You should see: "Your site is live at https://natebarksdale.xyz/"

### Step 4: Wait for Build
1. Go to: https://github.com/natebarksdale/experiments/actions
2. You should see a new workflow run starting
3. Look for: "Deploy to GitHub Pages" workflow (NOT "pages build and deployment")
4. Click on it to watch the build
5. Should see these steps:
   - ✅ Checkout
   - ✅ Inject API Key (for travel-guide.js)
   - ✅ Setup Node.js for HVAC Control ← NEW!
   - ✅ Install dependencies for HVAC Control ← NEW!
   - ✅ Build HVAC Control app ← NEW!
   - ✅ Copy HVAC Control build to deployment directory
   - ✅ Upload artifact
   - ✅ Deploy to GitHub Pages

### Step 5: Verify
After ~2-3 minutes:
- Visit: https://natebarksdale.xyz/experiments/hvac-control/
- Should see the HVAC dashboard (not white screen!)

---

## Why This Happened

GitHub Pages has two deployment modes:

### Mode 1: Deploy from a branch (what you have now)
- Uses Jekyll to convert markdown to HTML
- Ignores your custom workflow
- Doesn't build Vite apps
- **Result:** White screen because no app is built

### Mode 2: GitHub Actions (what you need)
- Runs your custom `.github/workflows/deploy.yml`
- Builds the Vite app with npm
- Deploys the built files
- **Result:** Working app!

---

## Visual Guide

### Finding the Setting

1. Click on your repository: **experiments**
2. Click **Settings** (top right, near Code/Pull requests)
3. Scroll down the left sidebar to **Pages** (under "Code and automation")
4. Look for "Build and deployment" section
5. Click the **Source** dropdown
6. Select **GitHub Actions**
7. Done!

### What You Should See After Changing

Before:
```
┌─────────────────────────────────────┐
│ Build and deployment                │
│                                     │
│ Source: [Deploy from a branch ▼]   │  ← CHANGE THIS
│                                     │
│ Branch: [main ▼] [/(root) ▼]      │
└─────────────────────────────────────┘
```

After:
```
┌─────────────────────────────────────┐
│ Build and deployment                │
│                                     │
│ Source: [GitHub Actions ▼]         │  ← CORRECT!
│                                     │
│ Use a workflow from your repository │
└─────────────────────────────────────┘
```

---

## Still Not Working?

### If you don't see "GitHub Actions" in the dropdown:
- Make sure the `.github/workflows/deploy.yml` file exists in your repository
- It should be at the root level, not in a subdirectory
- Refresh the page and try again

### If the build fails with "Missing environment variable":
You need to add GitHub Secrets:
1. Go to: https://github.com/natebarksdale/experiments/settings/secrets/actions
2. Add these three secrets:
   - `VITE_GOOGLE_SHEETS_API_KEY`
   - `VITE_GOOGLE_CLIENT_ID`
   - `VITE_IFTTT_WEBHOOK_KEY`
3. See [GITHUB_PAGES_SETUP.md](./GITHUB_PAGES_SETUP.md) for details

### If it still shows white screen after successful build:
- Check browser console for errors (F12 → Console tab)
- Verify the build deployed the right files:
  - Visit: https://natebarksdale.xyz/experiments/hvac-control/
  - View page source (Ctrl+U or Cmd+U)
  - Should see `<script>` tags with hashed filenames like `index-xyz123.js`

---

## Quick Summary

**Problem:** GitHub using Jekyll instead of your Vite build workflow

**Solution:** Change "Deploy from a branch" → "GitHub Actions" in Pages settings

**Where:** https://github.com/natebarksdale/experiments/settings/pages

**Time:** 30 seconds to change + 2 minutes for build

Do this now and your site will work! 🎉
