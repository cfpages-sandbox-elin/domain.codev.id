export type DomainTag = 'mine' | 'to-snatch';

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
  created_at: string;
  last_checked: string | null;
}

// For creating a new domain. We omit database-generated fields.
// This is defined explicitly to avoid potential type inference issues in supabase-js.
export interface NewDomain {
  domain_name: string;
  tag: DomainTag;
  status: DomainStatus;
  expiration_date: string | null;
  registered_date: string | null;
  registrar: string | null;
  last_checked: string | null;
}


// For updating a domain. All properties are optional.
// This is defined explicitly to avoid potential type inference issues in supabase-js.
export interface DomainUpdate {
  tag?: DomainTag;
  status?: DomainStatus;
  expiration_date?: string | null;
  registered_date?: string | null;
  registrar?: string | null;
  last_checked?: string | null;
}


export interface WhoisData {
  status: DomainStatus;
  expirationDate: string | null;
  registeredDate: string | null;
  registrar: string | null;
}
