// This file contains shared WHOIS logic to be used by multiple Cloudflare Pages Functions.

//-------------------------------------------------
// Types
//-------------------------------------------------
type DomainStatus = 'available' | 'registered' | 'expired' | 'dropped' | 'unknown';

export interface WhoisData {
  status: DomainStatus;
  expirationDate: string | null;
  registeredDate: string | null;
  registrar: string | null;
}

interface Env {
    WHO_DAT_URL?: string;
    WHO_DAT_AUTH_KEY?: string;
    WHOIS_API_KEY?: string;
    APILAYER_API_KEY?: string;
    WHOISFREAKS_API_KEY?: string;
    WHOAPI_COM_API_KEY?: string;
    RAPIDAPI_KEY?: string;
}

// --- Provider 0: who-dat (Primary) ---
const getWhoisDataFromWhoDat = async (domainName: string, env: Env): Promise<WhoisData> => {
    const headers = new Headers();
    if (env.WHO_DAT_AUTH_KEY) headers.append('Authorization', `Bearer ${env.WHO_DAT_AUTH_KEY}`);
    const response = await fetch(`${env.WHO_DAT_URL!}/${domainName}`, { headers });
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

// --- Provider 1: WhoisXMLAPI ---
const getWhoisDataFromWhoisXmlApi = async (domainName: string, env: Env): Promise<WhoisData> => {
    if (!env.WHOIS_API_KEY) throw new Error("WhoisXMLAPI Key not provided.");
    const url = `https://www.whoisxmlapi.com/whoisserver/WhoisService?apiKey=${env.WHOIS_API_KEY}&domainName=${domainName}&outputFormat=JSON&da=2`;
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

// --- Provider 2: apilayer.com ---
const APILAYER_SUPPORTED_TLDS = new Set(['com', 'me', 'net', 'org', 'sh', 'io', 'co', 'club', 'biz', 'mobi', 'info', 'us', 'domains', 'cloud', 'fr', 'au', 'ru', 'uk', 'nl', 'fi', 'br', 'hr', 'ee', 'ca', 'sk', 'se', 'no', 'cz', 'it', 'in', 'icu', 'top', 'xyz', 'cn', 'cf', 'hk', 'sg', 'pt', 'site', 'kz', 'si', 'ae', 'do', 'yoga', 'xxx', 'ws', 'work', 'wiki', 'watch', 'wtf', 'world', 'website', 'vip', 'ly', 'dev', 'network', 'company', 'page', 'rs', 'run', 'science', 'sex', 'shop', 'solutions', 'so', 'studio', 'style', 'tech', 'travel', 'vc', 'pub', 'pro', 'app', 'press', 'ooo', 'de']);

const getWhoisDataFromApiLayer = async (domainName: string, env: Env): Promise<WhoisData> => {
    if (!env.APILAYER_API_KEY) throw new Error("apilayer.com Key not provided.");
    const tld = domainName.split('.').pop();
    if (!tld || !APILAYER_SUPPORTED_TLDS.has(tld)) {
        throw new Error(`TLD ".${tld}" is not supported by apilayer.com`);
    }
    const response = await fetch(`https://api.apilayer.com/whois/check?domain=${domainName}`, { headers: { 'apikey': env.APILAYER_API_KEY } });
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

// --- Provider 3: WhoisFreaks ---
const getWhoisDataFromWhoisFreaks = async (domainName: string, env: Env): Promise<WhoisData> => {
    if (!env.WHOISFREAKS_API_KEY) throw new Error("WhoisFreaks Key not provided.");
    const url = `https://api.whoisfreaks.com/v1.0/whois?apiKey=${env.WHOISFREAKS_API_KEY}&whois=live&domainName=${domainName}`;
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

// --- Provider 4: whoapi.com ---
const getWhoisDataFromWhoapi = async (domainName: string, env: Env): Promise<WhoisData> => {
    if (!env.WHOAPI_COM_API_KEY) throw new Error("whoapi.com API Key not provided.");
    const url = `https://api.whoapi.com/?apikey=${env.WHOAPI_COM_API_KEY}&r=whois&domain=${domainName}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`whoapi.com failed: ${response.status}`);
    const data = await response.json();
    if (data.status !== '0') throw new Error(`whoapi.com Error: ${data.status_desc || `Status ${data.status}`}`);
    const expiryDateStr = data.date_expires;
    const status = !data.registered ? 'available' : (expiryDateStr && new Date(expiryDateStr) < new Date() ? 'expired' : 'registered');
    const registrarContact = data.contacts?.find((c: any) => c.type === 'registrar');
    const registrarName = registrarContact?.organization || data.whois_name || null;
    return {
        status,
        expirationDate: expiryDateStr || null,
        registeredDate: data.date_created || null,
        registrar: registrarName,
    };
};

// --- Provider 5: RapidAPI ---
const getWhoisDataFromRapidApi = async (domainName: string, env: Env): Promise<WhoisData> => {
    if (!env.RAPIDAPI_KEY) throw new Error("RapidAPI Key not provided.");

    const url = `https://domain-whois-lookup-api.p.rapidapi.com/whois?domain_name=${domainName}`;
    const response = await fetch(url, {
        headers: {
            'x-rapidapi-key': env.RAPIDAPI_KEY,
            'x-rapidapi-host': 'domain-whois-lookup-api.p.rapidapi.com'
        }
    });
    
    const data = await response.json();

    if (!response.ok) {
        if (response.status === 404 && data.status === 'Available for registration') {
            return {
                status: 'available',
                expirationDate: null,
                registeredDate: null,
                registrar: null,
            };
        }
        throw new Error(`RapidAPI request failed with status ${response.status}: ${data.error || JSON.stringify(data)}`);
    }

    const expiryDateStr = data.expiration_date;
    const status = expiryDateStr && new Date(expiryDateStr) < new Date() ? 'expired' : 'registered';
    
    return {
        status,
        expirationDate: data.expiration_date || null,
        registeredDate: data.creation_date || null,
        registrar: data.registrar || null,
    };
};


// --- Main Service Function (Waterfall) ---
export const getWhoisData = async (domainName: string, env: Env): Promise<WhoisData> => {
    if (env.WHO_DAT_URL) {
        try { return await getWhoisDataFromWhoDat(domainName, env); } catch (e) { console.error(`who-dat failed for ${domainName}: ${e.message}`); }
    }
    if (env.WHOIS_API_KEY) {
        try { return await getWhoisDataFromWhoisXmlApi(domainName, env); } catch (e) { console.error(`WhoisXMLAPI failed for ${domainName}: ${e.message}`); }
    }
    if (env.APILAYER_API_KEY) {
        try { return await getWhoisDataFromApiLayer(domainName, env); } catch (e) { console.error(`apilayer.com failed for ${domainName}: ${e.message}`); }
    }
    if (env.WHOISFREAKS_API_KEY) {
        try { return await getWhoisDataFromWhoisFreaks(domainName, env); } catch (e) { console.error(`whoisfreaks.com failed for ${domainName}: ${e.message}`); }
    }
    if (env.WHOAPI_COM_API_KEY) {
        try { return await getWhoisDataFromWhoapi(domainName, env); } catch (e) { console.error(`whoapi.com failed for ${domainName}: ${e.message}`); }
    }
    if (env.RAPIDAPI_KEY) {
        try { return await getWhoisDataFromRapidApi(domainName, env); } catch (e) { console.error(`rapidapi.com failed for ${domainName}: ${e.message}`); }
    }
    console.error(`❌ All WHOIS providers failed for ${domainName}.`);
    return { status: 'unknown', expirationDate: null, registeredDate: null, registrar: 'Error' };
};
