import { WhoisData } from '../types';
import { supabase } from './supabaseService';

export const getWhoisData = async (domainName: string, log?: (message: string) => void): Promise<WhoisData> => {
    log?.(`➡️ Invoking server-side WHOIS check for ${domainName}...`);

    if (!supabase) {
        const errorMsg = '❌ Supabase client not initialized. Cannot get WHOIS data.';
        log?.(errorMsg);
        console.error(errorMsg);
        return {
            status: 'unknown',
            expirationDate: null,
            registeredDate: null,
            registrar: 'Error: Application not configured.',
        };
    }

    try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
            log?.(`❌ Error getting user session: ${sessionError.message}`);
            console.error("Error getting session:", sessionError);
            return {
                status: 'unknown',
                expirationDate: null,
                registeredDate: null,
                registrar: 'Error: Could not authenticate.',
            };
        }

        if (!session) {
            log?.('❌ You must be logged in to perform a WHOIS check.');
            return {
                status: 'unknown',
                expirationDate: null,
                registeredDate: null,
                registrar: 'Error: Not logged in.',
            };
        }

        const response = await fetch('/api/get-whois', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ domainName }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Could not parse error response' }));
            const errorMessage = `Error from server: ${errorData.error || response.statusText}`;
            log?.(`❌ ${errorMessage}`);
            console.error("Error fetching whois data:", errorMessage);
            return {
                status: 'unknown',
                expirationDate: null,
                registeredDate: null,
                registrar: `Error: Server-side check failed.`,
            };
        }

        const data = await response.json();
        
        log?.(`✅ Successfully received WHOIS data for ${domainName}.`);
        return data as WhoisData;

    } catch (e) {
        const error = e as Error;
        log?.(`❌ A critical error occurred while invoking the function: ${error.message}`);
        console.error("Critical error invoking Cloudflare function:", error);
        return {
            status: 'unknown',
            expirationDate: null,
            registeredDate: null,
            registrar: 'Error: Could not contact server.',
        };
    }
};
