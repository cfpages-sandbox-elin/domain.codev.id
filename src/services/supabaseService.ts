
import { createClient, Session, SupabaseClient } from '@supabase/supabase-js';
import { Domain, DomainTag, DomainStatus, IntegrationClient, IntegrationScope, WhoisProviderCredentialInput } from '../types';

// The type for inserting a new row. DB handles id, user_id, and created_at.
export type DomainInsert = Omit<Domain, 'id' | 'user_id' | 'created_at'>;
// The type for updating a row. id, user_id and created_at should not be updatable.
export type DomainUpdate = Partial<Omit<Domain, 'id' | 'user_id' | 'created_at'>>;

// Define the database schema. This is our single source of truth for types.
export interface Database {
  public: {
    Tables: {
      domains: {
        Row: Domain; // The type of a row from the database. (alias for our Domain type)
        Insert: DomainInsert;
        Update: DomainUpdate;
        Relationships: [];
      };
      integration_clients: {
        Row: IntegrationClient;
        Insert: Omit<IntegrationClient, 'id' | 'created_at' | 'last_used_at' | 'revoked_at'> & {
          id?: string;
          created_at?: string;
          last_used_at?: string | null;
          revoked_at?: string | null;
        };
        Update: Partial<Omit<IntegrationClient, 'id' | 'user_id' | 'created_at' | 'token_hash'>>;
        Relationships: [];
      };
      whois_provider_credentials: {
        Row: {
          id: string;
          user_id: string;
          provider_id: string;
          api_key: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          provider_id: string;
          api_key: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          api_key?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      domain_status_type: DomainStatus;
      domain_tag_type: DomainTag;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}


const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let supabaseInstance: SupabaseClient<Database> | null = null;
export let supabaseConfigError: string | null = null;

if (!supabaseUrl || !supabaseAnonKey) {
  supabaseConfigError = "Application is not configured correctly.\n\nThe Supabase URL and Key are missing.\n\nPlease add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your environment variables and restart the application.\n\nRefer to README.md for setup instructions.";
} else {
  try {
    supabaseInstance = createClient<Database>(supabaseUrl, supabaseAnonKey);
  } catch (error) {
    console.error("Failed to initialize Supabase client:", error);
    supabaseConfigError = `Failed to initialize Supabase client.\n\nError: ${error instanceof Error ? error.message : String(error)}\n\nPlease check if your VITE_SUPABASE_URL is valid.`;
  }
}

export const supabase = supabaseInstance;


// --- Auth Functions ---

export const getSession = async (): Promise<Session | null> => {
    if (!supabase) return null;
    const { data, error } = await supabase.auth.getSession();
    if(error) {
        console.error("Error getting session:", error);
        return null;
    }
    return data.session;
};

export const signInWithGoogle = async () => {
    if (!supabase) {
      console.error("Cannot sign in: Supabase client is not initialized due to missing config.");
      alert("Authentication is not available. The application is not configured correctly.");
      return;
    }
    const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: window.location.origin, // Redirect back to the app after auth
        },
    });
    if (error) {
        console.error("Error signing in with Google:", error.message);
        alert(`Error signing in: ${error.message}`);
    }
};

export const signOut = async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if(error) {
         console.error("Error signing out:", error.message);
    }
};


// --- Domain Data Functions ---

export const getDomains = async (): Promise<Domain[] | null> => {
    if (!supabase) return null;
    const { data, error } = await supabase
        .from('domains')
        .select('*')
        .order('created_at', { ascending: false });
    
    if (error) {
        console.error("Error fetching domains:", error);
        alert('Could not fetch your domains. Please check the console and refresh.');
        return null;
    }
    return data;
};

export const addDomain = async (domainData: DomainInsert): Promise<Domain | null> => {
    if (!supabase) return null;
    // Supabase's generic payload inference can collapse to `never` with this hand-written schema.
    // Keep the public service API typed and avoid leaking the client typing issue to callers.
    const { data, error } = await supabase
        .from('domains')
        .insert([domainData] as never)
        .select()
        .single();
    
    if (error) {
        console.error("Error adding domain:", error);
        if (error.message.includes('unique constraint')) {
            alert('This domain is already in your tracking list.');
        } else {
            alert('Could not add the domain. Please try again.');
        }
        return null;
    }
    return data as Domain;
};

export const updateDomain = async (id: number, updates: DomainUpdate): Promise<Domain | null> => {
    if (!supabase) return null;
    // See addDomain: this cast is scoped to the Supabase client boundary.
    const { data, error } = await supabase
        .from('domains')
        .update(updates as never)
        .eq('id', id)
        .select()
        .single();
    
    if (error) {
        console.error("Error updating domain:", error);
        alert('Could not update the domain. Please try again.');
        return null;
    }
    return data as Domain;
};

export const removeDomain = async (id: number): Promise<boolean> => {
    if (!supabase) return false;
    const { error } = await supabase
        .from('domains')
        .delete()
        .eq('id', id);

    if (error) {
        console.error("Error removing domain:", error);
        alert('Could not remove the domain. Please try again.');
        return false;
    }
    return true;
};

// --- Integration Client Functions ---

export interface CreateIntegrationClientInput {
    name: string;
    tokenHash: string;
    scopes: IntegrationScope[];
    expiresAt?: string | null;
}

export const getIntegrationClients = async (): Promise<IntegrationClient[] | null> => {
    if (!supabase) return null;
    const { data, error } = await supabase
        .from('integration_clients')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Error fetching integration clients:", error);
        alert('Could not fetch integration clients.');
        return null;
    }

    return data as IntegrationClient[];
};

export const createIntegrationClient = async (input: CreateIntegrationClientInput): Promise<IntegrationClient | null> => {
    if (!supabase) return null;
    const session = await getSession();
    if (!session) return null;

    const { data, error } = await supabase
        .from('integration_clients')
        .insert([{
            user_id: session.user.id,
            name: input.name.trim(),
            token_hash: input.tokenHash,
            scopes: input.scopes,
            expires_at: input.expiresAt || null,
        }] as never)
        .select()
        .single();

    if (error) {
        console.error("Error creating integration client:", error);
        alert('Could not create integration token.');
        return null;
    }

    return data as IntegrationClient;
};

export const revokeIntegrationClient = async (id: string): Promise<IntegrationClient | null> => {
    if (!supabase) return null;
    const { data, error } = await supabase
        .from('integration_clients')
        .update({ revoked_at: new Date().toISOString() } as never)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error("Error revoking integration client:", error);
        alert('Could not revoke integration token.');
        return null;
    }

    return data as IntegrationClient;
};

// --- WHOIS Provider Credential Functions ---

export const saveWhoisProviderCredential = async (input: WhoisProviderCredentialInput): Promise<boolean> => {
    if (!supabase) return false;
    const session = await getSession();
    if (!session) return false;

    const { error } = await supabase
        .from('whois_provider_credentials')
        .upsert([{
            user_id: session.user.id,
            provider_id: input.providerId,
            api_key: input.apiKey.trim(),
            updated_at: new Date().toISOString(),
        }] as never, { onConflict: 'user_id,provider_id' });

    if (error) {
        console.error("Error saving WHOIS provider credential:", error);
        alert('Could not save the WHOIS provider key. Make sure the provider credential migration has been applied.');
        return false;
    }

    return true;
};

export const removeWhoisProviderCredential = async (providerId: string): Promise<boolean> => {
    if (!supabase) return false;

    const { error } = await supabase
        .from('whois_provider_credentials')
        .delete()
        .eq('provider_id', providerId);

    if (error) {
        console.error("Error removing WHOIS provider credential:", error);
        alert('Could not remove the WHOIS provider key.');
        return false;
    }

    return true;
};
