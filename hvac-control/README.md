# Home Climate Control

A beautiful, analog-inspired web interface for managing your home's HVAC system with real-time SmartThings integration.

## Features

- **Dashboard View**: Visual representation of your home's layout with all HVAC zones
- **Real-time Monitoring**: Live temperature readings directly from SmartThings API
- **Control Panel**: Adjust power and mode settings for each zone
- **History Log**: View historical HVAC activity across all zones
- **Dual Data Sources**: SmartThings API for temperatures (source of truth), Google Sheets for control settings
- **Responsive Design**: Works on desktop and mobile devices

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure SmartThings API (PRIMARY - for temperature readings)

#### A. Get SmartThings Personal Access Token

1. Go to [SmartThings Tokens](https://account.smartthings.com/tokens)
2. Click **Generate new token**
3. Give it a name (e.g., "HVAC Control Dashboard")
4. Select these permissions:
   - ✅ **r:devices:\*** - List all devices
   - ✅ **r:devices:\*:status** - See device status
   - ✅ **r:locations:\*** - Read locations (optional but recommended)
5. Copy the token (you won't be able to see it again!)

This token is used to fetch **real-time temperature readings** directly from your SmartThings thermostats.

### 3. Configure Google Cloud Project & OAuth (for control settings)

#### A. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Go to **APIs & Services > Library**
4. Search for and enable **Google Sheets API**

#### B. Create API Key (for reading data)

1. Go to **APIs & Services > Credentials**
2. Click **Create Credentials > API Key**
3. Copy the API key

#### C. Create OAuth 2.0 Client ID (for writing data)

1. Still in **APIs & Services > Credentials**
2. Click **Create Credentials > OAuth client ID**
3. If prompted, configure the OAuth consent screen:
   - User Type: **External**
   - App name: `Home Climate Control` (or your choice)
   - User support email: Your email
   - Developer contact: Your email
   - Add scope: `https://www.googleapis.com/auth/spreadsheets`
   - Add yourself as a test user
4. Create OAuth Client ID:
   - Application type: **Web application**
   - Name: `Home Climate Control Web Client`
   - Authorized JavaScript origins:
     - `http://localhost:5173` (for development)
     - Add your production domain when deploying
   - No need to add redirect URIs (using token client)
5. Copy the **Client ID** (looks like `xxxxx.apps.googleusercontent.com`)

#### D. Get IFTTT Webhook Key (for light control)

1. Go to [IFTTT Maker Webhooks](https://ifttt.com/maker_webhooks/settings)
2. Copy your webhook key from the URL (the part after `/use/`)
3. Create IFTTT applets for each light (see light configuration below)

#### E. Configure Environment Variables

```bash
cp .env.example .env
```

Edit `.env` and add all four credentials:
```
VITE_SMARTTHINGS_TOKEN=your_smartthings_token_here
VITE_GOOGLE_SHEETS_API_KEY=your_api_key_here
VITE_GOOGLE_CLIENT_ID=your_oauth_client_id.apps.googleusercontent.com
VITE_IFTTT_WEBHOOK_KEY=your_ifttt_key_here
```

### 3. Configure Google Sheet Permissions

Your Google Sheet needs appropriate permissions:

1. Open your Google Sheet
2. Click "Share" in the top right
3. For **read access** (API key): Set to "Anyone with the link" → Viewer
4. For **write access** (OAuth): Add your Google account with Editor permission

**Note**: OAuth will request permission to access your sheets when you sign in for the first time.

## Development

Start the development server:

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### Using the App

1. **View Mode** (no sign-in required): You can view all zone temperatures and status
2. **Control Mode** (requires sign-in): Click "Sign In" to authenticate with Google OAuth
   - First time: You'll see a consent screen asking to access your Google Sheets
   - Click "Allow" to grant permission
   - Once signed in, you can click any zone to open the control panel
   - Make changes to power/mode and click "Apply Changes"
   - Changes will be written to your Google Sheet's Control tab

## Deployment

This project uses **GitHub Actions** to automatically build and deploy to GitHub Pages.

### Setup (One-Time)

See [GITHUB_PAGES_SETUP.md](./GITHUB_PAGES_SETUP.md) for detailed setup instructions.

Quick summary:
1. Enable GitHub Pages in repository settings (Source: "GitHub Actions")
2. Add four secrets to GitHub repository settings:
   - `VITE_SMARTTHINGS_TOKEN`
   - `VITE_GOOGLE_SHEETS_API_KEY`
   - `VITE_GOOGLE_CLIENT_ID`
   - `VITE_IFTTT_WEBHOOK_KEY`
3. Push to main branch

### Deploying Updates

Simply push to main - GitHub Actions handles the rest:

```bash
git add .
git commit -m "Your changes"
git push origin main
```

Your site will automatically deploy to: `https://natebarksdale.xyz/experiments/hvac-control/`

### Local Build (Optional)

To test the production build locally:

```bash
npm run build
npm run preview
```

**Note:** Built files contain embedded environment variables from `.env` and should never be committed to git.

## Data Architecture

The app uses a **dual-source architecture** for reliability:

### Primary Data Sources

1. **SmartThings API** (Source of truth for temperatures)
   - Real-time temperature readings from thermostats
   - Direct API access with <2 second latency
   - Automatic fallback to Google Sheets if unavailable

2. **Google Sheets** (Control settings and history)
   - Control overrides and default settings
   - Historical log data
   - Fallback temperature data

### Google Sheets Structure

The app expects the following sheet structure:

### Panel Sheet
- `C2:C9` - Unit names
- `F2:F9` - Fallback temperature data (used if SmartThings unavailable)
- `E2:E9` - Minutes since last update
- `A2:A9` - Preferred state (format: "On-Heat-67a")

### Control Sheet (for write access via OAuth)
- `D1:D8` - On/off toggle (values: "on" or "off")
- `E1:E8` - Mode (values: "heat" or "cool")
- `B1:B8` - Action toggle (toggled to trigger control system)

### Log Sheet
- Column A - Log entries in format: `Basement-Off-Heat-65h+JRs office-Onn-Heat-67a+...|71|63|...|X|H|...`

## Design

This interface features a warm, analog-inspired aesthetic with:
- Custom typography (Instrument Serif, IBM Plex Mono, DM Sans)
- Terracotta and warm earth tone color palette
- Temperature-based color coding (warm oranges for heat, cool blues for AC)
- Smooth animations and micro-interactions
- Textured backgrounds with subtle grain

## Technology Stack

- **React 18** - UI framework
- **Vite** - Build tool
- **Framer Motion** - Animations
- **Google Sheets API v4** - Data source

## License

MIT
