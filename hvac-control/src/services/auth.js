// Google OAuth 2.0 Authentication with Persistent Sessions
// Uses Cloudflare Worker for session management and token refresh
// Sessions last up to 6 months vs 1 hour with access tokens

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const PROXY_URL = import.meta.env.VITE_PROXY_URL || '';
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';

// OAuth redirect URI (should match worker configuration)
const REDIRECT_URI = `${PROXY_URL}/auth/callback`;

let sessionId = null;
let accessToken = null;
let tokenExpiresAt = null;
let refreshTimer = null;

/**
 * Initialize the authentication system
 */
export function initializeAuth() {
  return new Promise((resolve) => {
    // Check if we have an existing session
    const storedSessionId = localStorage.getItem('session_id');
    const storedExpiresAt = parseInt(localStorage.getItem('session_expires_at') || '0');

    if (storedSessionId && storedExpiresAt > Date.now()) {
      sessionId = storedSessionId;
      tokenExpiresAt = storedExpiresAt;

      // Verify session is still valid
      checkSession()
        .then(() => {
          console.log('Session restored successfully');
          resolve();
        })
        .catch((err) => {
          console.log('Stored session invalid, cleared');
          signOut();
          resolve();
        });
    } else {
      resolve();
    }
  });
}

/**
 * Start OAuth flow - redirects to Google sign-in
 */
export function signIn() {
  if (!CLIENT_ID) {
    throw new Error('Google Client ID not configured');
  }

  if (!PROXY_URL) {
    throw new Error('Proxy URL not configured - set VITE_PROXY_URL');
  }

  // Generate random state for CSRF protection
  const state = crypto.randomUUID();
  localStorage.setItem('oauth_state', state);

  // Build OAuth URL
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', SCOPES);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('access_type', 'offline'); // Get refresh token
  authUrl.searchParams.set('prompt', 'consent'); // Force to get refresh token

  // Redirect to Google
  window.location.href = authUrl.toString();
}

/**
 * Handle OAuth callback
 * Called after redirect from worker with session ID
 */
export async function handleOAuthCallback() {
  const urlParams = new URLSearchParams(window.location.search);
  const sessionIdParam = urlParams.get('session_id');
  const state = urlParams.get('state');
  const error = urlParams.get('error');

  if (error) {
    throw new Error(`OAuth error: ${error}`);
  }

  if (!sessionIdParam) {
    throw new Error('No session ID received from authentication');
  }

  // Verify state matches (CSRF protection)
  const storedState = localStorage.getItem('oauth_state');
  if (state !== storedState) {
    throw new Error('Invalid state parameter - possible CSRF attack');
  }

  localStorage.removeItem('oauth_state');

  try {
    // Store session ID
    sessionId = sessionIdParam;
    localStorage.setItem('session_id', sessionId);

    // Session lasts up to 6 months
    const expiresAt = Date.now() + (180 * 24 * 60 * 60 * 1000);
    localStorage.setItem('session_expires_at', expiresAt.toString());

    // Get initial access token
    await checkSession();

    return sessionId;
  } catch (error) {
    console.error('OAuth callback error:', error);
    signOut();
    throw error;
  }
}

/**
 * Check session and refresh access token if needed
 * Automatically called by the worker to handle token refresh
 */
export async function checkSession() {
  if (!sessionId) {
    throw new Error('No session');
  }

  try {
    const response = await fetch(`${PROXY_URL}/auth/session`, {
      headers: {
        'Authorization': `Bearer ${sessionId}`
      }
    });

    if (!response.ok) {
      throw new Error('Session invalid or expired');
    }

    const data = await response.json();

    if (!data.valid) {
      throw new Error('Session invalid');
    }

    // Update access token
    accessToken = data.accessToken;
    tokenExpiresAt = data.expiresAt;

    // Schedule next refresh (5 minutes before expiry)
    scheduleTokenRefresh();

    return accessToken;
  } catch (error) {
    console.error('Session check failed:', error);
    signOut();
    throw error;
  }
}

/**
 * Schedule automatic token refresh
 */
function scheduleTokenRefresh() {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
  }

  if (!tokenExpiresAt) return;

  const timeUntilExpiry = tokenExpiresAt - Date.now();
  const refreshTime = timeUntilExpiry - (5 * 60 * 1000); // 5 minutes before expiry

  if (refreshTime > 0) {
    refreshTimer = setTimeout(() => {
      checkSession().catch(err => {
        console.error('Automatic token refresh failed:', err);
      });
    }, refreshTime);
  }
}

/**
 * Sign out and clear session
 */
export async function signOut() {
  // Clear refresh timer
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }

  // Notify worker to delete session
  if (sessionId && PROXY_URL) {
    try {
      await fetch(`${PROXY_URL}/auth/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionId}`
        }
      });
    } catch (err) {
      console.error('Logout request failed:', err);
    }
  }

  // Clear local state
  sessionId = null;
  accessToken = null;
  tokenExpiresAt = null;
  localStorage.removeItem('session_id');
  localStorage.removeItem('session_expires_at');
}

/**
 * Get the current access token
 * Automatically refreshes if expired
 */
export async function getAccessToken() {
  if (!sessionId) {
    return null;
  }

  // If token is still valid, return it
  if (accessToken && tokenExpiresAt && tokenExpiresAt > Date.now()) {
    return accessToken;
  }

  // Token expired or not loaded, check session
  try {
    return await checkSession();
  } catch (err) {
    return null;
  }
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated() {
  return !!sessionId && !!localStorage.getItem('session_id');
}

/**
 * Check if we're on the OAuth callback page
 */
export function isOAuthCallback() {
  return window.location.search.includes('session_id=');
}
