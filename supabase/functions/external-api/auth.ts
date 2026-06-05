import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from './http.ts'
import { IntegrationClient, Scope } from './types.ts'

const sha256Hex = async (value: string) => {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
};

const extractBearerToken = (req: Request) => {
  const authHeader = req.headers.get('Authorization') || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
};

export const requireScope = (client: IntegrationClient, scope: Scope) => {
  if (!client.scopes.includes(scope)) {
    throw new Response(JSON.stringify({ error: `Missing required scope: ${scope}` }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};

export const authenticateClient = async (req: Request, supabaseAdmin: ReturnType<typeof createClient>) => {
  const token = extractBearerToken(req);
  if (!token) {
    return null;
  }

  const tokenHash = await sha256Hex(token);
  const { data, error } = await supabaseAdmin
    .from('integration_clients')
    .select('id, user_id, name, scopes, revoked_at, expires_at')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (error || !data) return null;

  const client = data as IntegrationClient;
  if (client.revoked_at) return null;
  if (client.expires_at && new Date(client.expires_at).getTime() <= Date.now()) return null;

  await supabaseAdmin
    .from('integration_clients')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', client.id);

  return client;
};

export const recordEvent = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  client: IntegrationClient,
  eventType: string,
  idempotencyKey: string | null,
  payload: unknown,
  status: 'received' | 'processed' | 'failed' = 'processed',
) => {
  const record = {
    client_id: client.id,
    user_id: client.user_id,
    event_type: eventType,
    idempotency_key: idempotencyKey,
    payload,
    status,
  };

  if (idempotencyKey) {
    const { data: existing } = await supabaseAdmin
      .from('integration_events')
      .select('id')
      .eq('client_id', client.id)
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();

    if (existing?.id) {
      const { error } = await supabaseAdmin
        .from('integration_events')
        .update(record)
        .eq('id', existing.id);

      if (error) {
        console.warn('Failed to update integration event:', error.message);
      }
      return;
    }
  }

  const { error } = await supabaseAdmin
    .from('integration_events')
    .insert(record);

  if (error) {
    console.warn('Failed to record integration event:', error.message);
  }
};

export const readIdempotentResponse = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  client: IntegrationClient,
  idempotencyKey: string | null,
) => {
  if (!idempotencyKey) return null;
  const { data, error } = await supabaseAdmin
    .from('integration_events')
    .select('payload, status')
    .eq('client_id', client.id)
    .eq('idempotency_key', idempotencyKey)
    .eq('status', 'processed')
    .maybeSingle();

  if (error || !data) return null;
  return data.payload;
};
