import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getWhoisData } from '../_shared/whois-logic.ts'
import { buildDropAlert, estimateDropTiming } from './alerts.ts'
import { recordEvent, readIdempotentResponse, requireScope } from './auth.ts'
import { daysUntil, formatDomain, isAvailableLike, isMissingWhoisData, normalizeDomainName, normalizeTag } from './domain-utils.ts'
import { jsonResponse, normalizePath } from './http.ts'
import { DomainPayload, DomainRow, DomainStatus, DomainTag, IntegrationClient } from './types.ts'

const MAX_BULK_DOMAINS = 25;
const MAX_RECHECK_DOMAINS = 25;

export const getDomains = async (req: Request, client: IntegrationClient, supabaseAdmin: ReturnType<typeof createClient>) => {
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

export const addDomains = async (req: Request, client: IntegrationClient, supabaseAdmin: ReturnType<typeof createClient>) => {
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

export const recheckDomains = async (req: Request, client: IntegrationClient, supabaseAdmin: ReturnType<typeof createClient>) => {
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

export const getDueAlerts = async (_req: Request, client: IntegrationClient, supabaseAdmin: ReturnType<typeof createClient>) => {
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
        if (days < 0) return buildDropAlert(domain);
        return {
          id: `domain-${domain.id}-snatch-expiry-${domain.expiration_date || 'unknown'}`,
          event: 'domain.expiring',
          domainName: domain.domain_name,
          tag: domain.tag,
          status: domain.status,
          severity: 'watch-expiry',
          expirationDate: domain.expiration_date,
          daysUntilExpiry: days,
          dropTiming: estimateDropTiming(domain),
          message: `${domain.domain_name} expires in ${days} day(s). Prepare if you want to snatch it.`,
        };
      }

      const dropAlert = buildDropAlert(domain);
      if (dropAlert) return dropAlert;

      return null;
    })
    .filter(Boolean)
    .sort((a: any, b: any) => (a.daysUntilExpiry ?? 99999) - (b.daysUntilExpiry ?? 99999));

  return jsonResponse({ alerts, count: alerts.length });
};

export const getDropAlertForDomain = async (req: Request, client: IntegrationClient, supabaseAdmin: ReturnType<typeof createClient>) => {
  requireScope(client, 'alerts:read');

  const url = new URL(req.url);
  const path = normalizePath(url);
  const rawDomainName = decodeURIComponent(path.replace(/^\/api\/v1\/alerts\/drop\//, ''));
  const domainName = normalizeDomainName(rawDomainName);
  if (!domainName) return jsonResponse({ error: 'Invalid domain name.' }, 400);

  const { data, error } = await supabaseAdmin
    .from('domains')
    .select('*')
    .eq('user_id', client.user_id)
    .eq('domain_name', domainName)
    .maybeSingle();

  if (error) return jsonResponse({ error: error.message }, 500);
  if (!data) return jsonResponse({ error: 'Domain is not tracked.' }, 404);

  const domain = data as DomainRow;
  if (domain.tag !== 'to-snatch') {
    return jsonResponse({
      domain: formatDomain(domain),
      alert: null,
      message: 'Domain is tracked, but it is not tagged as to-snatch.',
    });
  }

  return jsonResponse({
    domain: formatDomain(domain),
    alert: buildDropAlert(domain),
  });
};
