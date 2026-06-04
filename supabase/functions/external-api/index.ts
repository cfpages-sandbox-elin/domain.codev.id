// External integration API for Hermes, n8n, scripts, and future clients.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getWhoisData } from '../_shared/whois-logic.ts'

console.log('✅ "external-api" function loaded');

type DomainTag = 'mine' | 'to-snatch' | 'others';
type DomainStatus = 'available' | 'registered' | 'expired' | 'dropped' | 'unknown';
type Scope = 'domains:read' | 'domains:write' | 'whois:check' | 'alerts:read' | 'webhooks:write';

interface IntegrationClient {
  id: string;
  user_id: string;
  name: string;
  scopes: Scope[];
  revoked_at: string | null;
  expires_at: string | null;
}

interface DomainRow {
  id: number;
  user_id: string;
  domain_name: string;
  tag: DomainTag;
  status: DomainStatus;
  expiration_date: string | null;
  registered_date: string | null;
  registrar: string | null;
  domain_statuses: string[] | null;
  name_servers: string[] | null;
  created_at: string;
  last_checked: string | null;
}

type DomainPayload = string | {
  domainName?: unknown;
  domain_name?: unknown;
  tag?: unknown;
};

const MAX_BULK_DOMAINS = 25;
const MAX_RECHECK_DOMAINS = 25;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, idempotency-key',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

const normalizePath = (url: URL) => {
  const marker = '/api/v1';
  const index = url.pathname.indexOf(marker);
  return index >= 0 ? url.pathname.slice(index) : url.pathname;
};

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

const normalizeDomainName = (value: unknown) => {
  if (typeof value !== 'string') return null;
  let domain = value.trim().toLowerCase();
  domain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '');
  domain = domain.split(/[/?#]/)[0] || '';
  domain = domain.replace(/\.$/, '');

  if (!domain || domain.length > 253) return null;
  if (domain.includes('@') || domain.includes('_') || domain.includes('*')) return null;
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)) return null;
  if (domain.includes('..')) return null;
  if (domain.split('.').some(label => !label || label.length > 63 || label.startsWith('-') || label.endsWith('-'))) return null;
  return domain;
};

const normalizeTag = (value: unknown): DomainTag => {
  if (value === 'to-snatch' || value === 'others') return value;
  return 'mine';
};

const isAvailableLike = (status: DomainStatus) => status === 'available' || status === 'dropped';

const isMissingWhoisData = (domain: DomainRow) => {
  if (!domain.last_checked || domain.status === 'unknown') return true;
  if (isAvailableLike(domain.status)) return false;
  return !domain.expiration_date
    || !domain.registrar
    || !domain.domain_statuses
    || domain.domain_statuses.length === 0
    || !domain.name_servers
    || domain.name_servers.length === 0;
};

const daysUntil = (dateString: string | null) => {
  if (!dateString) return null;
  const date = new Date(dateString);
  const diffMs = date.getTime() - Date.now();
  if (!Number.isFinite(diffMs)) return null;
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
};

const formatDomain = (domain: DomainRow) => ({
  id: domain.id,
  domainName: domain.domain_name,
  tag: domain.tag,
  status: domain.status,
  expirationDate: domain.expiration_date,
  registeredDate: domain.registered_date,
  registrar: domain.registrar,
  domainStatuses: domain.domain_statuses || [],
  nameServers: domain.name_servers || [],
  lastChecked: domain.last_checked,
  createdAt: domain.created_at,
});

const requireScope = (client: IntegrationClient, scope: Scope) => {
  if (!client.scopes.includes(scope)) {
    throw new Response(JSON.stringify({ error: `Missing required scope: ${scope}` }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};

const getSupabaseAdmin = () => createClient(
  // @ts-ignore
  Deno.env.get('SUPABASE_URL') ?? '',
  // @ts-ignore
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

const authenticateClient = async (req: Request, supabaseAdmin: ReturnType<typeof createClient>) => {
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

const recordEvent = async (
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

const readIdempotentResponse = async (
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

const getDomains = async (req: Request, client: IntegrationClient, supabaseAdmin: ReturnType<typeof createClient>) => {
  requireScope(client, 'domains:read');

  const url = new URL(req.url);
  const filter = url.searchParams.get('filter') || 'all';
  const { data, error } = await supabaseAdmin
    .from('domains')
    .select('*')
    .eq('user_id', client.user_id)
    .order('created_at', { ascending: false });

  if (error) return jsonResponse({ error: error.message }, 500);

  const rows = (data || []) as DomainRow[];
  const filtered = rows.filter(domain => {
    const days = daysUntil(domain.expiration_date);
    switch (filter) {
      case 'mine': return domain.tag === 'mine';
      case 'to-snatch': return domain.tag === 'to-snatch';
      case 'others': return domain.tag === 'others';
      case 'available': return isAvailableLike(domain.status);
      case 'missing-data': return isMissingWhoisData(domain);
      case 'expiring-soon': return days !== null && days >= 0 && days < 90;
      default: return true;
    }
  });

  if (filter === 'expiring-soon') {
    filtered.sort((a, b) => (daysUntil(a.expiration_date) ?? 99999) - (daysUntil(b.expiration_date) ?? 99999));
  }

  return jsonResponse({ domains: filtered.map(formatDomain), count: filtered.length });
};

const addDomains = async (req: Request, client: IntegrationClient, supabaseAdmin: ReturnType<typeof createClient>) => {
  requireScope(client, 'domains:write');

  const idempotencyKey = req.headers.get('Idempotency-Key');
  const existingResponse = await readIdempotentResponse(supabaseAdmin, client, idempotencyKey);
  if (existingResponse) return jsonResponse(existingResponse);

  const body = await req.json().catch(() => ({}));
  const rawDomains = Array.isArray(body.domains) ? body.domains : [body];
  const checkWhois = body.checkWhois !== false;

  if (rawDomains.length > MAX_BULK_DOMAINS) {
    return jsonResponse({ error: `Bulk add is capped at ${MAX_BULK_DOMAINS} domains per request.` }, 400);
  }

  const requested = rawDomains.map((item: DomainPayload) => {
    const domainName = normalizeDomainName(typeof item === 'string' ? item : item.domainName ?? item.domain_name);
    return {
      domainName,
      tag: normalizeTag(typeof item === 'string' ? undefined : item.tag),
      raw: item,
    };
  });

  const invalid = requested
    .filter(item => !item.domainName)
    .map(item => ({ input: item.raw, reason: 'Invalid domain name.' }));

  const valid = requested.filter(item => item.domainName) as Array<{ domainName: string; tag: DomainTag; raw: DomainPayload }>;
  const deduped: Array<{ domainName: string; tag: DomainTag }> = [];
  const seen = new Set<string>();
  const skipped = invalid.slice();

  for (const item of valid) {
    if (seen.has(item.domainName)) {
      skipped.push({ input: item.domainName, reason: 'Duplicate in request.' });
      continue;
    }
    seen.add(item.domainName);
    deduped.push({ domainName: item.domainName, tag: item.tag });
  }

  const created = [];
  const failed = [];

  for (const item of deduped) {
    const { data: existingDomain, error: existingError } = await supabaseAdmin
      .from('domains')
      .select('*')
      .eq('user_id', client.user_id)
      .eq('domain_name', item.domainName)
      .maybeSingle();

    if (existingError) {
      failed.push({ domainName: item.domainName, reason: existingError.message });
      continue;
    }

    if (existingDomain) {
      skipped.push({ domainName: item.domainName, reason: 'Already tracked.' });
      continue;
    }

    const whoisData = checkWhois
      ? await getWhoisData(item.domainName, { telemetryClient: supabaseAdmin, userId: client.user_id })
      : {
        status: 'unknown' as DomainStatus,
        expirationDate: null,
        registeredDate: null,
        registrar: null,
        domainStatuses: [],
        nameServers: [],
      };

    const hasIncompleteRegisteredData = (whoisData.status === 'registered' || whoisData.status === 'expired') && !whoisData.expirationDate;
    const shouldStoreAsFailed = whoisData.status === 'unknown' || hasIncompleteRegisteredData;
    const savedTag = isAvailableLike(whoisData.status) ? 'to-snatch' : item.tag;

    const insertPayload = {
      user_id: client.user_id,
      domain_name: item.domainName,
      tag: savedTag,
      status: shouldStoreAsFailed ? 'unknown' : whoisData.status,
      expiration_date: shouldStoreAsFailed ? null : whoisData.expirationDate,
      registered_date: shouldStoreAsFailed ? null : whoisData.registeredDate,
      registrar: shouldStoreAsFailed ? null : whoisData.registrar,
      domain_statuses: shouldStoreAsFailed ? null : whoisData.domainStatuses || null,
      name_servers: shouldStoreAsFailed ? null : whoisData.nameServers || null,
      last_checked: new Date().toISOString(),
    };

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('domains')
      .insert(insertPayload)
      .select()
      .single();

    if (insertError || !inserted) {
      failed.push({ domainName: item.domainName, reason: insertError?.message || 'Insert failed.' });
      continue;
    }

    created.push({
      ...formatDomain(inserted as DomainRow),
      provider: whoisData.provider,
      providerLabel: whoisData.providerLabel,
      providerAttempts: whoisData.providerAttempts || [],
      warning: shouldStoreAsFailed ? 'WHOIS data is incomplete; saved as unknown for later re-check.' : null,
    });
  }

  const response = { created, skipped, failed };
  await recordEvent(supabaseAdmin, client, 'domains.create', idempotencyKey, response);
  return jsonResponse(response, failed.length > 0 && created.length === 0 ? 207 : 200);
};

const recheckDomains = async (req: Request, client: IntegrationClient, supabaseAdmin: ReturnType<typeof createClient>) => {
  requireScope(client, 'whois:check');

  const idempotencyKey = req.headers.get('Idempotency-Key');
  const existingResponse = await readIdempotentResponse(supabaseAdmin, client, idempotencyKey);
  if (existingResponse) return jsonResponse(existingResponse);

  const body = await req.json().catch(() => ({}));
  const mode = typeof body.mode === 'string' ? body.mode : 'domains';
  const requestedDomains = Array.isArray(body.domains)
    ? body.domains.map(normalizeDomainName).filter(Boolean)
    : [];

  let query = supabaseAdmin
    .from('domains')
    .select('*')
    .eq('user_id', client.user_id);

  if (mode !== 'missing-data') {
    if (requestedDomains.length === 0) {
      return jsonResponse({ error: 'domains is required unless mode is missing-data.' }, 400);
    }
    query = query.in('domain_name', requestedDomains.slice(0, MAX_RECHECK_DOMAINS));
  }

  const { data, error } = await query;
  if (error) return jsonResponse({ error: error.message }, 500);

  let targets = (data || []) as DomainRow[];
  if (mode === 'missing-data') {
    targets = targets.filter(isMissingWhoisData).slice(0, MAX_RECHECK_DOMAINS);
  }

  const updated = [];
  const failed = [];

  for (const domain of targets) {
    const whoisData = await getWhoisData(domain.domain_name, { telemetryClient: supabaseAdmin, userId: client.user_id });
    if (whoisData.status === 'unknown') {
      failed.push({
        domainName: domain.domain_name,
        reason: 'WHOIS check returned unknown.',
        providerAttempts: whoisData.providerAttempts || [],
      });
      continue;
    }

    const nextTag = isAvailableLike(whoisData.status) ? 'to-snatch' : domain.tag;
    const { data: updatedDomain, error: updateError } = await supabaseAdmin
      .from('domains')
      .update({
        tag: nextTag,
        status: whoisData.status,
        expiration_date: whoisData.expirationDate,
        registered_date: whoisData.registeredDate,
        registrar: whoisData.registrar,
        domain_statuses: whoisData.domainStatuses || null,
        name_servers: whoisData.nameServers || null,
        last_checked: new Date().toISOString(),
      })
      .eq('id', domain.id)
      .eq('user_id', client.user_id)
      .select()
      .single();

    if (updateError || !updatedDomain) {
      failed.push({ domainName: domain.domain_name, reason: updateError?.message || 'Update failed.' });
      continue;
    }

    updated.push({
      ...formatDomain(updatedDomain as DomainRow),
      provider: whoisData.provider,
      providerLabel: whoisData.providerLabel,
      providerAttempts: whoisData.providerAttempts || [],
    });
  }

  const response = { updated, failed, checked: targets.length };
  await recordEvent(supabaseAdmin, client, 'domains.recheck', idempotencyKey, response);
  return jsonResponse(response);
};

const getDueAlerts = async (_req: Request, client: IntegrationClient, supabaseAdmin: ReturnType<typeof createClient>) => {
  requireScope(client, 'alerts:read');

  const { data, error } = await supabaseAdmin
    .from('domains')
    .select('*')
    .eq('user_id', client.user_id);

  if (error) return jsonResponse({ error: error.message }, 500);

  const alerts = ((data || []) as DomainRow[])
    .map(domain => {
      const days = daysUntil(domain.expiration_date);
      if (domain.tag === 'mine' && days !== null && days <= 30 && days >= -30) {
        return {
          id: `domain-${domain.id}-mine-expiry-${domain.expiration_date || 'unknown'}`,
          event: 'domain.expiring',
          domainName: domain.domain_name,
          tag: domain.tag,
          status: domain.status,
          severity: days <= 3 ? 'renew-critical' : days <= 7 ? 'renew-soon' : 'renew-month',
          expirationDate: domain.expiration_date,
          daysUntilExpiry: days,
          message: days >= 0
            ? `${domain.domain_name} expires in ${days} day(s). Renew it before ${domain.expiration_date}.`
            : `${domain.domain_name} expired ${Math.abs(days)} day(s) ago. Check renewal immediately.`,
        };
      }

      if (domain.tag === 'others' && days !== null && days <= 30 && days >= -30) {
        return {
          id: `domain-${domain.id}-others-expiry-${domain.expiration_date || 'unknown'}`,
          event: 'domain.expiring',
          domainName: domain.domain_name,
          tag: domain.tag,
          status: domain.status,
          severity: days <= 3 ? 'client-critical' : days <= 7 ? 'client-soon' : 'client-month',
          expirationDate: domain.expiration_date,
          daysUntilExpiry: days,
          message: days >= 0
            ? `${domain.domain_name} is a client/other domain and expires in ${days} day(s).`
            : `${domain.domain_name} is a client/other domain and expired ${Math.abs(days)} day(s) ago.`,
        };
      }

      if (domain.tag === 'to-snatch' && days !== null && days <= 30 && days >= -75) {
        return {
          id: `domain-${domain.id}-snatch-expiry-${domain.expiration_date || 'unknown'}`,
          event: days < 0 ? 'domain.drop-watch' : 'domain.expiring',
          domainName: domain.domain_name,
          tag: domain.tag,
          status: domain.status,
          severity: days < 0 ? 'watch-drop-window' : 'watch-expiry',
          expirationDate: domain.expiration_date,
          daysUntilExpiry: days,
          message: days >= 0
            ? `${domain.domain_name} expires in ${days} day(s). Prepare if you want to snatch it.`
            : `${domain.domain_name} expired ${Math.abs(days)} day(s) ago. Watch for possible drop timing.`,
        };
      }

      if (domain.tag === 'to-snatch' && isAvailableLike(domain.status)) {
        return {
          id: `domain-${domain.id}-available`,
          event: 'domain.dropped',
          domainName: domain.domain_name,
          tag: domain.tag,
          status: domain.status,
          severity: 'available',
          expirationDate: domain.expiration_date,
          daysUntilExpiry: days,
          message: `${domain.domain_name} is marked available. Re-check before buying.`,
        };
      }

      return null;
    })
    .filter(Boolean)
    .sort((a: any, b: any) => (a.daysUntilExpiry ?? 99999) - (b.daysUntilExpiry ?? 99999));

  return jsonResponse({ alerts, count: alerts.length });
};

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

    return jsonResponse({ error: 'Not found', path }, 404);
  } catch (err) {
    if (err instanceof Response) return err;
    const message = err instanceof Error ? err.message : String(err);
    console.error('external-api error:', message);
    return jsonResponse({ error: message }, 500);
  }
});
