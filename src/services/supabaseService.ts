
import { createClient, Session, SupabaseClient } from '@supabase/supabase-js';
import { Domain, NewDomain, DomainUpdate, DomainTag, DomainStatus } from '../types';

// Define the database schema based on the existing types.
// This provides type safety for all Supabase queries.
export interface Database {
  public: {
    Tables: {
      domains: {
        Row: Domain; // The data shape returned from the database.
        Insert: NewDomain; // The data shape required to insert a new row.
        Update: DomainUpdate; // The data shape required to update a row.
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

export const addDomain = async (domainData: NewDomain): Promise<Domain | null> => {
    if (!supabase) return null;
    const { data, error } = await supabase
        .from('domains')
        .insert([domainData])
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
    return data;
};

export const updateDomain = async (id: number, updates: DomainUpdate): Promise<Domain | null> => {
    if (!supabase) return null;
    const { data, error } = await supabase
        .from('domains')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
    
    if (error) {
        console.error("Error updating domain:", error);
        alert('Could not update the domain. Please try again.');
        return null;
    }
    return data;
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
