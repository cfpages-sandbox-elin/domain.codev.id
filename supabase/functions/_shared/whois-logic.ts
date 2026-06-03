// Shared WHOIS logic for Supabase Edge Functions.

//-------------------------------------------------
// Types
//-------------------------------------------------
type DomainStatus = 'available' | 'registered' | 'expired' | 'dropped' | 'unknown';

export type WhoisProviderId =
  | 'who-dat'
  | 'whoisxmlapi'
  | 'apilayer'
  | 'whoisfreaks'
  | 'whoapi'
  | 'rapidapi'
  | 'whoisjson'
  | 'ip2whois';

export interface WhoisQuota {
  limitMonth: number | null;
  remainingMonth: number | null;
  limitDay: number | null;
  remainingDay: number | null;
}

export interface WhoisProviderAttempt {
  provider: WhoisProviderId;
  providerLabel: string;
  status: 'success' | 'failed' | 'skipped';
  errorMessage?: string;
  quota?: WhoisQuota;
}

export interface WhoisData {
  status: DomainStatus;
  expirationDate: string | null;
  registeredDate: string | null;
  registrar: string | null;
  domainStatuses?: string[];
  nameServers?: string[];
  provider?: WhoisProviderId;
  providerLabel?: string;
  providerAttempts?: WhoisProviderAttempt[];
  quota?: WhoisQuota;
}

export interface WhoisProviderStatus {
  id: WhoisProviderId;
  label: string;
  implemented: boolean;
  configured: boolean;
  enabled: boolean;
  priority: number;
  envKeys: string[];
  freeTierLabel: string;
  supportsQuotaHeaders: boolean;
  status: 'active' | 'missing-key' | 'not-implemented' | 'disabled';
  notes: string;
  quota?: WhoisQuota;
}

interface WhoisProviderConfig {
  id: WhoisProviderId;
  label: string;
  implemented: boolean;
  enabled: boolean;
  priority: number;
  envKeys: string[];
  freeTierLabel: string;
  supportsQuotaHeaders: boolean;
  monthlyFreeLimit: number | null;
  perMinuteLimit: number | null;
  notes: string;
  isConfigured: () => boolean;
}

interface WhoisProviderRuntimeState {
  inFlight: number;
  recentStarts: number[];
  estimatedMonthUsed: number;
  monthKey: string;
  blockedUntil: number | null;
  blockReason?: string;
  lastUsedAt?: number;
  quota?: WhoisQuota;
}

interface WhoisRuntimeOptions {
  telemetryClient?: any;
}

//-------------------------------------------------
// Environment Variable Access
//-------------------------------------------------
// @ts-ignore
const WHO_DAT_URL = Deno.env.get('WHO_DAT_URL');
// @ts-ignore
const WHO_DAT_AUTH_KEY = Deno.env.get('WHO_DAT_AUTH_KEY');
// @ts-ignore
const WHOISXMLAPI_KEY = Deno.env.get('WHOIS_API_KEY') || Deno.env.get('VITE_WHOIS_API_KEY');
// @ts-ignore
const APILAYER_KEY = Deno.env.get('APILAYER_API_KEY') || Deno.env.get('VITE_APILAYER_API_KEY');
// @ts-ignore
const WHOISFREAKS_KEY = Deno.env.get('WHOISFREAKS_API_KEY') || Deno.env.get('VITE_WHOISFREAKS_API_KEY');
// @ts-ignore
const WHOAPI_COM_KEY = Deno.env.get('WHOAPI_COM_API_KEY') || Deno.env.get('VITE_WHOAPI_COM_API_KEY');
// @ts-ignore
const RAPIDAPI_KEY = Deno.env.get('RAPIDAPI_KEY') || Deno.env.get('VITE_RAPIDAPI_KEY');
// @ts-ignore
const WHOISJSON_API_KEY = Deno.env.get('WHOISJSON_API_KEY') || Deno.env.get('VITE_WHOISJSON_API_KEY');
// @ts-ignore
const IP2WHOIS_API_KEY = Deno.env.get('IP2WHOIS_API_KEY') || Deno.env.get('VITE_IP2WHOIS_API_KEY');

//-------------------------------------------------
// Provider Registry
//-------------------------------------------------
const WHOIS_PROVIDER_REGISTRY: WhoisProviderConfig[] = [
  {
    id: 'who-dat',
    label: 'who-dat',
    implemented: true,
    enabled: true,
    priority: 1,
    envKeys: ['WHO_DAT_URL', 'WHO_DAT_AUTH_KEY'],
    freeTierLabel: 'Self-hosted; depends on deployment',
    supportsQuotaHeaders: false,
    monthlyFreeLimit: null,
    perMinuteLimit: null,
    notes: 'Primary if WHO_DAT_URL exists.',
    isConfigured: () => Boolean(WHO_DAT_URL),
  },
  {
    id: 'whoisxmlapi',
    label: 'WhoisXMLAPI',
    implemented: true,
    enabled: true,
    priority: 2,
    envKeys: ['WHOIS_API_KEY', 'VITE_WHOIS_API_KEY'],
    freeTierLabel: '500 free WHOIS queries',
    supportsQuotaHeaders: false,
    monthlyFreeLimit: 500,
    perMinuteLimit: 10,
    notes: 'Good parsed WHOIS fallback.',
    isConfigured: () => Boolean(WHOISXMLAPI_KEY),
  },
  {
    id: 'apilayer',
    label: 'APILayer Whois API',
    implemented: true,
    enabled: true,
    priority: 3,
    envKeys: ['APILAYER_API_KEY', 'VITE_APILAYER_API_KEY'],
    freeTierLabel: '3,000 requests/month',
    supportsQuotaHeaders: true,
    monthlyFreeLimit: 3000,
    perMinuteLimit: 30,
    notes: 'Exposes monthly/daily rate-limit headers.',
    isConfigured: () => Boolean(APILAYER_KEY),
  },
  {
    id: 'whoisfreaks',
    label: 'WhoisFreaks',
    implemented: true,
    enabled: true,
    priority: 4,
    envKeys: ['WHOISFREAKS_API_KEY', 'VITE_WHOISFREAKS_API_KEY'],
    freeTierLabel: '500 signup credits',
    supportsQuotaHeaders: false,
    monthlyFreeLimit: 500,
    perMinuteLimit: 10,
    notes: 'Live WHOIS endpoint.',
    isConfigured: () => Boolean(WHOISFREAKS_KEY),
  },
  {
    id: 'whoapi',
    label: 'WhoAPI',
    implemented: true,
    enabled: true,
    priority: 5,
    envKeys: ['WHOAPI_COM_API_KEY', 'VITE_WHOAPI_COM_API_KEY'],
    freeTierLabel: 'Verify in account',
    supportsQuotaHeaders: false,
    monthlyFreeLimit: null,
    perMinuteLimit: 10,
    notes: 'Implemented fallback; current free quota not confirmed.',
    isConfigured: () => Boolean(WHOAPI_COM_KEY),
  },
  {
    id: 'rapidapi',
    label: 'RapidAPI Domain WHOIS Lookup',
    implemented: true,
    enabled: true,
    priority: 6,
    envKeys: ['RAPIDAPI_KEY', 'VITE_RAPIDAPI_KEY'],
    freeTierLabel: 'Marketplace plan varies',
    supportsQuotaHeaders: false,
    monthlyFreeLimit: null,
    perMinuteLimit: 10,
    notes: 'Optional last fallback.',
    isConfigured: () => Boolean(RAPIDAPI_KEY),
  },
  {
    id: 'whoisjson',
    label: 'WhoisJSON',
    implemented: true,
    enabled: true,
    priority: 7,
    envKeys: ['WHOISJSON_API_KEY', 'VITE_WHOISJSON_API_KEY'],
    freeTierLabel: '1,000 requests/month, 20 requests/minute',
    supportsQuotaHeaders: false,
    monthlyFreeLimit: 1000,
    perMinuteLimit: 20,
    notes: 'New backup provider. Response mapping may need adjustment after live testing.',
    isConfigured: () => Boolean(WHOISJSON_API_KEY),
  },
  {
    id: 'ip2whois',
    label: 'IP2WHOIS / IP2Location.io',
    implemented: true,
    enabled: true,
    priority: 8,
    envKeys: ['IP2WHOIS_API_KEY', 'VITE_IP2WHOIS_API_KEY'],
    freeTierLabel: '500 domain WHOIS queries/month',
    supportsQuotaHeaders: false,
    monthlyFreeLimit: 500,
    perMinuteLimit: 10,
    notes: 'New backup provider. Response mapping may need adjustment after live testing.',
    isConfigured: () => Boolean(IP2WHOIS_API_KEY),
  },
];

const providerRuntimeState = new Map<WhoisProviderId, WhoisProviderRuntimeState>();
const WHOIS_PROVIDER_TELEMETRY_TABLE = 'whois_provider_telemetry';
let telemetryWarningLogged = false;

const monthKey = (date = new Date()) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;

const nextUtcDay = (now: number) => {
  const date = new Date(now);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1);
};

const nextUtcMonth = (now: number) => {
  const date = new Date(now);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1);
};

const getRuntimeState = (providerId: WhoisProviderId): WhoisProviderRuntimeState => {
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

const loadPersistentTelemetry = async (telemetryClient?: any) => {
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

const persistPersistentTelemetry = async (providerId: WhoisProviderId, telemetryClient?: any) => {
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

const claimPersistentProviderAttempt = async (
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

const updateRuntimeQuota = (providerId: WhoisProviderId, quota?: WhoisQuota) => {
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

const getRuntimeSkipReason = (provider: WhoisProviderConfig, now = Date.now()): string | null => {
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

const markProviderStart = (provider: WhoisProviderConfig, countUsage = true) => {
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

const markProviderFinished = (providerId: WhoisProviderId) => {
  const state = getRuntimeState(providerId);
  state.inFlight = Math.max(0, state.inFlight - 1);
};

const isQuotaFailure = (message: string) => {
  return /\b429\b|too many requests|rate[\s-]?limit|quota|requests.*consumed|limit.*reached|exhausted/i.test(message);
};

const markProviderFailure = (providerId: WhoisProviderId, message: string) => {
  if (!isQuotaFailure(message)) return;
  const state = getRuntimeState(providerId);
  state.blockedUntil = Date.now() + 60_000;
  state.blockReason = `Provider returned a quota or rate-limit error: ${message}`;
};

const getProviderExecutionOrder = () => {
  return providerHandlers
    .slice()
    .sort(([providerIdA], [providerIdB]) => {
      const providerA = providerById(providerIdA);
      const providerB = providerById(providerIdB);
      const stateA = getRuntimeState(providerIdA);
      const stateB = getRuntimeState(providerIdB);

      if (stateA.inFlight !== stateB.inFlight) return stateA.inFlight - stateB.inFlight;
      return providerA.priority - providerB.priority;
    });
};

export const getWhoisProviderStatuses = async (telemetryClient?: any): Promise<WhoisProviderStatus[]> => {
  await loadPersistentTelemetry(telemetryClient);

  return WHOIS_PROVIDER_REGISTRY
    .slice()
    .sort((a, b) => a.priority - b.priority)
    .map((provider) => {
      const configured = provider.isConfigured();
      const runtime = getRuntimeState(provider.id);
      const skipReason = getRuntimeSkipReason(provider);
      const status = !provider.implemented
        ? 'not-implemented'
        : !provider.enabled
          ? 'disabled'
          : configured
            ? 'active'
            : 'missing-key';

      return {
        id: provider.id,
        label: provider.label,
        implemented: provider.implemented,
        configured,
        enabled: provider.enabled,
        priority: provider.priority,
        envKeys: provider.envKeys,
        freeTierLabel: provider.freeTierLabel,
        supportsQuotaHeaders: provider.supportsQuotaHeaders,
        status,
        notes: skipReason ? `${skipReason} ${provider.notes}` : provider.notes,
        quota: runtime.quota,
      };
    });
};

const providerById = (id: WhoisProviderId) => {
  const provider = WHOIS_PROVIDER_REGISTRY.find(item => item.id === id);
  if (!provider) throw new Error(`Unknown WHOIS provider: ${id}`);
  return provider;
};

const readQuotaHeaders = (headers: Headers): WhoisQuota => ({
  limitMonth: toNumber(headers.get('x-ratelimit-limit-month')),
  remainingMonth: toNumber(headers.get('x-ratelimit-remaining-month')),
  limitDay: toNumber(headers.get('x-ratelimit-limit-day')),
  remainingDay: toNumber(headers.get('x-ratelimit-remaining-day')),
});

const toNumber = (value: string | null): number | null => {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const hasQuotaData = (quota?: WhoisQuota): quota is WhoisQuota => {
  if (!quota) return false;
  return Object.values(quota).some(value => value !== null);
};

const compactStrings = (values: unknown[]): string[] => {
  return Array.from(new Set(values
    .flatMap(value => {
      if (Array.isArray(value)) return value;
      if (typeof value === 'string') return value.split(/[,;]/);
      return [];
    })
    .map(value => String(value).trim())
    .filter(Boolean)));
};

const readNameServers = (...values: unknown[]): string[] => compactStrings(values)
  .map(value => value.replace(/\.$/, '').toLowerCase());

const readDomainStatuses = (...values: unknown[]): string[] => compactStrings(values)
  .map(value => value.replace(/^https?:\/\/icann\.org\/epp#/i, ''));

const withProviderMetadata = (
  providerId: WhoisProviderId,
  data: WhoisData,
  attempts: WhoisProviderAttempt[],
): WhoisData => {
  const provider = providerById(providerId);
  const quota = hasQuotaData(data.quota) ? data.quota : undefined;
  return {
    ...data,
    provider: provider.id,
    providerLabel: provider.label,
    providerAttempts: attempts,
    quota,
  };
};

const getUnusableWhoisReason = (data: WhoisData): string | null => {
  if (data.status === 'unknown') {
    return 'Provider returned unknown status.';
  }

  if ((data.status === 'registered' || data.status === 'expired') && !data.expirationDate) {
    return 'Provider confirmed the domain is registered but did not return an expiry date.';
  }

  return null;
};

const getErrorMessage = (error: unknown): string => {
  return error instanceof Error ? error.message : String(error);
};

//-------------------------------------------------
// Provider 0: who-dat
//-------------------------------------------------
const getWhoisDataFromWhoDat = async (domainName: string): Promise<WhoisData> => {
  const headers = new Headers();
  if (WHO_DAT_AUTH_KEY) headers.append('Authorization', `Bearer ${WHO_DAT_AUTH_KEY}`);
  const response = await fetch(`${WHO_DAT_URL!}/${domainName}`, { headers });
  if (!response.ok) throw new Error(`who-dat failed: ${response.status}`);
  const data = await response.json();
  if (data.error) throw new Error(`who-dat error: ${data.error}`);
  const status = data.isAvailable ? 'available' : (new Date(data.dates?.expiry) < new Date() ? 'expired' : 'registered');
  return {
    status,
    expirationDate: data.dates?.expiry || null,
    registeredDate: data.dates?.created || null,
    registrar: data.registrar?.name || null,
    domainStatuses: readDomainStatuses(data.status, data.statuses),
    nameServers: readNameServers(data.nameservers, data.nameServers),
  };
};

//-------------------------------------------------
// Provider 1: WhoisXMLAPI
//-------------------------------------------------
const getWhoisDataFromWhoisXmlApi = async (domainName: string): Promise<WhoisData> => {
  if (!WHOISXMLAPI_KEY) throw new Error('WhoisXMLAPI Key not provided.');
  const url = `https://www.whoisxmlapi.com/whoisserver/WhoisService?apiKey=${WHOISXMLAPI_KEY}&domainName=${domainName}&outputFormat=JSON&da=2`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`WhoisXMLAPI failed: ${response.status}`);
  const data = await response.json();
  if (data.ErrorMessage) throw new Error(`WhoisXMLAPI Error: ${data.ErrorMessage.msg}`);
  const record = data.WhoisRecord;
  if (!record) throw new Error('Invalid API response from WhoisXMLAPI');
  const expiryDateStr = record.registryData?.expiresDate || record.expiresDate;
  const status = record.domainAvailability === 'AVAILABLE' ? 'available' : (expiryDateStr && new Date(expiryDateStr) < new Date() ? 'expired' : 'registered');
  return {
    status,
    expirationDate: expiryDateStr || null,
    registeredDate: record.registryData?.createdDate || record.createdDate || null,
    registrar: record.registrarName || null,
    domainStatuses: readDomainStatuses(record.status, record.registryData?.status),
    nameServers: readNameServers(record.nameServers?.hostNames, record.registryData?.nameServers?.hostNames),
  };
};

//-------------------------------------------------
// Provider 2: APILayer
//-------------------------------------------------
const APILAYER_SUPPORTED_TLDS = new Set(['com', 'me', 'net', 'org', 'sh', 'io', 'co', 'club', 'biz', 'mobi', 'info', 'us', 'domains', 'cloud', 'fr', 'au', 'ru', 'uk', 'nl', 'fi', 'br', 'hr', 'ee', 'ca', 'sk', 'se', 'no', 'cz', 'it', 'in', 'icu', 'top', 'xyz', 'cn', 'cf', 'hk', 'sg', 'pt', 'site', 'kz', 'si', 'ae', 'do', 'yoga', 'xxx', 'ws', 'work', 'wiki', 'watch', 'wtf', 'world', 'website', 'vip', 'ly', 'dev', 'network', 'company', 'page', 'rs', 'run', 'science', 'sex', 'shop', 'solutions', 'so', 'studio', 'style', 'tech', 'travel', 'vc', 'pub', 'pro', 'app', 'press', 'ooo', 'de']);

const getWhoisDataFromApiLayer = async (domainName: string): Promise<WhoisData> => {
  if (!APILAYER_KEY) throw new Error('APILayer Key not provided.');
  const tld = domainName.split('.').pop();
  if (!tld || !APILAYER_SUPPORTED_TLDS.has(tld)) {
    throw new Error(`TLD ".${tld}" is not supported by APILayer`);
  }
  const response = await fetch(`https://api.apilayer.com/whois/check?domain=${domainName}`, { headers: { apikey: APILAYER_KEY } });
  const quota = readQuotaHeaders(response.headers);
  if (!response.ok) throw new Error(`APILayer failed: ${response.status}`);
  const data = await response.json();
  if (data.message || !data.result) throw new Error(`APILayer Error: ${data.message || 'Invalid response'}`);
  const { result } = data;
  const status = result.status === 'available' ? 'available' : (result.expiration_date && new Date(result.expiration_date) < new Date() ? 'expired' : 'registered');
  return {
    status,
    expirationDate: result.expiration_date || null,
    registeredDate: result.creation_date || null,
    registrar: result.registrar || null,
    domainStatuses: readDomainStatuses(result.status, result.domain_status),
    nameServers: readNameServers(result.name_servers, result.nameservers),
    quota,
  };
};

//-------------------------------------------------
// Provider 3: WhoisFreaks
//-------------------------------------------------
const getWhoisDataFromWhoisFreaks = async (domainName: string): Promise<WhoisData> => {
  if (!WHOISFREAKS_KEY) throw new Error('WhoisFreaks Key not provided.');
  const url = `https://api.whoisfreaks.com/v1.0/whois?apiKey=${WHOISFREAKS_KEY}&whois=live&domainName=${domainName}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`WhoisFreaks failed: ${response.status}`);
  const data = await response.json();
  if (!data.status || data.error) throw new Error(`WhoisFreaks Error: ${data.error?.message || 'Request failed'}`);
  const status = data.domain_registered === 'no' ? 'available' : (data.expiry_date && new Date(data.expiry_date) < new Date() ? 'expired' : 'registered');
  return {
    status,
    expirationDate: data.expiry_date || null,
    registeredDate: data.create_date || null,
    registrar: data.domain_registrar?.registrar_name || null,
    domainStatuses: readDomainStatuses(data.domain_status, data.statuses),
    nameServers: readNameServers(data.name_servers, data.nameservers),
  };
};

//-------------------------------------------------
// Provider 4: WhoAPI
//-------------------------------------------------
const getWhoisDataFromWhoapi = async (domainName: string): Promise<WhoisData> => {
  if (!WHOAPI_COM_KEY) throw new Error('WhoAPI Key not provided.');
  const url = `https://api.whoapi.com/?apikey=${WHOAPI_COM_KEY}&r=whois&domain=${domainName}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`WhoAPI failed: ${response.status}`);
  const data = await response.json();
  if (data.status !== '0') throw new Error(`WhoAPI Error: ${data.status_desc || `Status ${data.status}`}`);
  const expiryDateStr = data.date_expires;
  const status = !data.registered ? 'available' : (expiryDateStr && new Date(expiryDateStr) < new Date() ? 'expired' : 'registered');
  const registrarContact = data.contacts?.find((c: any) => c.type === 'registrar');
  const registrarName = registrarContact?.organization || data.whois_name || null;
  return {
    status,
    expirationDate: expiryDateStr || null,
    registeredDate: data.date_created || null,
    registrar: registrarName,
    domainStatuses: readDomainStatuses(data.statuses, data.domain_status),
    nameServers: readNameServers(data.nameservers, data.name_servers),
  };
};

//-------------------------------------------------
// Provider 5: RapidAPI
//-------------------------------------------------
const getWhoisDataFromRapidApi = async (domainName: string): Promise<WhoisData> => {
  if (!RAPIDAPI_KEY) throw new Error('RapidAPI Key not provided.');

  const url = `https://domain-whois-lookup-api.p.rapidapi.com/whois?domain_name=${domainName}`;
  const response = await fetch(url, {
    headers: {
      'x-rapidapi-key': RAPIDAPI_KEY,
      'x-rapidapi-host': 'domain-whois-lookup-api.p.rapidapi.com',
    },
  });

  const data = await response.json();

  if (!response.ok) {
    if (response.status === 404 && data.status === 'Available for registration') {
      return {
        status: 'available',
        expirationDate: null,
        registeredDate: null,
        registrar: null,
      };
    }
    throw new Error(`RapidAPI request failed with status ${response.status}: ${data.error || JSON.stringify(data)}`);
  }

  const expiryDateStr = data.expiration_date;
  const status = expiryDateStr && new Date(expiryDateStr) < new Date() ? 'expired' : 'registered';

  return {
    status,
    expirationDate: data.expiration_date || null,
    registeredDate: data.creation_date || null,
    registrar: data.registrar || null,
    domainStatuses: readDomainStatuses(data.status, data.domain_status),
    nameServers: readNameServers(data.name_servers, data.nameservers),
  };
};

//-------------------------------------------------
// Provider 6: WhoisJSON
//-------------------------------------------------
const getWhoisDataFromWhoisJson = async (domainName: string): Promise<WhoisData> => {
  if (!WHOISJSON_API_KEY) throw new Error('WhoisJSON Key not provided.');
  const response = await fetch(`https://whoisjson.com/api/v1/whois?domain=${encodeURIComponent(domainName)}`, {
    headers: { Authorization: `Bearer ${WHOISJSON_API_KEY}` },
  });
  if (!response.ok) throw new Error(`WhoisJSON failed: ${response.status}`);
  const data = await response.json();
  const expiryDateStr = data.expires_at || data.expiration_date || data.expiresDate || null;
  const registeredDateStr = data.created_at || data.creation_date || data.createdDate || null;
  const isAvailable = data.available === true || data.domain_registered === false || data.registered === false;
  const status = isAvailable ? 'available' : (expiryDateStr && new Date(expiryDateStr) < new Date() ? 'expired' : 'registered');

  return {
    status,
    expirationDate: expiryDateStr,
    registeredDate: registeredDateStr,
    registrar: data.registrar || data.registrar_name || data.registrarName || null,
    domainStatuses: readDomainStatuses(data.status, data.domain_status, data.domainStatuses),
    nameServers: readNameServers(data.name_servers, data.nameservers, data.nameServers),
  };
};

//-------------------------------------------------
// Provider 7: IP2WHOIS
//-------------------------------------------------
const getWhoisDataFromIp2Whois = async (domainName: string): Promise<WhoisData> => {
  if (!IP2WHOIS_API_KEY) throw new Error('IP2WHOIS Key not provided.');
  const response = await fetch(`https://api.ip2whois.com/v2?key=${IP2WHOIS_API_KEY}&domain=${encodeURIComponent(domainName)}`);
  if (!response.ok) throw new Error(`IP2WHOIS failed: ${response.status}`);
  const data = await response.json();
  if (data.error || data.error_message) throw new Error(`IP2WHOIS Error: ${data.error_message || data.error}`);
  const expiryDateStr = data.expire_date || data.expiration_date || null;
  const registeredDateStr = data.create_date || data.creation_date || null;
  const status = data.available === true ? 'available' : (expiryDateStr && new Date(expiryDateStr) < new Date() ? 'expired' : 'registered');

  return {
    status,
    expirationDate: expiryDateStr,
    registeredDate: registeredDateStr,
    registrar: data.registrar?.name || data.registrar || null,
    domainStatuses: readDomainStatuses(data.status, data.domain_status),
    nameServers: readNameServers(data.nameservers, data.name_servers),
  };
};

//-------------------------------------------------
// Main Service Function (Waterfall)
//-------------------------------------------------
const providerHandlers: Array<[WhoisProviderId, (domainName: string) => Promise<WhoisData>]> = [
  ['who-dat', getWhoisDataFromWhoDat],
  ['whoisxmlapi', getWhoisDataFromWhoisXmlApi],
  ['apilayer', getWhoisDataFromApiLayer],
  ['whoisfreaks', getWhoisDataFromWhoisFreaks],
  ['whoapi', getWhoisDataFromWhoapi],
  ['rapidapi', getWhoisDataFromRapidApi],
  ['whoisjson', getWhoisDataFromWhoisJson],
  ['ip2whois', getWhoisDataFromIp2Whois],
];

export const getWhoisData = async (domainName: string, options: WhoisRuntimeOptions = {}): Promise<WhoisData> => {
  const attempts: WhoisProviderAttempt[] = [];
  await loadPersistentTelemetry(options.telemetryClient);

  for (const [providerId, handler] of getProviderExecutionOrder()) {
    const provider = providerById(providerId);

    if (!provider.enabled || !provider.implemented || !provider.isConfigured()) {
      attempts.push({
        provider: provider.id,
        providerLabel: provider.label,
        status: 'skipped',
        errorMessage: !provider.implemented
          ? 'Provider is not implemented.'
          : !provider.enabled
            ? 'Provider is disabled.'
            : 'Provider is missing required environment configuration.',
      });
      continue;
    }

    const runtimeSkipReason = getRuntimeSkipReason(provider);
    if (runtimeSkipReason) {
      attempts.push({
        provider: provider.id,
        providerLabel: provider.label,
        status: 'skipped',
        errorMessage: runtimeSkipReason,
      });
      continue;
    }

    const persistentClaim = await claimPersistentProviderAttempt(provider, options.telemetryClient);
    if (persistentClaim.skipReason) {
      attempts.push({
        provider: provider.id,
        providerLabel: provider.label,
        status: 'skipped',
        errorMessage: persistentClaim.skipReason,
      });
      continue;
    }

    markProviderStart(provider, !persistentClaim.claimed);
    try {
      const data = await handler(domainName);
      updateRuntimeQuota(provider.id, data.quota);
      await persistPersistentTelemetry(provider.id, options.telemetryClient);
      const unusableReason = getUnusableWhoisReason(data);
      if (unusableReason) {
        attempts.push({
          provider: provider.id,
          providerLabel: provider.label,
          status: 'failed',
          errorMessage: unusableReason,
          quota: hasQuotaData(data.quota) ? data.quota : undefined,
        });
        console.warn(`${provider.label} returned incomplete WHOIS data for ${domainName}: ${unusableReason}`);
        continue;
      }

      attempts.push({
        provider: provider.id,
        providerLabel: provider.label,
        status: 'success',
        quota: hasQuotaData(data.quota) ? data.quota : undefined,
      });
      return withProviderMetadata(provider.id, data, attempts);
    } catch (error) {
      const message = getErrorMessage(error);
      markProviderFailure(provider.id, message);
      await persistPersistentTelemetry(provider.id, options.telemetryClient);
      attempts.push({
        provider: provider.id,
        providerLabel: provider.label,
        status: 'failed',
        errorMessage: message,
      });
      console.error(`${provider.label} failed for ${domainName}: ${message}`);
    } finally {
      markProviderFinished(provider.id);
    }
  }

  console.error(`All WHOIS providers failed for ${domainName}.`);
  return {
    status: 'unknown',
    expirationDate: null,
    registeredDate: null,
    registrar: 'Error',
    providerAttempts: attempts,
  };
};
