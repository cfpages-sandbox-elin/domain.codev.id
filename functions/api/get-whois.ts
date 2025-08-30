import { getWhoisData } from '../_shared/whois-logic';
import { createClient } from '@supabase/supabase-js';
import type { PagesFunction } from '@cloudflare/workers-types'
import { jwtVerify } from 'jose';

// Define CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // In production, restrict this to your domain
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Define the Cloudflare Pages function
export const onRequest: PagesFunction = async (context) => {
  const { request, env } = context;

  // Handle CORS preflight requests
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Authenticate the user via Supabase JWT
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Missing or invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const jwtSecret = env.SUPABASE_JWT_SECRET;

    if (!jwtSecret) {
        console.error('SUPABASE_JWT_SECRET is not set in environment variables.');
        return new Response(JSON.stringify({ error: 'Configuration error: JWT secret not set.' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    try {
        const encoder = new TextEncoder();
        await jwtVerify(token, encoder.encode(jwtSecret));
        // If jwtVerify does not throw, the token is valid.
    } catch (error) {
        console.warn('JWT validation failed:', error.message);
        return new Response(JSON.stringify({ error: 'Unauthorized: Invalid token' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    // 2. Get the domain name from the request body
    let domainName: string;
    try {
        const body = await request.json();
        domainName = body.domainName;
    } catch (e) {
        return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    if (!domainName || typeof domainName !== 'string') {
      return new Response(JSON.stringify({ error: 'domainName is required and must be a string' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    console.log(`➡️ Processing request for domain: ${domainName}`);

    // 3. Perform the WHOIS lookup using shared logic
    // We need to pass the environment variables to the shared logic
    const whoisData = await getWhoisData(domainName, env);
    console.log(`✅ WHOIS lookup complete for ${domainName}. Status: ${whoisData.status}`);

    // 4. Return the result
    return new Response(JSON.stringify(whoisData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (err) {
    console.error('An error occurred in get-whois function:', err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};
