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
// The `user_id` is assumed to be set by a database policy/default.
export type NewDomain = Omit<Domain, 'id' | 'user_id' | 'created_at'>;

// For updating a domain. All properties are optional.
// The previous definition as a full Partial<Domain> caused "type instantiation
// is excessively deep" errors with Supabase's generics. This explicit type,
// derived from Domain, resolves the issue by only including mutable fields.
export type DomainUpdate = Partial<Omit<Domain, 'id' | 'user_id' | 'created_at' | 'domain_name'>>;


export interface WhoisData {
  status: DomainStatus;
  expirationDate: string | null;
  registeredDate: string | null;
  registrar: string | null;
}
