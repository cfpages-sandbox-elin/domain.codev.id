import { createClient } from '@supabase/supabase-js';
import { type Session } from '@supabase/supabase-js';

// Retrieve Supabase URL and Anon Key from environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Check if environment variables are set
if (!supabaseUrl || !supabaseAnonKey) {
 throw new Error('Missing Supabase environment variables. VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set.');
}

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Function to handle Google sign-in
export const signInWithGoogle = async () => {
 const { error } = await supabase.auth.signInWithOAuth({
 provider: 'google',
 options: {
      redirectTo: window.location.origin, // Redirect back to the current origin after sign-in
 },
 });
 if (error) {
 console.error('Error signing in with Google:', error);
 }
};

// Function to handle sign-out
export const signOut = async () => {
 const { error } = await supabase.auth.signOut();
 if (error) {
 console.error('Error signing out:', error);
 }
};

// Function to get the current user session
export const getSession = async (): Promise<Session | null> => {
 const { data: { session }, error } = await supabase.auth.getSession();
 if (error) {
 console.error('Error getting session:', error);
 return null;
 }
 return session;
};
