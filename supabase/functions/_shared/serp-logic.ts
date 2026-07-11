import { SERP_ADAPTERS } from './serp-adapters.ts';
import { findBestRankHit } from './serp-match.ts';
import { SERP_PROVIDER_REGISTRY } from './serp-registry.ts';
import type {
  NormalizedSerpSnapshot,
  RankMatchMode,
  SerpFetchInput,
  SerpOrganicHit,
  SerpProviderAttempt,
  SerpProviderId,
  SerpProviderStatus,
  SerpDevice,
} from './serp-types.ts';

const monthKey = (date = new Date()) =>
  `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;

type TelemetryRow = {
  provider_id: string;
  user_id: string;
  month_key: string;
  estimated_month_used: number;
  blocked_until: string | null;
  block_reason: string | null;
  last_used_at: string | null;
  last_error_message: string | null;
};

export const loadSerpCredentials = async (
  admin: any,
  userId: string,
): Promise<Map<SerpProviderId, string>> => {
  const map = new Map<SerpProviderId, string>();
  const { data, error } = await admin
    .from('serp_provider_credentials')
    .select('provider_id, api_key')
    .eq('user_id', userId);
  if (error) {
    if (/does not exist|schema cache/i.test(error.message || '')) return map;
    throw error;
  }
  for (const row of data || []) {
    if (row.provider_id && row.api_key) {
      map.set(row.provider_id as SerpProviderId, String(row.api_key));
    }
  }
  return map;
};

export const loadSerpTelemetry = async (
  admin: any,
  userId: string,
): Promise<Map<string, TelemetryRow>> => {
  const map = new Map<string, TelemetryRow>();
  const { data, error } = await admin
    .from('serp_provider_telemetry')
    .select('*')
    .eq('user_id', userId);
  if (error) {
    if (/does not exist|schema cache/i.test(error.message || '')) return map;
    throw error;
  }
  for (const row of data || []) {
    map.set(row.provider_id, row as TelemetryRow);
  }
  return map;
};

const isBlocked = (row?: TelemetryRow | null) => {
  if (!row?.blocked_until) return false;
  return new Date(row.blocked_until).getTime() > Date.now();
};

const freeLimitReached = (entry: typeof SERP_PROVIDER_REGISTRY[number], row?: TelemetryRow | null) => {
  if (!entry.monthlyFreeEstimate || !row) return false;
  if (row.month_key !== monthKey()) return false;
  return row.estimated_month_used >= entry.monthlyFreeEstimate;
};

export const getSerpProviderStatuses = async (
  admin: any,
  userId: string,
): Promise<SerpProviderStatus[]> => {
  const [credentials, telemetry] = await Promise.all([
    loadSerpCredentials(admin, userId),
    loadSerpTelemetry(admin, userId),
  ]);

  return SERP_PROVIDER_REGISTRY
    .slice()
    .sort((a, b) => a.priority - b.priority)
    .map(entry => {
      const configured = credentials.has(entry.id);
      const row = telemetry.get(entry.id);
      const blocked = isBlocked(row);
      const exhausted = freeLimitReached(entry, row);
      return {
        ...entry,
        configured,
        enabled: configured && !blocked && !exhausted,
        status: !configured ? 'missing-key' : blocked || exhausted ? 'blocked' : 'active',
        estimatedMonthUsed: row?.month_key === monthKey() ? row.estimated_month_used : 0,
        blockedUntil: row?.blocked_until ?? null,
        lastErrorMessage: row?.last_error_message ?? null,
        lastUsedAt: row?.last_used_at ?? null,
      };
    });
};

const recordTelemetry = async (
  admin: any,
  userId: string,
  providerId: SerpProviderId,
  result: 'success' | 'failed',
  errorMessage?: string,
) => {
  const now = new Date().toISOString();
  const key = monthKey();
  const { data: existing } = await admin
    .from('serp_provider_telemetry')
    .select('*')
    .eq('user_id', userId)
    .eq('provider_id', providerId)
    .maybeSingle();

  const used = existing && existing.month_key === key
    ? Number(existing.estimated_month_used || 0) + (result === 'success' ? 1 : 0)
    : result === 'success' ? 1 : 0;

  const blockedUntil = result === 'failed' && /429|quota|limit|rate/i.test(errorMessage || '')
    ? new Date(Date.now() + 60 * 60 * 1000).toISOString()
    : existing?.blocked_until && new Date(existing.blocked_until).getTime() > Date.now()
      ? existing.blocked_until
      : null;

  await admin.from('serp_provider_telemetry').upsert({
    user_id: userId,
    provider_id: providerId,
    month_key: key,
    estimated_month_used: used,
    blocked_until: blockedUntil,
    block_reason: blockedUntil ? (errorMessage || 'rate/quota') : null,
    last_used_at: now,
    last_error_message: result === 'failed' ? (errorMessage || 'failed') : null,
    updated_at: now,
  }, { onConflict: 'user_id,provider_id' });
};

export const fetchSerpWithRotation = async (
  admin: any,
  userId: string,
  input: Omit<SerpFetchInput, 'apiKey'>,
): Promise<{ result: { provider: SerpProviderId; organic: SerpOrganicHit[] }; attempts: SerpProviderAttempt[] }> => {
  const credentials = await loadSerpCredentials(admin, userId);
  const telemetry = await loadSerpTelemetry(admin, userId);
  const attempts: SerpProviderAttempt[] = [];

  const ordered = SERP_PROVIDER_REGISTRY.slice().sort((a, b) => a.priority - b.priority);

  for (const entry of ordered) {
    const apiKey = credentials.get(entry.id);
    if (!apiKey) {
      attempts.push({ provider: entry.id, status: 'skipped', errorMessage: 'missing key' });
      continue;
    }
    const row = telemetry.get(entry.id);
    if (isBlocked(row)) {
      attempts.push({ provider: entry.id, status: 'skipped', errorMessage: 'temporarily blocked' });
      continue;
    }
    if (freeLimitReached(entry, row)) {
      attempts.push({ provider: entry.id, status: 'skipped', errorMessage: 'free tier estimate exhausted' });
      continue;
    }

    try {
      const result = await SERP_ADAPTERS[entry.id]({ ...input, apiKey });
      if (!result.organic.length) {
        throw new Error('empty organic results');
      }
      await recordTelemetry(admin, userId, entry.id, 'success');
      attempts.push({ provider: entry.id, status: 'success' });
      return { result, attempts };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await recordTelemetry(admin, userId, entry.id, 'failed', message);
      attempts.push({ provider: entry.id, status: 'failed', errorMessage: message });
    }
  }

  throw Object.assign(new Error('All SERP providers failed or were skipped. Add API keys in Settings → SERP Providers.'), {
    attempts,
  });
};

export const buildSnapshot = (
  input: { keyword: string; locale: string; device: SerpDevice; location?: string | null },
  provider: SerpProviderId,
  organic: SerpOrganicHit[],
): NormalizedSerpSnapshot => ({
  version: 1,
  keyword: input.keyword,
  engine: 'google',
  locale: input.locale,
  device: input.device,
  location: input.location ?? null,
  checkedAt: new Date().toISOString(),
  provider,
  organic,
});

export const derivePositions = (
  organic: SerpOrganicHit[],
  links: Array<{ domain_id: number; domain_name: string; match_mode: RankMatchMode; target_url?: string | null }>,
) => links.map(link => {
  const hit = findBestRankHit(organic, link.domain_name, link.match_mode, link.target_url);
  return {
    domain_id: link.domain_id,
    position: hit?.position ?? null,
    rank_url: hit?.url ?? null,
    rank_title: hit?.title ?? null,
    found: Boolean(hit),
  };
});
