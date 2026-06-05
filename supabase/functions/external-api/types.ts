export type DomainTag = 'mine' | 'to-snatch' | 'others';
export type DomainStatus = 'available' | 'registered' | 'expired' | 'dropped' | 'reserved' | 'unknown';
export type Scope = 'domains:read' | 'domains:write' | 'whois:check' | 'alerts:read' | 'webhooks:write';

export interface IntegrationClient {
  id: string;
  user_id: string;
  name: string;
  scopes: Scope[];
  revoked_at: string | null;
  expires_at: string | null;
}

export interface DomainRow {
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

export type DomainPayload = string | {
  domainName?: unknown;
  domain_name?: unknown;
  tag?: unknown;
};
