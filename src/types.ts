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
}

// For creating a new domain. Derived from Domain to ensure consistency.
// We omit database-generated fields.
export interface NewDomain {
  domain_name: string;
  tag: DomainTag;
  status: DomainStatus;
  expiration_date: string | null;
  registered_date: string | null;
  registrar: string | null;
}

// For updating a domain. All properties are optional.
// The previous definition as a full Partial<Domain> caused "type instantiation
// is excessively deep" errors with Supabase's generics, as it included
// immutable properties like `id`, `user_id`, and `created_at`.
// This explicit interface resolves the issue by only including mutable fields.
export interface DomainUpdate {
  tag?: DomainTag;
  status?: DomainStatus;
  expiration_date?: string | null;
  registered_date?: string | null;
  registrar?: string | null;
}


export interface WhoisData {
  status: DomainStatus;
  expirationDate: string | null;
  registeredDate: string | null;
  registrar: string | null;
}