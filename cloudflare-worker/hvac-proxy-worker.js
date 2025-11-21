// Cloudflare Worker - HVAC Control API Proxy
// This worker acts as a secure proxy for SmartThings and IFTTT APIs
// API keys never leave the server, providing real security

export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return handleCORS();
    }

    // Get the origin of the request
    const origin = request.headers.get('Origin');

    // Allow requests from your domains
    const allowedOrigins = [
      'https://natebarksdale.xyz',
      'https://natebarksdale.github.io',
      'http://localhost:5173',  // Vite dev server
      'http://127.0.0.1:5173',
      'http://localhost:8000',  // Local testing
      'http://127.0.0.1:8000'
    ];

    // Check if origin is allowed
    const isAllowed = allowedOrigins.some(allowed =>
      origin && origin.startsWith(allowed)
    );

    if (!isAllowed) {
      console.log('Blocked request from:', origin);
      return new Response('Forbidden - Invalid origin', {
        status: 403,
        headers: { 'Content-Type': 'text/plain' }
      });
    }

    // Parse URL to determine which API to proxy
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // Route to appropriate handler
      if (path.startsWith('/smartthings/')) {
        return await handleSmartThings(request, env, origin);
      } else if (path.startsWith('/ifttt/')) {
        return await handleIFTTT(request, env, origin);
      } else if (path === '/verify') {
        return await verifyAuth(request, env, origin);
      } else {
        return new Response(JSON.stringify({
          error: 'Not found',
          message: 'Available endpoints: /smartthings/*, /ifttt/*, /verify'
        }), {
          status: 404,
          headers: corsHeaders(origin)
        });
      }
    } catch (error) {
      console.error('Error handling request:', error);
      return new Response(JSON.stringify({
        error: 'Internal server error',
        message: error.message
      }), {
        status: 500,
        headers: corsHeaders(origin)
      });
    }
  }
};

/**
 * Verify Google OAuth token
 * This is called before any control operations to ensure the user is authenticated
 */
async function verifyAuth(request, env, origin) {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({
      error: 'Unauthorized',
      message: 'Missing or invalid authorization header'
    }), {
      status: 401,
      headers: corsHeaders(origin)
    });
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix

  try {
    // Verify the Google OAuth token
    const verifyUrl = `https://oauth2.googleapis.com/tokeninfo?access_token=${token}`;
    const verifyResponse = await fetch(verifyUrl);

    if (!verifyResponse.ok) {
      return new Response(JSON.stringify({
        error: 'Unauthorized',
        message: 'Invalid or expired token'
      }), {
        status: 401,
        headers: corsHeaders(origin)
      });
    }

    const tokenInfo = await verifyResponse.json();

    // Check if token has required scope (Google Sheets access)
    // This ensures they've authenticated with your app
    const hasRequiredScope = tokenInfo.scope?.includes('https://www.googleapis.com/auth/spreadsheets');

    if (!hasRequiredScope) {
      return new Response(JSON.stringify({
        error: 'Forbidden',
        message: 'Token does not have required permissions'
      }), {
        status: 403,
        headers: corsHeaders(origin)
      });
    }

    // Token is valid
    return new Response(JSON.stringify({
      valid: true,
      email: tokenInfo.email
    }), {
      status: 200,
      headers: corsHeaders(origin)
    });
  } catch (error) {
    console.error('Error verifying token:', error);
    return new Response(JSON.stringify({
      error: 'Error verifying token',
      message: error.message
    }), {
      status: 500,
      headers: corsHeaders(origin)
    });
  }
}

/**
 * Handle SmartThings API requests
 * Only control operations (POST) require authentication
 * Read operations (GET) are allowed without auth for monitoring
 */
async function handleSmartThings(request, env, origin) {
  if (!env.SMARTTHINGS_TOKEN) {
    return new Response(JSON.stringify({
      error: 'Server configuration error',
      message: 'SmartThings token not configured'
    }), {
      status: 500,
      headers: corsHeaders(origin)
    });
  }

  // Control operations require authentication
  if (request.method === 'POST') {
    const authCheck = await verifyAuth(request, env, origin);
    if (authCheck.status !== 200) {
      return authCheck; // Return auth error
    }
  }

  // Extract the SmartThings API path
  const url = new URL(request.url);
  const smartthingsPath = url.pathname.replace('/smartthings', '');
  const smartthingsUrl = `https://api.smartthings.com/v1${smartthingsPath}`;

  // Forward the request to SmartThings
  const smartthingsRequest = new Request(smartthingsUrl, {
    method: request.method,
    headers: {
      'Authorization': `Bearer ${env.SMARTTHINGS_TOKEN}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: request.method !== 'GET' ? await request.text() : undefined
  });

  const smartthingsResponse = await fetch(smartthingsRequest);
  const data = await smartthingsResponse.text();

  return new Response(data, {
    status: smartthingsResponse.status,
    headers: {
      ...corsHeaders(origin),
      'Content-Type': 'application/json'
    }
  });
}

/**
 * Handle IFTTT webhook requests
 * All webhook triggers require authentication
 */
async function handleIFTTT(request, env, origin) {
  if (!env.IFTTT_WEBHOOK_KEY) {
    return new Response(JSON.stringify({
      error: 'Server configuration error',
      message: 'IFTTT webhook key not configured'
    }), {
      status: 500,
      headers: corsHeaders(origin)
    });
  }

  // Verify authentication
  const authCheck = await verifyAuth(request, env, origin);
  if (authCheck.status !== 200) {
    return authCheck; // Return auth error
  }

  // Only allow POST requests
  if (request.method !== 'POST') {
    return new Response('Method not allowed', {
      status: 405,
      headers: corsHeaders(origin)
    });
  }

  // Extract the IFTTT event name and values
  const url = new URL(request.url);
  const eventName = url.pathname.replace('/ifttt/', '');

  // Parse request body for webhook values
  let body;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  // Build IFTTT webhook URL
  const iftttUrl = `https://maker.ifttt.com/trigger/${eventName}/with/key/${env.IFTTT_WEBHOOK_KEY}`;

  // Forward to IFTTT
  const iftttResponse = await fetch(iftttUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  const responseText = await iftttResponse.text();

  return new Response(responseText, {
    status: iftttResponse.status,
    headers: corsHeaders(origin)
  });
}

// CORS headers helper
function corsHeaders(origin) {
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400'
  };
}

// Handle CORS preflight
function handleCORS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    }
  });
}
