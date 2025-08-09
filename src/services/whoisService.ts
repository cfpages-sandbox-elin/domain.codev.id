import { WhoisData, DomainStatus } from '../types';

// API keys are managed externally and injected by the deployment environment via Vite.
const WHO_DAT_URL = import.meta.env.VITE_WHO_DAT_URL;
const WHO_DAT_AUTH_KEY = import.meta.env.VITE_WHO_DAT_AUTH_KEY;
const WHOISXMLAPI_KEY = import.meta.env.VITE_WHOIS_API_KEY;
const APILAYER_KEY = import.meta.env.VITE_APILAYER_API_KEY;
const WHOISFREAKS_KEY = import.meta.env.VITE_WHOISFREAKS_API_KEY;
const WHOAPI_COM_KEY = import.meta.env.VITE_WHOAPI_COM_API_KEY;
const RAPIDAPI_KEY = import.meta.env.VITE_RAPIDAPI_KEY;


// --- Provider 0: who-dat (Primary) ---
interface WhoDatResponse {
    isAvailable?: boolean;
    domainName?: string;
    dates?: {
        expiry?: string;
        created?: string;
    };
    registrar?: {
        name?: string;
    };
    error?: string;
}

const getWhoisDataFromWhoDat = async (domainName: string): Promise<WhoisData> => {
    const headers = new Headers();
    if (WHO_DAT_AUTH_KEY) {
        headers.append('Authorization', `Bearer ${WHO_DAT_AUTH_KEY}`);
    }

    // The WHO_DAT_URL is guaranteed to be present by the calling function.
    const response = await fetch(`${WHO_DAT_URL!}/${domainName}`, { headers });
    if (!response.ok) throw new Error(`who-dat request failed with status ${response.status}`);

    const data: WhoDatResponse = await response.json();
    if (data.error) throw new Error(`who-dat error: ${data.error}`);
    
    let status: DomainStatus;
    const expiryDateStr = data.dates?.expiry;

    if (data.isAvailable) {
        status = 'available';
    } else {
        status = 'registered';
        if (expiryDateStr && new Date(expiryDateStr) < new Date()) {
            status = 'expired';
        }
    }

    return {
        status,
        expirationDate: data.dates?.expiry || null,
        registeredDate: data.dates?.created || null,
        registrar: data.registrar?.name || null,
    };
};


// --- Provider 1: WhoisXMLAPI ---
const WHOISXMLAPI_URL = 'https://www.whoisxmlapi.com/whoisserver/WhoisService';

interface WhoisXmlApiResponse {
    WhoisRecord?: {
        domainName: string;
        domainAvailability: 'AVAILABLE' | 'UNAVAILABLE';
        registryData?: { createdDate: string; expiresDate: string; };
        createdDate?: string;
        expiresDate?: string;
        registrarName?: string;
    };
    ErrorMessage?: { msg: string; };
}

const getWhoisDataFromWhoisXmlApi = async (domainName: string): Promise<WhoisData> => {
    if (!WHOISXMLAPI_KEY) throw new Error("WhoisXMLAPI Key not provided.");
    
    const params = new URLSearchParams({
        apiKey: WHOISXMLAPI_KEY,
        domainName: domainName,
        outputFormat: 'JSON',
        da: '2',
    });

    const response = await fetch(`${WHOISXMLAPI_URL}?${params.toString()}`);
    if (!response.ok) throw new Error(`WhoisXMLAPI request failed with status ${response.status}`);
    
    const data: WhoisXmlApiResponse = await response.json();

    if (data.ErrorMessage) throw new Error(`WhoisXMLAPI Error: ${data.ErrorMessage.msg}`);

    const record = data.WhoisRecord;
    if (!record) throw new Error('Invalid API response from WhoisXMLAPI: WhoisRecord not found.');
    
    let status: DomainStatus = 'unknown';
    const expiryDateStr = record.registryData?.expiresDate || record.expiresDate;
    if (record.domainAvailability === 'AVAILABLE') {
        status = 'available';
    } else if (record.domainAvailability === 'UNAVAILABLE') {
        status = 'registered';
        if (expiryDateStr && new Date(expiryDateStr) < new Date()) {
            status = 'expired';
        }
    }

    return {
        status,
        expirationDate: record.registryData?.expiresDate || record.expiresDate || null,
        registeredDate: record.registryData?.createdDate || record.createdDate || null,
        registrar: record.registrarName || null,
    };
};


// --- Provider 2: apilayer.com ---
const APILAYER_URL = 'https://api.apilayer.com/whois/check';
const APILAYER_SUPPORTED_TLDS = new Set(['com', 'me', 'net', 'org', 'sh', 'io', 'co', 'club', 'biz', 'mobi', 'info', 'us', 'domains', 'cloud', 'fr', 'au', 'ru', 'uk', 'nl', 'fi', 'br', 'hr', 'ee', 'ca', 'sk', 'se', 'no', 'cz', 'it', 'in', 'icu', 'top', 'xyz', 'cn', 'cf', 'hk', 'sg', 'pt', 'site', 'kz', 'si', 'ae', 'do', 'yoga', 'xxx', 'ws', 'work', 'wiki', 'watch', 'wtf', 'world', 'website', 'vip', 'ly', 'dev', 'network', 'company', 'page', 'rs', 'run', 'science', 'sex', 'shop', 'solutions', 'so', 'studio', 'style', 'tech', 'travel', 'vc', 'pub', 'pro', 'app', 'press', 'ooo', 'de']);


interface ApiLayerResponse {
    result?: {
        status: 'registered' | 'available';
        expiration_date: string;
        creation_date: string;
        registrar: string;
    };
    message?: string;
}

const getWhoisDataFromApiLayer = async (domainName: string): Promise<WhoisData> => {
    if (!APILAYER_KEY) throw new Error("apilayer.com API Key not provided.");

    const tld = domainName.split('.').pop();
    if (!tld || !APILAYER_SUPPORTED_TLDS.has(tld)) {
        throw new Error(`TLD ".${tld}" is not supported by apilayer.com`);
    }

    const response = await fetch(`${APILAYER_URL}?domain=${domainName}`, {
        headers: { 'apikey': APILAYER_KEY }
    });

    if (!response.ok) throw new Error(`apilayer.com request failed with status ${response.status}`);

    const data: ApiLayerResponse = await response.json();

    if (data.message || !data.result) {
        throw new Error(`apilayer.com Error: ${data.message || 'Invalid response structure'}`);
    }

    const { result } = data;
    let status: DomainStatus = 'unknown';
    if (result.status === 'available') {
        status = 'available';
    } else if (result.status === 'registered') {
        status = 'registered';
        if (result.expiration_date && new Date(result.expiration_date) < new Date()) {
            status = 'expired';
        }
    }

    return {
        status,
        expirationDate: result.expiration_date || null,
        registeredDate: result.creation_date || null,
        registrar: result.registrar || null,
    };
}


// --- Provider 3: WhoisFreaks ---
const WHOISFREAKS_URL = 'https://api.whoisfreaks.com/v1.0/whois';

interface WhoisFreaksResponse {
    status: boolean; // true for success
    domain_name: string;
    domain_registered: 'yes' | 'no';
    create_date: string;
    expiry_date: string;
    domain_registrar?: {
        registrar_name: string;
    };
    error?: {
        message: string;
    };
}

const getWhoisDataFromWhoisFreaks = async (domainName: string): Promise<WhoisData> => {
    if (!WHOISFREAKS_KEY) throw new Error("WhoisFreaks API Key not provided.");

    const params = new URLSearchParams({
        apiKey: WHOISFREAKS_KEY,
        whois: 'live',
        domainName: domainName,
    });

    const response = await fetch(`${WHOISFREAKS_URL}?${params.toString()}`);
    if (!response.ok) throw new Error(`WhoisFreaks request failed with status ${response.status}`);
    
    const data: WhoisFreaksResponse = await response.json();

    if (!data.status || data.error) {
        throw new Error(`WhoisFreaks Error: ${data.error?.message || 'Request failed'}`);
    }

    let status: DomainStatus = 'unknown';
    const expiryDateStr = data.expiry_date;

    if (data.domain_registered === 'no') {
        status = 'available';
    } else if (data.domain_registered === 'yes') {
        status = 'registered';
        if (expiryDateStr && new Date(expiryDateStr) < new Date()) {
            status = 'expired';
        }
    }

    return {
        status,
        expirationDate: data.expiry_date || null,
        registeredDate: data.create_date || null,
        registrar: data.domain_registrar?.registrar_name || null,
    };
};

// --- Provider 4: whoapi.com ---
const WHOAPI_URL = 'http://api.whoapi.com/';

interface WhoApiResponse {
    status: string; // '0' is success
    status_desc?: string;
    registered: boolean;
    date_created: string;
    date_expires: string;
    whois_name: string; // Registrar name
    contacts: { type: string, organization?: string }[];
}

const getWhoisDataFromWhoapi = async (domainName: string): Promise<WhoisData> => {
    if (!WHOAPI_COM_KEY) throw new Error("whoapi.com API Key not provided.");

    const params = new URLSearchParams({
        apikey: WHOAPI_COM_KEY,
        r: 'whois',
        domain: domainName,
    });

    const response = await fetch(`${WHOAPI_URL}?${params.toString()}`);
    if (!response.ok) throw new Error(`whoapi.com request failed with status ${response.status}`);

    const data: WhoApiResponse = await response.json();
    if(data.status !== '0') {
        throw new Error(`whoapi.com Error: ${data.status_desc || `Status code ${data.status}`}`);
    }
    
    let status: DomainStatus;
    const expiryDateStr = data.date_expires;
    if(!data.registered) {
        status = 'available';
    } else {
        status = 'registered';
        if (expiryDateStr && new Date(expiryDateStr) < new Date()) {
            status = 'expired';
        }
    }

    const registrarContact = data.contacts?.find(c => c.type === 'registrar');
    const registrarName = registrarContact?.organization || data.whois_name || null;

    return {
        status,
        expirationDate: data.date_expires || null,
        registeredDate: data.date_created || null,
        registrar: registrarName,
    }
};


// --- Provider 5: RapidAPI ---
const RAPIDAPI_URL = 'https://domain-whois-lookup-api.p.rapidapi.com/whois';

interface RapidApiResponseError {
    error?: string;
    status?: string;
}

interface RapidApiResponseSuccess {
    name: string;
    creation_date: string;
    updated_date: string;
    expiration_date: string;
    registrar: string;
    registrant: string;
    email: string;
    address: string;
    city: string;
    state: string;
    zipcode: string;
    country: string;
}

const getWhoisDataFromRapidApi = async (domainName: string): Promise<WhoisData> => {
    if (!RAPIDAPI_KEY) throw new Error("RapidAPI Key not provided.");

    const response = await fetch(`${RAPIDAPI_URL}?domain_name=${domainName}`, {
        headers: {
            'x-rapidapi-key': RAPIDAPI_KEY,
            'x-rapidapi-host': 'domain-whois-lookup-api.p.rapidapi.com'
        }
    });

    const data: RapidApiResponseSuccess | RapidApiResponseError = await response.json();

    if (!response.ok) {
        if (response.status === 404 && (data as RapidApiResponseError).status === 'Available for registration') {
            return {
                status: 'available',
                expirationDate: null,
                registeredDate: null,
                registrar: null,
            };
        }
        throw new Error(`RapidAPI request failed: ${response.status} ${response.statusText}. ${(data as RapidApiResponseError).error || ''}`);
    }

    const result = data as RapidApiResponseSuccess;
    let status: DomainStatus = 'registered';
    const expiryDateStr = result.expiration_date;
    if (expiryDateStr && new Date(expiryDateStr) < new Date()) {
        status = 'expired';
    }

    return {
        status,
        expirationDate: result.expiration_date || null,
        registeredDate: result.creation_date || null,
        registrar: result.registrar || null,
    };
};



// --- Main Service Function (Waterfall) ---

export const getWhoisData = async (domainName: string, log?: (message: string) => void): Promise<WhoisData> => {
    log?.(`➡️ Starting WHOIS lookup for ${domainName}...`);
    
    // Attempt 1: who-dat (Primary) - ONLY if self-hosted URL is provided
    if (WHO_DAT_URL) {
        try {
            log?.("➡️ Trying provider: self-hosted who-dat...");
            const data = await getWhoisDataFromWhoDat(domainName);
            log?.("✅ Success: who-dat");
            return data;
        } catch (error) {
            log?.(`⚠️ Failure: who-dat. ${(error as Error).message}`);
        }
    } else {
        log?.("ℹ️ Skipping who-dat: VITE_WHO_DAT_URL not configured.");
    }
    
    // Attempt 2: WhoisXMLAPI (Backup 1)
    if (WHOISXMLAPI_KEY) {
        try {
            log?.("➡️ Trying provider: WhoisXMLAPI...");
            const data = await getWhoisDataFromWhoisXmlApi(domainName);
            log?.("✅ Success: WhoisXMLAPI");
            return data;
        } catch (error) {
            log?.(`⚠️ Failure: WhoisXMLAPI. ${(error as Error).message}`);
        }
    }

    // Attempt 3: apilayer.com (Backup 2)
    if (APILAYER_KEY) {
        try {
            log?.("➡️ Trying provider: apilayer.com...");
            const data = await getWhoisDataFromApiLayer(domainName);
            log?.("✅ Success: apilayer.com");
            return data;
        } catch (error) {
            log?.(`⚠️ Failure: apilayer.com. ${(error as Error).message}`);
        }
    }

    // Attempt 4: whoisfreaks.com (Backup 3)
    if (WHOISFREAKS_KEY) {
        try {
            log?.("➡️ Trying provider: whoisfreaks.com...");
            const data = await getWhoisDataFromWhoisFreaks(domainName);
            log?.("✅ Success: whoisfreaks.com");
            return data;
        } catch (error) {
            log?.(`⚠️ Failure: whoisfreaks.com. ${(error as Error).message}`);
        }
    }

    // Attempt 5: whoapi.com (Backup 4)
    if (WHOAPI_COM_KEY) {
        try {
            log?.("➡️ Trying provider: whoapi.com...");
            const data = await getWhoisDataFromWhoapi(domainName);
            log?.("✅ Success: whoapi.com");
            return data;
        } catch (error) {
            log?.(`⚠️ Failure: whoapi.com. ${(error as Error).message}`);
        }
    }

    // Attempt 6: rapidapi.com (Backup 5)
    if (RAPIDAPI_KEY) {
        try {
            log?.("➡️ Trying provider: rapidapi.com...");
            const data = await getWhoisDataFromRapidApi(domainName);
            log?.("✅ Success: rapidapi.com");
            return data;
        } catch (error) {
            log?.(`⚠️ Failure: rapidapi.com. ${(error as Error).message}`);
        }
    }

    // Fallback if all providers fail
    log?.("❌ All WHOIS providers failed or are not configured.");
    return {
        status: 'unknown',
        expirationDate: null,
        registeredDate: null,
        registrar: 'Error: Could not retrieve WHOIS data.',
    };
};