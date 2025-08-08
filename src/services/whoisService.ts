import { WhoisData, DomainStatus } from '../types';

// API keys are managed externally and injected by the deployment environment via Vite.
const WHO_DAT_URL = import.meta.env.VITE_WHO_DAT_URL || 'https://who-dat.as93.net';
const WHO_DAT_AUTH_KEY = import.meta.env.VITE_WHO_DAT_AUTH_KEY;
const WHOISXMLAPI_KEY = import.meta.env.VITE_WHOIS_API_KEY;
const APILAYER_KEY = import.meta.env.VITE_APILAYER_API_KEY;
const WHOISFREAKS_KEY = import.meta.env.VITE_WHOISFREAKS_API_KEY;


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

    const response = await fetch(`${WHO_DAT_URL}/${domainName}`, { headers });
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



// --- Main Service Function (Waterfall) ---

export const getWhoisData = async (domainName: string): Promise<WhoisData> => {
    // Attempt 1: who-dat (Primary)
    try {
        console.log("Attempting WHOIS lookup with who-dat...");
        return await getWhoisDataFromWhoDat(domainName);
    } catch (error) {
        console.warn("Primary WHOIS provider (who-dat) failed. Trying backup.", error);
    }
    
    // Attempt 2: WhoisXMLAPI (Backup 1)
    if (WHOISXMLAPI_KEY) {
        try {
            console.log("Attempting WHOIS lookup with WhoisXMLAPI...");
            return await getWhoisDataFromWhoisXmlApi(domainName);
        } catch (error) {
            console.warn("Backup WHOIS provider (WhoisXMLAPI) failed. Trying next backup.", error);
        }
    } else {
        console.warn("WhoisXMLAPI key not set, skipping.");
    }

    // Attempt 3: apilayer.com (Backup 2)
    if (APILAYER_KEY) {
        try {
            console.log("Attempting WHOIS lookup with apilayer.com...");
            return await getWhoisDataFromApiLayer(domainName);
        } catch (error) {
            console.warn("Backup WHOIS provider (apilayer.com) failed. Trying next backup.", error);
        }
    } else {
        console.warn("apilayer.com key not set, skipping.");
    }

    // Attempt 4: whoisfreaks.com (Backup 3)
    if (WHOISFREAKS_KEY) {
        try {
            console.log("Attempting WHOIS lookup with whoisfreaks.com...");
            return await getWhoisDataFromWhoisFreaks(domainName);
        } catch (error) {
            console.error("Backup WHOIS provider (whoisfreaks.com) also failed.", error);
        }
    } else {
        console.warn("whoisfreaks.com key not set, skipping.");
    }

    // Fallback if all providers fail
    console.error("All WHOIS providers failed or are not configured.");
    return {
        status: 'unknown',
        expirationDate: null,
        registeredDate: null,
        registrar: 'Error: Could not retrieve WHOIS data.',
    };
};