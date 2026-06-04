export type DomainTag = 'mine' | 'to-snatch' | 'others';

export type DomainStatus = 'available' | 'registered' | 'expired' | 'dropped' | 'unknown';

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
