// Google OAuth 2.0 Authentication
// Uses the Google Identity Services library for OAuth

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';

let tokenClient = null;
let accessToken = null;
let refreshTimer = null;

/**
 * Initialize the Google Identity Services token client
 */
export function initializeAuth() {
  return new Promise((resolve, reject) => {
    if (!CLIENT_ID) {
      reject(new Error('Google Client ID not configured'));
      return;
    }

    // Load the Google Identity Services library
    if (!window.google) {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.onload = () => {
        createTokenClient();
        // Check if we have an existing token and set up auto-refresh
        const storedToken = localStorage.getItem('auth_token');
        const expiresAt = parseInt(localStorage.getItem('auth_expires_at') || '0');
        if (storedToken && expiresAt > Date.now()) {
          accessToken = storedToken;
          scheduleTokenRefresh(expiresAt);
        }
        resolve();
      };
      script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
      document.head.appendChild(script);
    } else {
      createTokenClient();
      // Check if we have an existing token and set up auto-refresh
      const storedToken = localStorage.getItem('auth_token');
      const expiresAt = parseInt(localStorage.getItem('auth_expires_at') || '0');
      if (storedToken && expiresAt > Date.now()) {
        accessToken = storedToken;
        scheduleTokenRefresh(expiresAt);
      }
      resolve();
    }
  });
}

function createTokenClient() {
  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: '', // Will be set when requesting token
  });
}

/**
 * Schedule automatic token refresh before expiration
 * Refreshes 5 minutes before token expires
 */
function scheduleTokenRefresh(expiresAt) {
  // Clear any existing timer
  if (refreshTimer) {
    clearTimeout(refreshTimer);
  }

  const timeUntilExpiry = expiresAt - Date.now();
  const refreshTime = timeUntilExpiry - (5 * 60 * 1000); // 5 minutes before expiry

  // Only schedule if there's time left
  if (refreshTime > 0) {
    refreshTimer = setTimeout(() => {
      silentRefresh().catch(err => {
        console.error('Silent token refresh failed:', err);
        // Token will be refreshed on next user interaction
      });
    }, refreshTime);
  }
}

/**
 * Request access token from Google
 * Opens the OAuth consent screen on first sign-in
 */
export function signIn(silent = false) {
  return new Promise((resolve, reject) => {
    if (!tokenClient) {
      reject(new Error('Auth not initialized'));
      return;
    }

    tokenClient.callback = async (response) => {
      if (response.error) {
        reject(response);
        return;
      }

      accessToken = response.access_token;

      // Store token expiration time
      const expiresIn = response.expires_in || 3600;
      const expiresAt = Date.now() + (expiresIn * 1000);
      localStorage.setItem('auth_token', accessToken);
      localStorage.setItem('auth_expires_at', expiresAt.toString());

      // Schedule automatic refresh
      scheduleTokenRefresh(expiresAt);

      resolve(accessToken);
    };

    // Request the token
    // Use empty prompt for silent refresh, or 'consent' for initial sign-in
    const promptType = silent ? '' : 'consent';
    tokenClient.requestAccessToken({ prompt: promptType });
  });
}

/**
 * Silently refresh the access token
 * Attempts to get a new token without user interaction
 */
export function silentRefresh() {
  return signIn(true);
}

/**
 * Sign out and clear stored tokens
 */
export function signOut() {
  // Clear refresh timer
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }

  // Revoke the token before clearing
  const tokenToRevoke = accessToken;

  accessToken = null;
  localStorage.removeItem('auth_token');
  localStorage.removeItem('auth_expires_at');

  // Revoke the token
  if (tokenToRevoke && window.google && window.google.accounts.oauth2) {
    window.google.accounts.oauth2.revoke(tokenToRevoke, () => {
      console.log('Token revoked');
    });
  }
}

/**
 * Get the current access token
 * Checks if stored token is still valid and triggers refresh if expiring soon
 */
export function getAccessToken() {
  // Check if we have a token in memory
  if (accessToken) {
    return accessToken;
  }

  // Check localStorage
  const storedToken = localStorage.getItem('auth_token');
  const expiresAt = parseInt(localStorage.getItem('auth_expires_at') || '0');

  // Validate token hasn't expired
  if (storedToken && expiresAt > Date.now()) {
    accessToken = storedToken;

    // If token is expiring soon (within 5 minutes) and we don't have a refresh scheduled,
    // trigger a silent refresh in the background
    const timeUntilExpiry = expiresAt - Date.now();
    if (timeUntilExpiry < 5 * 60 * 1000 && !refreshTimer) {
      silentRefresh().catch(err => {
        console.error('Background token refresh failed:', err);
      });
    }

    return accessToken;
  }

  // Token expired or doesn't exist
  return null;
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated() {
  return getAccessToken() !== null;
}

/**
 * Refresh the access token if needed
 * Now uses silent refresh for seamless token renewal
 */
export function refreshTokenIfNeeded() {
  const expiresAt = parseInt(localStorage.getItem('auth_expires_at') || '0');
  const timeUntilExpiry = expiresAt - Date.now();

  // Refresh if token expires in less than 5 minutes
  if (timeUntilExpiry < 5 * 60 * 1000 && timeUntilExpiry > 0) {
    return silentRefresh();
  }

  return Promise.resolve(getAccessToken());
}
