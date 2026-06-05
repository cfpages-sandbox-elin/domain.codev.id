import { hasQuotaData } from './whois-normalize.ts';
import type {
  WhoisProviderConfig,
  WhoisProviderCredentials,
  WhoisProviderId,
  WhoisProviderRuntimeState,
  WhoisQuota,
} from './whois-types.ts';

const providerRuntimeState = new Map<WhoisProviderId, WhoisProviderRuntimeState>();
const WHOIS_PROVIDER_TELEMETRY_TABLE = 'whois_provider_telemetry';
const WHOIS_PROVIDER_CREDENTIALS_TABLE = 'whois_provider_credentials';
let telemetryWarningLogged = false;
let credentialsWarningLogged = false;

const monthKey = (date = new Date()) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;

const nextUtcDay = (now: number) => {
  const date = new Date(now);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1);
};

const nextUtcMonth = (now: number) => {
  const date = new Date(now);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1);
};

export const getRuntimeState = (providerId: WhoisProviderId): WhoisProviderRuntimeState => {
  const currentMonth = monthKey();
  const existing = providerRuntimeState.get(providerId);
  if (existing) {
    if (existing.monthKey !== currentMonth) {
      existing.estimatedMonthUsed = 0;
      existing.monthKey = currentMonth;
      existing.blockedUntil = null;
      existing.blockReason = undefined;
    }
    return existing;
  }

  const created: WhoisProviderRuntimeState = {
    inFlight: 0,
    recentStarts: [],
    estimatedMonthUsed: 0,
    monthKey: currentMonth,
    blockedUntil: null,
  };
  providerRuntimeState.set(providerId, created);
  return created;
};

const isTelemetrySchemaError = (error: any) => {
  const code = error?.code || '';
  const message = `${error?.message || ''} ${error?.details || ''}`;
  return code === '42P01'
    || code === '42883'
    || code === 'PGRST202'
    || code === 'PGRST205'
    || /whois_provider_telemetry|claim_whois_provider_attempt|schema cache|does not exist/i.test(message);
};

const warnTelemetryUnavailable = (error: any) => {
  if (telemetryWarningLogged) return;
  telemetryWarningLogged = true;
  console.warn(`WHOIS provider telemetry persistence is unavailable; using runtime-only quota state. ${error?.message || error}`);
};

const warnCredentialsUnavailable = (error: any) => {
  if (credentialsWarningLogged) return;
  credentialsWarningLogged = true;
  console.warn(`WHOIS provider credential persistence is unavailable; using environment-only provider keys. ${error?.message || error}`);
};

export const loadUserProviderCredentials = async (
  telemetryClient?: any,
  userId?: string,
): Promise<WhoisProviderCredentials> => {
  if (!telemetryClient || !userId) return {};

  const { data, error } = await telemetryClient
    .from(WHOIS_PROVIDER_CREDENTIALS_TABLE)
    .select('provider_id, api_key')
    .eq('user_id', userId);

  if (error) {
    if (isTelemetrySchemaError(error) || /whois_provider_credentials|schema cache|does not exist/i.test(error.message || '')) {
      warnCredentialsUnavailable(error);
      return {};
    }
    console.warn(`Could not load user WHOIS provider credentials: ${error.message || error}`);
    return {};
  }

  return (data || []).reduce((credentials: WhoisProviderCredentials, row: any) => {
    if (row.provider_id && row.api_key) {
      credentials[row.provider_id as WhoisProviderId] = row.api_key;
    }
    return credentials;
  }, {});
};

const hydrateRuntimeFromTelemetryRow = (row: any) => {
  if (!row?.provider_id) return;
  const providerId = row.provider_id as WhoisProviderId;
  const state = getRuntimeState(providerId);
  const currentMonth = monthKey();
  const rowMonthKey = row.month_key || currentMonth;

  state.monthKey = rowMonthKey;
  state.estimatedMonthUsed = rowMonthKey === currentMonth ? Number(row.estimated_month_used || 0) : 0;
  state.recentStarts = Array.isArray(row.recent_starts)
    ? row.recent_starts
        .map((value: string) => new Date(value).getTime())
        .filter((value: number) => Number.isFinite(value))
    : [];
  state.blockedUntil = row.blocked_until ? new Date(row.blocked_until).getTime() : null;
  state.blockReason = row.block_reason || undefined;
  state.lastUsedAt = row.last_used_at ? new Date(row.last_used_at).getTime() : undefined;
  state.quota = row.quota || undefined;
  const now = Date.now();
  state.recentStarts = state.recentStarts.filter(startedAt => now - startedAt < 60_000);
};

export const loadPersistentTelemetry = async (telemetryClient?: any) => {
  if (!telemetryClient) return;

  const { data, error } = await telemetryClient
    .from(WHOIS_PROVIDER_TELEMETRY_TABLE)
    .select('*');

  if (error) {
    if (isTelemetrySchemaError(error)) {
      warnTelemetryUnavailable(error);
      return;
    }
    console.warn(`Could not load WHOIS provider telemetry: ${error.message || error}`);
    return;
  }

  (data || []).forEach(hydrateRuntimeFromTelemetryRow);
};

export const persistPersistentTelemetry = async (providerId: WhoisProviderId, telemetryClient?: any) => {
  if (!telemetryClient) return;

  const state = getRuntimeState(providerId);
  const payload = {
    provider_id: providerId,
    month_key: state.monthKey,
    blocked_until: state.blockedUntil ? new Date(state.blockedUntil).toISOString() : null,
    block_reason: state.blockReason || null,
    quota: state.quota || null,
    last_used_at: state.lastUsedAt ? new Date(state.lastUsedAt).toISOString() : null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await telemetryClient
    .from(WHOIS_PROVIDER_TELEMETRY_TABLE)
    .upsert(payload, { onConflict: 'provider_id' });

  if (error) {
    if (isTelemetrySchemaError(error)) {
      warnTelemetryUnavailable(error);
      return;
    }
    console.warn(`Could not persist WHOIS provider telemetry for ${providerId}: ${error.message || error}`);
  }
};

export const claimPersistentProviderAttempt = async (
  provider: WhoisProviderConfig,
  telemetryClient?: any,
): Promise<{ skipReason: string | null; claimed: boolean }> => {
  if (!telemetryClient) return { skipReason: null, claimed: false };

  const { data, error } = await telemetryClient.rpc('claim_whois_provider_attempt', {
    p_provider_id: provider.id,
    p_month_key: monthKey(),
    p_per_minute_limit: provider.perMinuteLimit,
    p_monthly_limit: provider.monthlyFreeLimit,
  });

  if (error) {
    if (isTelemetrySchemaError(error)) {
      warnTelemetryUnavailable(error);
      return { skipReason: null, claimed: false };
    }
    console.warn(`Could not claim WHOIS provider telemetry for ${provider.id}: ${error.message || error}`);
    return { skipReason: null, claimed: false };
  }

  const claim = Array.isArray(data) ? data[0] : data;
  if (!claim) return { skipReason: null, claimed: false };

  const state = getRuntimeState(provider.id);
  state.estimatedMonthUsed = Number(claim.estimated_month_used || state.estimatedMonthUsed);

  if (claim.allowed === false) {
    const retryAt = claim.retry_after ? new Date(claim.retry_after).getTime() : null;
    state.blockedUntil = retryAt;
    state.blockReason = claim.reason || 'Provider is blocked by persistent quota telemetry.';
    return {
      claimed: true,
      skipReason: retryAt
        ? `${state.blockReason} Retry after ${new Date(retryAt).toISOString()}.`
        : state.blockReason,
    };
  }

  const { data: row, error: rowError } = await telemetryClient
    .from(WHOIS_PROVIDER_TELEMETRY_TABLE)
    .select('*')
    .eq('provider_id', provider.id)
    .single();

  if (!rowError && row) {
    hydrateRuntimeFromTelemetryRow(row);
  }

  return { skipReason: null, claimed: true };
};

const pruneRecentStarts = (state: WhoisProviderRuntimeState, now: number) => {
  state.recentStarts = state.recentStarts.filter(startedAt => now - startedAt < 60_000);
};

export const updateRuntimeQuota = (providerId: WhoisProviderId, quota?: WhoisQuota) => {
  if (!hasQuotaData(quota)) return;
  const now = Date.now();
  const state = getRuntimeState(providerId);
  state.quota = quota;

  if (quota.remainingDay !== null && quota.remainingDay <= 0) {
    state.blockedUntil = nextUtcDay(now);
    state.blockReason = 'Provider daily quota is exhausted.';
  }

  if (quota.remainingMonth !== null && quota.remainingMonth <= 0) {
    state.blockedUntil = nextUtcMonth(now);
    state.blockReason = 'Provider monthly quota is exhausted.';
  }
};

export const getRuntimeSkipReason = (provider: WhoisProviderConfig, now = Date.now()): string | null => {
  const state = getRuntimeState(provider.id);
  pruneRecentStarts(state, now);

  if (state.blockedUntil && state.blockedUntil > now) {
    const resetAt = new Date(state.blockedUntil).toISOString();
    return `${state.blockReason || 'Provider is temporarily blocked.'} Retry after ${resetAt}.`;
  }

  if (state.blockedUntil && state.blockedUntil <= now) {
    state.blockedUntil = null;
    state.blockReason = undefined;
  }

  if (provider.perMinuteLimit !== null && state.recentStarts.length >= provider.perMinuteLimit) {
    const oldestStart = state.recentStarts[0] || now;
    const retryAt = oldestStart + 60_000;
    return `Provider per-minute limit reached in this runtime. Retry after ${new Date(retryAt).toISOString()}.`;
  }

  if (provider.monthlyFreeLimit !== null && state.estimatedMonthUsed >= provider.monthlyFreeLimit) {
    state.blockedUntil = nextUtcMonth(now);
    state.blockReason = 'Provider monthly free-tier estimate is exhausted in this runtime.';
    return `${state.blockReason} Retry after ${new Date(state.blockedUntil).toISOString()}.`;
  }

  return null;
};

export const markProviderStart = (provider: WhoisProviderConfig, countUsage = true) => {
  const now = Date.now();
  const state = getRuntimeState(provider.id);
  pruneRecentStarts(state, now);
  state.inFlight += 1;
  state.lastUsedAt = now;
  if (!countUsage) return;

  state.recentStarts.push(now);
  if (provider.monthlyFreeLimit !== null) {
    state.estimatedMonthUsed += 1;
  }
};

export const markProviderFinished = (providerId: WhoisProviderId) => {
  const state = getRuntimeState(providerId);
  state.inFlight = Math.max(0, state.inFlight - 1);
};

const isQuotaFailure = (message: string) => {
  return /\b429\b|too many requests|rate[\s-]?limit|quota|requests.*consumed|limit.*reached|exhausted/i.test(message);
};

export const markProviderFailure = (providerId: WhoisProviderId, message: string) => {
  if (!isQuotaFailure(message)) return;
  const state = getRuntimeState(providerId);
  state.blockedUntil = Date.now() + 60_000;
  state.blockReason = `Provider returned a quota or rate-limit error: ${message}`;
};
