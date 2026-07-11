export type SerpProviderId =
  | 'serper'
  | 'serpapi'
  | 'searchapi'
  | 'valueserp'
  | 'scaleserp'
  | 'zenserp'
  | 'serpwow'
  | 'serpstack'
  | 'scrapingdog'
  | 'hasdata';

export type SerpDevice = 'desktop' | 'mobile';

export interface SerpOrganicHit {
  position: number;
  url: string;
  domain: string;
  title?: string;
  snippet?: string;
}

export interface SerpFetchInput {
  keyword: string;
  locale: string;
  device: SerpDevice;
  location?: string | null;
  depth?: number;
  apiKey: string;
}

export interface SerpFetchResult {
  provider: SerpProviderId;
  organic: SerpOrganicHit[];
}

export interface SerpProviderAttempt {
  provider: SerpProviderId;
  status: 'success' | 'failed' | 'skipped';
  errorMessage?: string;
}

export interface SerpProviderRegistryEntry {
  id: SerpProviderId;
  label: string;
  priority: number;
  freeTierLabel: string;
  monthlyFreeEstimate: number | null;
  notes: string;
  signupUrl: string;
}

export interface SerpProviderStatus extends SerpProviderRegistryEntry {
  configured: boolean;
  enabled: boolean;
  status: 'active' | 'missing-key' | 'blocked';
  estimatedMonthUsed?: number;
  blockedUntil?: string | null;
  lastErrorMessage?: string | null;
  lastUsedAt?: string | null;
}

export interface NormalizedSerpSnapshot {
  version: 1;
  keyword: string;
  engine: string;
  locale: string;
  device: SerpDevice;
  location?: string | null;
  checkedAt: string;
  provider: SerpProviderId;
  organic: SerpOrganicHit[];
}

export type RankMatchMode = 'domain' | 'subdomain' | 'exact_url' | 'prefix';
