// Google OAuth 2.0 Authentication
// Uses the Google Identity Services library for OAuth

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';

let tokenClient = null;
let accessToken = null;

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
        resolve();
      };
      script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
      document.head.appendChild(script);
    } else {
      createTokenClient();
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
 * Request access token from Google
 * Opens the OAuth consent screen
 */
export function signIn() {
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

      resolve(accessToken);
    };

    // Request the token
    tokenClient.requestAccessToken({ prompt: 'consent' });
  });
}

/**
 * Sign out and clear stored tokens
 */
export function signOut() {
  accessToken = null;
  localStorage.removeItem('auth_token');
  localStorage.removeItem('auth_expires_at');

  // Revoke the token
  if (window.google && window.google.accounts.oauth2) {
    window.google.accounts.oauth2.revoke(accessToken, () => {
      console.log('Token revoked');
    });
  }
}

/**
 * Get the current access token
 * Checks if stored token is still valid
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
 */
export function refreshTokenIfNeeded() {
  const expiresAt = parseInt(localStorage.getItem('auth_expires_at') || '0');
  const timeUntilExpiry = expiresAt - Date.now();

  // Refresh if token expires in less than 5 minutes
  if (timeUntilExpiry < 5 * 60 * 1000 && timeUntilExpiry > 0) {
    return signIn();
  }

  return Promise.resolve(getAccessToken());
}
