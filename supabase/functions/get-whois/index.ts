// This function acts as a secure proxy for real-time WHOIS lookups from the client.
// It handles CORS and uses shared server-side logic to query providers.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getWhoisData } from '../_shared/whois-logic.ts'

console.log('✅ "get-whois" function loaded');

// Define CORS headers to allow requests from the web app
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Replace with your specific domain in production for better security
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // This is needed if you're planning to invoke your function from a browser.
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Authenticate the user
    // Create a Supabase client with the Auth context of the user that called the function.
    // This way, we can verify that only authenticated users can use this function.
    const userSupabaseClient = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );
    const { data: { user } } = await userSupabaseClient.auth.getUser();

    if (!user) {
      console.warn('Unauthorized access attempt to get-whois function.');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    console.log(`✅ User ${user.id} authorized.`);

    // 2. Get the domain name from the request body
    const { domainName } = await req.json();
    if (!domainName || typeof domainName !== 'string') {
      return new Response(JSON.stringify({ error: 'domainName is required and must be a string' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    console.log(`➡️ Processing request for domain: ${domainName}`);
    
    // 3. Perform the WHOIS lookup using shared logic
    const whoisData = await getWhoisData(domainName);
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
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
