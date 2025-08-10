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
        const { data, error } = await supabase.functions.invoke('get-whois', {
            body: { domainName },
        });

        if (error) {
            // Handle different kinds of errors that can occur
            let errorMessage = `Error invoking function: ${error.message}`;
            if (error instanceof Error && 'details' in error) {
                errorMessage = `${errorMessage} - Details: ${JSON.stringify((error as any).details)}`;
            } else if (error instanceof Error && 'context' in error) {
                 const context = (error as any).context;
                 if (context?.code === 401) {
                    errorMessage = "Unauthorized: You may need to sign in again.";
                 } else if (context?.text) {
                     errorMessage = `Function returned an error: ${context.text}`;
                 }
            }

            log?.(`❌ ${errorMessage}`);
            console.error("Error fetching whois data:", error);
            return {
                status: 'unknown',
                expirationDate: null,
                registeredDate: null,
                registrar: `Error: Server-side check failed.`,
            };
        }
        
        log?.(`✅ Successfully received WHOIS data for ${domainName}.`);
        return data as WhoisData;

    } catch (e) {
        const error = e as Error;
        log?.(`❌ A critical error occurred while invoking the function: ${error.message}`);
        console.error("Critical error invoking Supabase function:", error);
        return {
            status: 'unknown',
            expirationDate: null,
            registeredDate: null,
            registrar: 'Error: Could not contact server.',
        };
    }
};
