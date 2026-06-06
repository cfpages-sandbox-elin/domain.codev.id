import { DomainStatus } from './whois-status.ts';

export type WhoisProviderId =
  | 'who-dat'
  | 'whoisxmlapi'
  | 'apilayer'
  | 'whoisfreaks'
  | 'whoapi'
  | 'rapidapi'
  | 'rapidapi-domains-api'
  | 'whoisjson'
  | 'ip2whois'
  | 'rdap-iana'
  | 'rdap-org'
  | 'oti-labs'
  | 'domainduck'
  | 'rdap-api';

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

export interface WhoisProviderConfig {
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
  isConfigured: (credentials?: WhoisProviderCredentials) => boolean;
}

export interface WhoisProviderRuntimeState {
  inFlight: number;
  recentStarts: number[];
  estimatedMonthUsed: number;
  monthKey: string;
  blockedUntil: number | null;
  blockReason?: string;
  lastUsedAt?: number;
  quota?: WhoisQuota;
}

export interface WhoisRuntimeOptions {
  telemetryClient?: any;
  userId?: string;
}

export type WhoisProviderCredentials = Partial<Record<WhoisProviderId, string>>;
