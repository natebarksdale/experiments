// Enhanced HVAC Control API Proxy with Persistent Sessions
// Handles OAuth flow server-side with refresh token storage for long-lived sessions

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
      } else if (path === '/auth/callback') {
        return await handleOAuthCallback(request, env, origin);
      } else if (path === '/auth/session') {
        return await handleSessionCheck(request, env, origin);
      } else if (path === '/auth/logout') {
        return await handleLogout(request, env, origin);
      } else if (path === '/verify') {
        return await verifyAuth(request, env, origin);
      } else {
        return new Response(JSON.stringify({
          error: 'Not found',
          message: 'Available endpoints: /smartthings/*, /ifttt/*, /auth/*, /verify'
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
 * Handle OAuth callback from Google
 * Exchanges authorization code for tokens and stores refresh token
 */
async function handleOAuthCallback(request, env, origin) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  if (!code) {
    return new Response(JSON.stringify({
      error: 'Missing authorization code'
    }), {
      status: 400,
      headers: corsHeaders(origin)
    });
  }

  try {
    // Exchange authorization code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: env.OAUTH_REDIRECT_URI,
        grant_type: 'authorization_code'
      })
    });

    if (!tokenResponse.ok) {
      throw new Error('Failed to exchange authorization code');
    }

    const tokens = await tokenResponse.json();

    // Generate session ID
    const sessionId = crypto.randomUUID();

    // Store refresh token in KV (expires in 6 months)
    if (tokens.refresh_token && env.SESSIONS) {
      await env.SESSIONS.put(
        `session:${sessionId}`,
        JSON.stringify({
          refresh_token: tokens.refresh_token,
          access_token: tokens.access_token,
          expires_at: Date.now() + (tokens.expires_in * 1000),
          created_at: Date.now()
        }),
        { expirationTtl: 60 * 60 * 24 * 180 } // 6 months
      );
    }

    // Return session ID to client (to be stored as httpOnly cookie or localStorage)
    return new Response(JSON.stringify({
      success: true,
      sessionId,
      expiresIn: tokens.expires_in
    }), {
      status: 200,
      headers: corsHeaders(origin)
    });
  } catch (error) {
    console.error('OAuth callback error:', error);
    return new Response(JSON.stringify({
      error: 'OAuth callback failed',
      message: error.message
    }), {
      status: 500,
      headers: corsHeaders(origin)
    });
  }
}

/**
 * Check session status and refresh access token if needed
 */
async function handleSessionCheck(request, env, origin) {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({
      valid: false,
      message: 'No session provided'
    }), {
      status: 401,
      headers: corsHeaders(origin)
    });
  }

  const sessionId = authHeader.substring(7);

  try {
    if (!env.SESSIONS) {
      throw new Error('Session storage not configured');
    }

    const sessionData = await env.SESSIONS.get(`session:${sessionId}`);

    if (!sessionData) {
      return new Response(JSON.stringify({
        valid: false,
        message: 'Session not found or expired'
      }), {
        status: 401,
        headers: corsHeaders(origin)
      });
    }

    const session = JSON.parse(sessionData);

    // Check if access token is still valid
    if (session.expires_at > Date.now()) {
      return new Response(JSON.stringify({
        valid: true,
        accessToken: session.access_token,
        expiresAt: session.expires_at
      }), {
        status: 200,
        headers: corsHeaders(origin)
      });
    }

    // Access token expired, refresh it
    const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        refresh_token: session.refresh_token,
        grant_type: 'refresh_token'
      })
    });

    if (!refreshResponse.ok) {
      // Refresh token invalid, session expired
      await env.SESSIONS.delete(`session:${sessionId}`);
      return new Response(JSON.stringify({
        valid: false,
        message: 'Session expired, please sign in again'
      }), {
        status: 401,
        headers: corsHeaders(origin)
      });
    }

    const newTokens = await refreshResponse.json();

    // Update session with new access token
    session.access_token = newTokens.access_token;
    session.expires_at = Date.now() + (newTokens.expires_in * 1000);

    await env.SESSIONS.put(
      `session:${sessionId}`,
      JSON.stringify(session),
      { expirationTtl: 60 * 60 * 24 * 180 } // 6 months
    );

    return new Response(JSON.stringify({
      valid: true,
      accessToken: newTokens.access_token,
      expiresAt: session.expires_at
    }), {
      status: 200,
      headers: corsHeaders(origin)
    });
  } catch (error) {
    console.error('Session check error:', error);
    return new Response(JSON.stringify({
      valid: false,
      error: error.message
    }), {
      status: 500,
      headers: corsHeaders(origin)
    });
  }
}

/**
 * Logout - delete session
 */
async function handleLogout(request, env, origin) {
  const authHeader = request.headers.get('Authorization');

  if (authHeader && authHeader.startsWith('Bearer ') && env.SESSIONS) {
    const sessionId = authHeader.substring(7);
    await env.SESSIONS.delete(`session:${sessionId}`);
  }

  return new Response(JSON.stringify({
    success: true
  }), {
    status: 200,
    headers: corsHeaders(origin)
  });
}

/**
 * Verify authentication using session
 * Gets current access token from session
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

  const sessionId = authHeader.substring(7);

  try {
    if (!env.SESSIONS) {
      throw new Error('Session storage not configured');
    }

    // Get session from KV
    const sessionData = await env.SESSIONS.get(`session:${sessionId}`);

    if (!sessionData) {
      return new Response(JSON.stringify({
        error: 'Unauthorized',
        message: 'Invalid session'
      }), {
        status: 401,
        headers: corsHeaders(origin)
      });
    }

    const session = JSON.parse(sessionData);

    // Verify the access token with Google
    const verifyUrl = `https://oauth2.googleapis.com/tokeninfo?access_token=${session.access_token}`;
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

    // Check if token has required scope
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
