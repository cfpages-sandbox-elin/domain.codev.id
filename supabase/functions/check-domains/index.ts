// This function runs on a cron schedule to check for domain status changes.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getWhoisData } from '../_shared/whois-logic.ts'

console.log('✅ "check-domains" function loaded');

//-------------------------------------------------
// Types
//-------------------------------------------------
type DomainTag = 'mine' | 'to-snatch';
type DomainStatus = 'available' | 'registered' | 'expired' | 'dropped' | 'unknown';

interface Domain {
  id: number;
  domain_name: string;
  status: DomainStatus;
  tag: DomainTag;
}

interface DomainUpdate {
  tag?: DomainTag;
  status?: DomainStatus;
  expiration_date?: string | null;
  registered_date?: string | null;
  registrar?: string | null;
  last_checked?: string | null;
}

//-------------------------------------------------
// Main Server Logic
//-------------------------------------------------
serve(async (req) => {
  try {
    // Check for the cron secret from the Authorization header
    // @ts-ignore
    const cronSecret = Deno.env.get('CRON_SECRET');
    if (!cronSecret) {
      console.error('CRON_SECRET is not set in environment variables. Function cannot run securely.');
      return new Response('Configuration error: Cron secret not set.', { status: 500 });
    }
    
    const authHeader = req.headers.get('Authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
      console.warn('Unauthorized cron job access attempt.');
      return new Response('Unauthorized', { status: 401 });
    }
    
    console.log('✅ Cron job authorized.');

    // Create a Supabase client with the service_role key
    // @ts-ignore
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    // @ts-ignore
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Fetch domains that are registered and past their expiry date, or already marked as expired.
    const now = new Date().toISOString();
    const { data: domains, error: fetchError } = await supabaseAdmin
      .from('domains')
      .select('id, domain_name, status, tag')
      .or(`(status.eq.registered,expiration_date.lt.${now}),status.eq.expired`);
    
    if (fetchError) throw fetchError;

    if (!domains || domains.length === 0) {
      console.log('No domains require checking at this time.');
      return new Response(JSON.stringify({ message: 'No domains to check.' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      });
    }
    console.log(`Found ${domains.length} domains to check.`);

    // Process each domain
    const updatePromises = domains.map(async (domain: Domain) => {
      console.log(`➡️ Checking ${domain.domain_name}...`);
      const whoisData = await getWhoisData(domain.domain_name);

      if (whoisData.status === 'unknown') {
        console.log(`⚠️ WHOIS check failed for ${domain.domain_name}. Skipping update.`);
        return null; // Skip update if WHOIS fails
      }
      
      const newStatus = (domain.status === 'expired' && whoisData.status === 'available') 
        ? 'dropped' 
        : whoisData.status;

      const payload: DomainUpdate & { id: number } = {
        id: domain.id,
        status: newStatus,
        expiration_date: whoisData.expirationDate,
        registered_date: whoisData.registeredDate,
        registrar: whoisData.registrar,
        last_checked: new Date().toISOString(),
      };

      if ((newStatus === 'available' || newStatus === 'dropped') && domain.tag === 'mine') {
        payload.tag = 'to-snatch';
        console.log(`✅ Switching tag for ${domain.domain_name} to "to-snatch" as it is now available.`);
      }
      
      console.log(`✅ Update for ${domain.domain_name}: status -> ${newStatus}`);
      return payload;
    });

    const results = await Promise.all(updatePromises);
    const updatesToApply = results.filter((r): r is (DomainUpdate & { id: number; }) => r !== null);

    // Batch update the domains in the database
    if (updatesToApply.length > 0) {
      console.log(`Applying ${updatesToApply.length} updates...`);
      const { error: updateError } = await supabaseAdmin
        .from('domains')
        .upsert(updatesToApply);

      if (updateError) throw updateError;
      console.log('✅ Batch update successful.');
    } else {
        console.log('No domains needed updates.');
    }

    return new Response(JSON.stringify({ message: `Checked ${domains.length} domains. Updated ${updatesToApply.length}.` }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (err) {
    console.error('An error occurred:', err.message);
    return new Response(String(err?.message ?? err), { status: 500 });
  }
});
