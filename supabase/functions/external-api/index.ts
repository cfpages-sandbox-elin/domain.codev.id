// External integration API for Hermes, n8n, scripts, and future clients.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { authenticateClient } from './auth.ts'
import { corsHeaders, jsonResponse, normalizePath } from './http.ts'
import { addDomains, getDomains, getDropAlertForDomain, getDueAlerts, recheckDomains } from './routes.ts'

console.log('✅ "external-api" function loaded');

const getSupabaseAdmin = () => createClient(
  // @ts-ignore
  Deno.env.get('SUPABASE_URL') ?? '',
  // @ts-ignore
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseAdmin = getSupabaseAdmin();

  try {
    const client = await authenticateClient(req, supabaseAdmin);
    if (!client) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const url = new URL(req.url);
    const path = normalizePath(url);

    if (req.method === 'GET' && path === '/api/v1/domains') {
      return await getDomains(req, client, supabaseAdmin);
    }

    if (req.method === 'POST' && path === '/api/v1/domains') {
      return await addDomains(req, client, supabaseAdmin);
    }

    if (req.method === 'POST' && path === '/api/v1/domains/recheck') {
      return await recheckDomains(req, client, supabaseAdmin);
    }

    if (req.method === 'GET' && path === '/api/v1/alerts/due') {
      return await getDueAlerts(req, client, supabaseAdmin);
    }

    if (req.method === 'GET' && path.startsWith('/api/v1/alerts/drop/')) {
      return await getDropAlertForDomain(req, client, supabaseAdmin);
    }

    return jsonResponse({ error: 'Not found', path }, 404);
  } catch (err) {
    if (err instanceof Response) return err;
    const message = err instanceof Error ? err.message : String(err);
    console.error('external-api error:', message);
    return jsonResponse({ error: message }, 500);
  }
});
