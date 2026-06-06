import type { Domain, WhoisProviderStatus } from '../types';

const DOMAIN_CACHE_PREFIX = 'domain-codev-domains-cache:';
const PROVIDER_STATUS_CACHE_KEY = 'domain-codev-whois-provider-status-cache';

interface DomainCachePayload {
  userId: string;
  cachedAt: string;
  domains: Domain[];
}

interface ProviderStatusCachePayload {
  cachedAt: string;
  providers: WhoisProviderStatus[];
}

const isDomain = (value: unknown): value is Domain => {
  const record = value && typeof value === 'object' ? value as Record<string, unknown> : null;
  return Boolean(
    record
    && typeof record.id === 'number'
    && record.id > 0
    && typeof record.user_id === 'string'
    && typeof record.domain_name === 'string'
    && typeof record.created_at === 'string',
  );
};

export const readCachedDomains = (userId: string): Domain[] | null => {
  if (typeof window === 'undefined') return null;
  try {
    const payload = JSON.parse(window.localStorage.getItem(`${DOMAIN_CACHE_PREFIX}${userId}`) || 'null') as DomainCachePayload | null;
    if (!payload || payload.userId !== userId || !Array.isArray(payload.domains)) return null;
    return payload.domains.filter(isDomain);
  } catch {
    return null;
  }
};

export const writeCachedDomains = (userId: string, domains: Domain[]) => {
  if (typeof window === 'undefined') return;
  const payload: DomainCachePayload = {
    userId,
    cachedAt: new Date().toISOString(),
    domains: domains.filter(isDomain),
  };
  window.localStorage.setItem(`${DOMAIN_CACHE_PREFIX}${userId}`, JSON.stringify(payload));
};

const isProviderStatus = (value: unknown): value is WhoisProviderStatus => {
  const record = value && typeof value === 'object' ? value as Record<string, unknown> : null;
  return Boolean(
    record
    && typeof record.id === 'string'
    && typeof record.label === 'string'
    && typeof record.priority === 'number'
    && typeof record.status === 'string',
  );
};

export const readCachedWhoisProviderStatuses = (): WhoisProviderStatus[] | null => {
  if (typeof window === 'undefined') return null;
  try {
    const payload = JSON.parse(window.sessionStorage.getItem(PROVIDER_STATUS_CACHE_KEY) || 'null') as ProviderStatusCachePayload | null;
    if (!payload || !Array.isArray(payload.providers)) return null;
    return payload.providers.filter(isProviderStatus);
  } catch {
    return null;
  }
};

export const writeCachedWhoisProviderStatuses = (providers: WhoisProviderStatus[]) => {
  if (typeof window === 'undefined') return;
  const payload: ProviderStatusCachePayload = {
    cachedAt: new Date().toISOString(),
    providers: providers.filter(isProviderStatus),
  };
  window.sessionStorage.setItem(PROVIDER_STATUS_CACHE_KEY, JSON.stringify(payload));
};
