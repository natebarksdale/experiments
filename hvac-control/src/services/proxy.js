// API Proxy Configuration
// Routes sensitive API calls through Cloudflare Worker proxy for security

import { getAccessToken } from './auth';

/**
 * Get the session ID from localStorage
 * The session ID is used to authenticate with the proxy (not the access token)
 */
function getSessionId() {
  return localStorage.getItem('session_id');
}

// Proxy URL - update this after deploying your Cloudflare Worker
// Example: 'https://hvac-control-proxy.your-subdomain.workers.dev'
const PROXY_URL = import.meta.env.VITE_PROXY_URL || '';

// Whether to use the proxy (set to false to use direct API calls during development)
const USE_PROXY = import.meta.env.VITE_USE_PROXY === 'true';

/**
 * Check if proxy is available and configured
 */
export function isProxyAvailable() {
  return USE_PROXY && !!PROXY_URL;
}

/**
 * Make an authenticated request through the proxy
 */
async function proxyRequest(path, options = {}) {
  if (!PROXY_URL) {
    throw new Error('Proxy URL not configured');
  }

  // Use session ID (not access token) to authenticate with proxy
  // The proxy will look up the session and use the stored access token
  const sessionId = getSessionId();
  if (!sessionId) {
    throw new Error('Not authenticated');
  }

  const url = `${PROXY_URL}${path}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${sessionId}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(error.message || `Proxy request failed: ${response.status}`);
  }

  return response;
}

// Note: SmartThings proxy functionality removed - using webhook-only architecture
// All device control now uses IFTTT webhooks instead of SmartThings API

/**
 * Make an IFTTT webhook request through the proxy
 * @param {string} eventName - IFTTT event name
 * @param {object} data - Webhook data (value1, value2, value3)
 */
export async function proxyIFTTT(eventName, data = {}) {
  const path = `/ifttt/${eventName}`;
  return await proxyRequest(path, {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

/**
 * Verify authentication with the proxy
 * Returns user info if token is valid
 */
export async function verifyProxyAuth() {
  const sessionId = getSessionId();
  if (!sessionId) {
    return { valid: false };
  }

  try {
    const response = await proxyRequest('/verify', {
      method: 'GET'
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to verify proxy auth:', error);
    return { valid: false };
  }
}
