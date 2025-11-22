// API Proxy Configuration
// Routes sensitive API calls through Cloudflare Worker proxy for security

import { getAccessToken } from './auth';

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

  const token = getAccessToken();
  if (!token) {
    throw new Error('Not authenticated');
  }

  const url = `${PROXY_URL}${path}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(error.message || `Proxy request failed: ${response.status}`);
  }

  return response;
}

/**
 * Make a SmartThings API request through the proxy
 * @param {string} endpoint - SmartThings API endpoint (e.g., '/devices/{id}/commands')
 * @param {object} options - Fetch options
 */
export async function proxySmartThings(endpoint, options = {}) {
  const path = `/smartthings${endpoint}`;
  return await proxyRequest(path, options);
}

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
  const token = getAccessToken();
  if (!token) {
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
