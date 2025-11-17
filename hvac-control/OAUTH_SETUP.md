# OAuth 2.0 Setup Guide

This guide walks you through setting up Google OAuth 2.0 authentication for your HVAC Control app, enabling you to update your Google Sheets from the web interface.

## Why OAuth?

- **API Keys** allow read-only access to public sheets
- **OAuth 2.0** enables secure read/write access to your personal sheets
- Users authenticate with their Google account, no password sharing needed

## Step-by-Step Setup

### 1. Create a Google Cloud Project

1. Visit [Google Cloud Console](https://console.cloud.google.com/)
2. Click the project dropdown at the top
3. Click **New Project**
4. Name it: `HVAC Control` (or your preference)
5. Click **Create**
6. Wait for the project to be created (notification will appear)

### 2. Enable Google Sheets API

1. In your new project, go to **Navigation Menu (☰) > APIs & Services > Library**
2. Search for "Google Sheets API"
3. Click on **Google Sheets API**
4. Click **Enable**

### 3. Create API Key (Read Access)

1. Go to **Navigation Menu (☰) > APIs & Services > Credentials**
2. Click **+ CREATE CREDENTIALS** at the top
3. Select **API key**
4. Copy the generated API key
5. Click **Close** (or optionally restrict the key to Google Sheets API only)

### 4. Configure OAuth Consent Screen

1. Still in **Credentials**, click **OAuth consent screen** in the left sidebar
2. Choose **External** user type
3. Click **Create**

**App Information:**
- App name: `Home Climate Control`
- User support email: Your email address
- App logo: (optional, skip for now)

**App domain:** (optional, skip for now)

**Developer contact information:**
- Email addresses: Your email

4. Click **Save and Continue**

**Scopes:**
5. Click **Add or Remove Scopes**
6. Filter for "sheets"
7. Check the box for: `https://www.googleapis.com/auth/spreadsheets`
8. Click **Update**
9. Click **Save and Continue**

**Test users:**
10. Click **Add Users**
11. Enter your Gmail address (the one that owns the sheet)
12. Click **Add**
13. Click **Save and Continue**
14. Review summary and click **Back to Dashboard**

### 5. Create OAuth 2.0 Client ID

1. Go back to **Credentials** (left sidebar)
2. Click **+ CREATE CREDENTIALS** at the top
3. Select **OAuth client ID**
4. Choose **Web application** as application type

**Configuration:**
- Name: `Home Climate Control Web Client`

**Authorized JavaScript origins:**
- Click **+ Add URI**
- Add: `http://localhost:5173`
- (If deploying to production, add your production URL here too, e.g., `https://hvac.yourdomain.com`)

**Authorized redirect URIs:**
- Leave this blank (not needed for our token-based flow)

5. Click **Create**
6. **Copy the Client ID** from the popup
   - It will look like: `123456789-abcdefg.apps.googleusercontent.com`
7. Click **OK**

### 6. Configure Your App

1. In your project folder, copy the example env file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your credentials:
   ```env
   VITE_GOOGLE_SHEETS_API_KEY=AIza...your_api_key...
   VITE_GOOGLE_CLIENT_ID=123456789-abcdefg.apps.googleusercontent.com
   ```

3. **Important**: Restart your development server for env changes to take effect:
   ```bash
   # Stop the current server (Ctrl+C)
   npm run dev
   ```

### 7. Configure Sheet Permissions

1. Open your Google Sheet (ID: `1W12hiuSTZSzDNrcuf9RxCYmQcKJxmm_WCQ9`)
2. Click **Share** button (top right)
3. For API key read access:
   - Change "Restricted" to **Anyone with the link**
   - Set to **Viewer**
4. For OAuth write access:
   - Add your Gmail address
   - Set to **Editor**
5. Click **Done**

## Testing OAuth

1. Open your app at `http://localhost:5173`
2. You should see a **Sign In** button in the header
3. Click **Sign In**
4. Google OAuth popup will appear
5. Select your Google account
6. You'll see a warning "Google hasn't verified this app" (because it's in testing mode)
7. Click **Continue** (or "Advanced" → "Go to Home Climate Control (unsafe)")
8. Review permissions: "See, edit, create, and delete your spreadsheets in Google Drive"
9. Click **Allow**
10. You should now be signed in!
11. Try clicking a zone card and changing settings
12. Click **Apply Changes**
13. Check your Google Sheet's Control tab to see the updates

## Troubleshooting

### "OAuth client ID not configured" Error

- Make sure you added `VITE_GOOGLE_CLIENT_ID` to `.env`
- Restart your dev server after adding env variables

### "redirect_uri_mismatch" Error

- Verify `http://localhost:5173` is in your OAuth client's "Authorized JavaScript origins"
- Make sure there are no trailing slashes
- Port must match exactly (5173)

### "Access denied" or Permission Errors

- Ensure your Google account is added as a test user in OAuth consent screen
- Verify the scope `https://www.googleapis.com/auth/spreadsheets` is configured
- Check that you're signed in with the same Google account that has Editor access to the sheet

### OAuth Popup Blocked

- Allow popups for `localhost:5173` in your browser
- Try clicking Sign In again

### Changes Not Appearing in Sheet

- Verify your sheet has the Control tab with columns D, E, and B
- Check browser console for API errors
- Ensure you're signed in (check for Sign Out button)
- Your OAuth token may have expired - try signing out and in again

## Production Deployment

When deploying to production:

1. Add your production domain to OAuth client's "Authorized JavaScript origins"
   - Example: `https://hvac.yourdomain.com`
2. Update your `.env` (or hosting provider's env vars) with the same credentials
3. Consider publishing your OAuth consent screen (requires Google verification for public apps)
   - Not needed if only you will use the app
4. Keep your `.env` file secure and never commit it to version control

## Security Notes

- **Client ID is public**: It's safe to expose in your frontend code
- **API Key**: Restrict it to only the Sheets API in Google Cloud Console
- **OAuth tokens**: Stored in browser localStorage, expire after ~1 hour
- **Sheet access**: Only users you explicitly grant Editor access can modify the sheet
- **Test mode**: While in OAuth testing mode, only test users can sign in (perfect for personal use)

## Need Help?

- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Google Sheets API Documentation](https://developers.google.com/sheets/api)
- Check browser console for detailed error messages
