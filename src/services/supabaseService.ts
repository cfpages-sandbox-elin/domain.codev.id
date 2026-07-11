
import { createClient, Session, SupabaseClient } from '@supabase/supabase-js';
import { Domain, DomainMonitoringSettings, DomainMonitoringSettingsInput, DomainTag, DomainStatus, IntegrationClient, IntegrationScope, NotificationChannel, NotificationDelivery, SerpProviderCredentialInput, UserAppSettings, WhoisProviderCredentialInput } from '../types';
import { sanitizeAutoMineRules, sanitizeCategoryManualOverrides, sanitizeCategoryNameOverrides, sanitizeCategoryWordGroups } from '../utils/userSettingsStorage';

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
      notification_channels: {
        Row: NotificationChannel;
        Insert: Omit<NotificationChannel, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<Omit<NotificationChannel, 'id' | 'user_id' | 'created_at'>>;
        Relationships: [];
      };
      notification_deliveries: {
        Row: NotificationDelivery;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      domain_monitoring_settings: {
        Row: DomainMonitoringSettings;
        Insert: DomainMonitoringSettingsInput & { user_id: string; created_at?: string; updated_at?: string };
        Update: Partial<DomainMonitoringSettingsInput> & { updated_at?: string };
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
      app_user_settings: {
        Row: {
          user_id: string;
          category_name_overrides: Record<string, string>;
          category_manual_overrides: Record<string, unknown>;
          category_word_groups: unknown[];
          auto_mine_rules: unknown[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          category_name_overrides?: Record<string, string>;
          category_manual_overrides?: Record<string, unknown>;
          category_word_groups?: unknown[];
          auto_mine_rules?: unknown[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          category_name_overrides?: Record<string, string>;
          category_manual_overrides?: Record<string, unknown>;
          category_word_groups?: unknown[];
          auto_mine_rules?: unknown[];
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

export const getDomains = async (options: { silent?: boolean } = {}): Promise<Domain[] | null> => {
    if (!supabase) return null;
    const { data, error } = await supabase
        .from('domains')
        .select('*')
        .order('created_at', { ascending: false });
    
    if (error) {
        console.error("Error fetching domains:", error);
        if (!options.silent) alert('Could not fetch your domains. Please check the console and refresh.');
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

export const getNotificationChannels = async (): Promise<NotificationChannel[]> => {
    if (!supabase) return [];
    const { data, error } = await supabase
        .from('notification_channels')
        .select('*')
        .order('created_at', { ascending: false });
    if (error) throw error;
    return data as NotificationChannel[];
};

export const createNotificationChannel = async (input: {
    name: string;
    type: NotificationChannel['type'];
    url: string;
    secret: string;
}): Promise<NotificationChannel> => {
    if (!supabase) throw new Error('Supabase is not configured.');
    const session = await getSession();
    if (!session) throw new Error('Sign in before creating a notification channel.');
    const { data, error } = await supabase
        .from('notification_channels')
        .insert([{
            user_id: session.user.id,
            name: input.name.trim(),
            type: input.type,
            config: { url: input.url.trim(), secret: input.secret },
            enabled: true,
        }] as never)
        .select()
        .single();
    if (error) throw error;
    return data as NotificationChannel;
};

export const setNotificationChannelEnabled = async (id: string, enabled: boolean): Promise<void> => {
    if (!supabase) return;
    const { error } = await supabase.from('notification_channels').update({ enabled } as never).eq('id', id);
    if (error) throw error;
};

export const removeNotificationChannel = async (id: string): Promise<void> => {
    if (!supabase) return;
    const { error } = await supabase.from('notification_channels').delete().eq('id', id);
    if (error) throw error;
};

export const getRecentNotificationDeliveries = async (): Promise<NotificationDelivery[]> => {
    if (!supabase) return [];
    const { data, error } = await supabase
        .from('notification_deliveries')
        .select('id, channel_id, event_type, status, attempt_count, last_error, created_at, sent_at, payload')
        .order('created_at', { ascending: false })
        .limit(10);
    if (error) throw error;
    return data as NotificationDelivery[];
};

export const getDomainMonitoringSettings = async (): Promise<DomainMonitoringSettingsInput | null> => {
    if (!supabase) return null;
    const { data, error } = await supabase
        .from('domain_monitoring_settings')
        .select('enabled, max_checks_per_run, grace_interval_hours, pre_drop_start_days, pre_drop_interval_hours, estimated_drop_days, active_window_before_hours, active_window_after_hours, active_interval_minutes, post_window_interval_hours')
        .maybeSingle();
    if (error) throw error;
    return data as DomainMonitoringSettingsInput | null;
};

export const saveDomainMonitoringSettings = async (settings: DomainMonitoringSettingsInput): Promise<void> => {
    if (!supabase) throw new Error('Supabase is not configured.');
    const session = await getSession();
    if (!session) throw new Error('Sign in before saving monitoring settings.');
    const { error } = await supabase
        .from('domain_monitoring_settings')
        .upsert([{
            user_id: session.user.id,
            ...settings,
            updated_at: new Date().toISOString(),
        }] as never, { onConflict: 'user_id' });
    if (error) throw error;
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

// --- SERP Provider Credential Functions ---

export const saveSerpProviderCredential = async (input: SerpProviderCredentialInput): Promise<boolean> => {
    if (!supabase) return false;
    const session = await getSession();
    if (!session) return false;

    const { error } = await supabase
        .from('serp_provider_credentials')
        .upsert([{
            user_id: session.user.id,
            provider_id: input.providerId,
            api_key: input.apiKey.trim(),
            updated_at: new Date().toISOString(),
        }] as never, { onConflict: 'user_id,provider_id' });

    if (error) {
        console.error('Error saving SERP provider credential:', error);
        alert('Could not save the SERP provider key. Apply the rank-tracking migration if you have not yet.');
        return false;
    }
    return true;
};

export const removeSerpProviderCredential = async (providerId: string): Promise<boolean> => {
    if (!supabase) return false;

    const { error } = await supabase
        .from('serp_provider_credentials')
        .delete()
        .eq('provider_id', providerId);

    if (error) {
        console.error('Error removing SERP provider credential:', error);
        alert('Could not remove the SERP provider key.');
        return false;
    }
    return true;
};

// --- App User Settings Functions ---

export const getUserAppSettings = async (): Promise<UserAppSettings | null> => {
    if (!supabase) return null;

    const { data, error } = await supabase
        .from('app_user_settings')
        .select('category_name_overrides, category_manual_overrides, category_word_groups, auto_mine_rules')
        .maybeSingle();

    if (error) {
        console.error("Error fetching app user settings:", error);
        return null;
    }

    if (!data) return null;
    const row = data as {
        category_name_overrides: unknown;
        category_manual_overrides?: unknown;
        category_word_groups?: unknown;
        auto_mine_rules: unknown;
    };

    return {
        categoryNameOverrides: sanitizeCategoryNameOverrides(row.category_name_overrides),
        categoryManualOverrides: sanitizeCategoryManualOverrides(row.category_manual_overrides),
        categoryWordGroups: sanitizeCategoryWordGroups(row.category_word_groups),
        autoMineRules: sanitizeAutoMineRules(row.auto_mine_rules),
    };
};

export const saveUserAppSettings = async (updates: Partial<UserAppSettings>): Promise<boolean> => {
    if (!supabase) return false;
    const session = await getSession();
    if (!session) return false;

    const payload: Record<string, unknown> = {
        user_id: session.user.id,
        updated_at: new Date().toISOString(),
    };

    if (updates.categoryNameOverrides) {
        payload.category_name_overrides = sanitizeCategoryNameOverrides(updates.categoryNameOverrides);
    }

    if (updates.categoryManualOverrides) {
        payload.category_manual_overrides = sanitizeCategoryManualOverrides(updates.categoryManualOverrides);
    }

    if (updates.categoryWordGroups) {
        payload.category_word_groups = sanitizeCategoryWordGroups(updates.categoryWordGroups);
    }

    if (updates.autoMineRules) {
        payload.auto_mine_rules = sanitizeAutoMineRules(updates.autoMineRules);
    }

    const { error } = await supabase
        .from('app_user_settings')
        .upsert([payload] as never, { onConflict: 'user_id' });

    if (error) {
        console.error("Error saving app user settings:", error);
        return false;
    }

    return true;
};
