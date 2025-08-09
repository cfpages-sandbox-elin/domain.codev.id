// Follow this guide to deploy and schedule this function:
// https://supabase.com/docs/guides/functions/cron-jobs

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

console.log('✅ "check-domains" function loaded');

//-------------------------------------------------
// Types
//-------------------------------------------------
type DomainStatus = 'available' | 'registered' | 'expired' | 'dropped' | 'unknown';

interface Domain {
  id: number;
  domain_name: string;
  status: DomainStatus;
}

interface DomainUpdate {
  status?: DomainStatus;
  expiration_date?: string | null;
  registered_date?: string | null;
  registrar?: string | null;
  last_checked?: string | null;
}

interface WhoisData {
  status: DomainStatus;
  expirationDate: string | null;
  registeredDate: string | null;
  registrar: string | null;
}

//-------------------------------------------------
// WHOIS Provider Logic (self-contained)
//-------------------------------------------------
// @ts-ignore
const WHO_DAT_URL = Deno.env.get('VITE_WHO_DAT_URL');
// @ts-ignore
const WHO_DAT_AUTH_KEY = Deno.env.get('VITE_WHO_DAT_AUTH_KEY');
// @ts-ignore
const WHOISXMLAPI_KEY = Deno.env.get('VITE_WHOIS_API_KEY');
// @ts-ignore
const APILAYER_KEY = Deno.env.get('VITE_APILAYER_API_KEY');
// @ts-ignore
const WHOISFREAKS_KEY = Deno.env.get('VITE_WHOISFREAKS_API_KEY');

const getWhoisDataFromWhoDat = async (domainName: string): Promise<WhoisData> => {
    const headers = new Headers();
    if (WHO_DAT_AUTH_KEY) headers.append('Authorization', `Bearer ${WHO_DAT_AUTH_KEY}`);
    const response = await fetch(`${WHO_DAT_URL!}/${domainName}`, { headers });
    if (!response.ok) throw new Error(`who-dat failed: ${response.status}`);
    const data = await response.json();
    if (data.error) throw new Error(`who-dat error: ${data.error}`);
    const status = data.isAvailable ? 'available' : (new Date(data.dates?.expiry) < new Date() ? 'expired' : 'registered');
    return {
        status,
        expirationDate: data.dates?.expiry || null,
        registeredDate: data.dates?.created || null,
        registrar: data.registrar?.name || null,
    };
};

const getWhoisDataFromWhoisXmlApi = async (domainName: string): Promise<WhoisData> => {
    if (!WHOISXMLAPI_KEY) throw new Error("WhoisXMLAPI Key not provided.");
    const url = `https://www.whoisxmlapi.com/whoisserver/WhoisService?apiKey=${WHOISXMLAPI_KEY}&domainName=${domainName}&outputFormat=JSON&da=2`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`WhoisXMLAPI failed: ${response.status}`);
    const data = await response.json();
    if (data.ErrorMessage) throw new Error(`WhoisXMLAPI Error: ${data.ErrorMessage.msg}`);
    const record = data.WhoisRecord;
    if (!record) throw new Error('Invalid API response from WhoisXMLAPI');
    const expiryDateStr = record.registryData?.expiresDate || record.expiresDate;
    const status = record.domainAvailability === 'AVAILABLE' ? 'available' : (expiryDateStr && new Date(expiryDateStr) < new Date() ? 'expired' : 'registered');
    return {
        status,
        expirationDate: expiryDateStr || null,
        registeredDate: record.registryData?.createdDate || record.createdDate || null,
        registrar: record.registrarName || null,
    };
};

const getWhoisDataFromApiLayer = async (domainName: string): Promise<WhoisData> => {
    if (!APILAYER_KEY) throw new Error("apilayer.com Key not provided.");
    const response = await fetch(`https://api.apilayer.com/whois/check?domain=${domainName}`, { headers: { 'apikey': APILAYER_KEY } });
    if (!response.ok) throw new Error(`apilayer.com failed: ${response.status}`);
    const data = await response.json();
    if (data.message || !data.result) throw new Error(`apilayer.com Error: ${data.message || 'Invalid response'}`);
    const { result } = data;
    const status = result.status === 'available' ? 'available' : (result.expiration_date && new Date(result.expiration_date) < new Date() ? 'expired' : 'registered');
    return {
        status,
        expirationDate: result.expiration_date || null,
        registeredDate: result.creation_date || null,
        registrar: result.registrar || null,
    };
}

const getWhoisDataFromWhoisFreaks = async (domainName: string): Promise<WhoisData> => {
    if (!WHOISFREAKS_KEY) throw new Error("WhoisFreaks Key not provided.");
    const url = `https://api.whoisfreaks.com/v1.0/whois?apiKey=${WHOISFREAKS_KEY}&whois=live&domainName=${domainName}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`WhoisFreaks failed: ${response.status}`);
    const data = await response.json();
    if (!data.status || data.error) throw new Error(`WhoisFreaks Error: ${data.error?.message || 'Request failed'}`);
    const status = data.domain_registered === 'no' ? 'available' : (data.expiry_date && new Date(data.expiry_date) < new Date() ? 'expired' : 'registered');
    return {
        status,
        expirationDate: data.expiry_date || null,
        registeredDate: data.create_date || null,
        registrar: data.domain_registrar?.registrar_name || null,
    };
};

const getWhoisData = async (domainName: string): Promise<WhoisData> => {
    if (WHO_DAT_URL) {
        try { return await getWhoisDataFromWhoDat(domainName); } catch (e) { console.error(e.message); }
    }
    if (WHOISXMLAPI_KEY) {
        try { return await getWhoisDataFromWhoisXmlApi(domainName); } catch (e) { console.error(e.message); }
    }
    if (APILAYER_KEY) {
        try { return await getWhoisDataFromApiLayer(domainName); } catch (e) { console.error(e.message); }
    }
    if (WHOISFREAKS_KEY) {
        try { return await getWhoisDataFromWhoisFreaks(domainName); } catch (e) { console.error(e.message); }
    }
    console.error(`❌ All WHOIS providers failed for ${domainName}.`);
    return { status: 'unknown', expirationDate: null, registeredDate: null, registrar: 'Error' };
};


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
      .select('id, domain_name, status')
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
      
      console.log(`✅ Update for ${domain.domain_name}: status -> ${newStatus}`);
      return payload;
    });

    const results = await Promise.all(updatePromises);
    const updatesToApply = results.filter(Boolean); // Filter out nulls

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