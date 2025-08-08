export type DomainTag = 'mine' | 'to-snatch';

export type DomainStatus = 'available' | 'registered' | 'expired' | 'dropped' | 'unknown';

// Matches the 'domains' table in Supabase
export interface Domain {
  id: number;
  user_id: string;
  domain_name: string;
  tag: DomainTag;
  status: DomainStatus;
  expiration_date: string | null;
  registered_date: string | null;
  registrar: string | null;
  last_checked: string;
  created_at: string;
}

// For creating a new domain. It's essentially the main type without database-generated columns.
export type NewDomain = {
  domain_name: string;
  tag: DomainTag;
  status: DomainStatus;
  expiration_date: string | null;
  registered_date: string | null;
  registrar: string | null;
  last_checked: string;
};

// For updating a domain. All properties are optional.
export type DomainUpdate = {
  domain_name?: string;
  tag?: DomainTag;
  status?: DomainStatus;
  expiration_date?: string | null;
  registered_date?: string | null;
  registrar?: string | null;
  last_checked?: string;
};

export interface WhoisData {
  status: DomainStatus;
  expirationDate: string | null;
  registeredDate: string | null;
  registrar: string | null;
}
