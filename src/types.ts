export type DomainTag = 'mine' | 'to-snatch' | 'others';

export type DomainStatus = 'available' | 'registered' | 'expired' | 'dropped' | 'reserved' | 'unknown';

// The ground truth for a domain record from the database.
export interface Domain {
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

export interface WhoisData {
  status: DomainStatus;
  expirationDate: string | null;
  registeredDate: string | null;
  registrar: string | null;
  domainStatuses?: string[];
  nameServers?: string[];
  provider?: string;
  providerLabel?: string;
  providerAttempts?: WhoisProviderAttempt[];
  quota?: WhoisQuota;
}

export interface WhoisQuota {
  limitMonth: number | null;
  remainingMonth: number | null;
  limitDay: number | null;
  remainingDay: number | null;
}

export interface WhoisProviderAttempt {
  provider: string;
  providerLabel: string;
  status: 'success' | 'failed' | 'skipped';
  errorMessage?: string;
  quota?: WhoisQuota;
}

export interface WhoisProviderStatus {
  id: string;
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
  lastResultAt?: string;
  lastErrorMessage?: string;
}

export interface WhoisProviderCredentialInput {
  providerId: string;
  apiKey: string;
}

export interface AutoMineRule {
  id: string;
  label: string;
  nameServers: string[];
  enabled: boolean;
}

export interface CategoryManualOverride {
  includeDomainIds: number[];
  excludeDomainIds: number[];
}

export type CategoryManualOverrides = Record<string, CategoryManualOverride>;

export interface CategoryWordGroup {
  id: string;
  label: string;
  words: string[];
  enabled: boolean;
}

export interface UserAppSettings {
  categoryNameOverrides: Record<string, string>;
  categoryManualOverrides: CategoryManualOverrides;
  categoryWordGroups: CategoryWordGroup[];
  autoMineRules: AutoMineRule[];
}

export type IntegrationScope = 'domains:read' | 'domains:write' | 'whois:check' | 'alerts:read' | 'webhooks:write';

export interface IntegrationClient {
  id: string;
  user_id: string;
  name: string;
  token_hash: string;
  scopes: IntegrationScope[];
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export interface NotificationChannel {
  id: string;
  user_id: string;
  type: 'webhook' | 'hermes';
  name: string;
  config: { url?: string; secret?: string };
  enabled: boolean;
  created_at: string;
}

export interface NotificationDelivery {
  id: string;
  channel_id: string | null;
  event_type: string;
  status: 'pending' | 'sent' | 'failed' | 'acknowledged';
  attempt_count: number;
  last_error: string | null;
  created_at: string;
  sent_at: string | null;
  payload: Record<string, unknown>;
}

export interface DomainMonitoringSettings {
  user_id: string;
  enabled: boolean;
  max_checks_per_run: number;
  grace_interval_hours: number;
  pre_drop_start_days: number;
  pre_drop_interval_hours: number;
  estimated_drop_days: number;
  active_window_before_hours: number;
  active_window_after_hours: number;
  active_interval_minutes: number;
  post_window_interval_hours: number;
  created_at: string;
  updated_at: string;
}

export type DomainMonitoringSettingsInput = Omit<DomainMonitoringSettings, 'user_id' | 'created_at' | 'updated_at'>;

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

export type RankMatchMode = 'domain' | 'subdomain' | 'exact_url' | 'prefix';
export type RankDevice = 'desktop' | 'mobile';

export interface SerpProviderStatus {
  id: SerpProviderId;
  label: string;
  priority: number;
  freeTierLabel: string;
  monthlyFreeEstimate: number | null;
  notes: string;
  signupUrl: string;
  configured: boolean;
  enabled: boolean;
  status: 'active' | 'missing-key' | 'blocked';
  estimatedMonthUsed?: number;
  blockedUntil?: string | null;
  lastErrorMessage?: string | null;
  lastUsedAt?: string | null;
}

export interface RankKeyword {
  id: string;
  user_id: string;
  keyword: string;
  keyword_key: string;
  engine: string;
  locale: string;
  device: RankDevice;
  location: string | null;
  enabled: boolean;
  check_interval_hours: number;
  last_checked_at: string | null;
  next_check_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RankKeywordDomain {
  keyword_id: string;
  domain_id: number;
  user_id: string;
  match_mode: RankMatchMode;
  target_url: string | null;
  created_at: string;
}

export interface RankPosition {
  id: number;
  check_id: string;
  keyword_id: string;
  domain_id: number;
  user_id: string;
  position: number | null;
  rank_url: string | null;
  rank_title: string | null;
  found: boolean;
  created_at: string;
}

export interface RankKeywordWithLinks extends RankKeyword {
  domainIds: number[];
  latestPositions: Array<{
    domain_id: number;
    position: number | null;
    found: boolean;
    rank_url: string | null;
    created_at: string;
  }>;
}

export interface SerpProviderCredentialInput {
  providerId: SerpProviderId;
  apiKey: string;
}
