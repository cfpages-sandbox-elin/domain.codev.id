// Shared WHOIS logic for Supabase Edge Functions.

//-------------------------------------------------
// Types
//-------------------------------------------------
type DomainStatus = 'available' | 'registered' | 'expired' | 'dropped' | 'unknown';

export type WhoisProviderId =
  | 'who-dat'
  | 'whoisxmlapi'
  | 'apilayer'
  | 'whoisfreaks'
  | 'whoapi'
  | 'rapidapi'
  | 'whoisjson'
  | 'ip2whois';

export interface WhoisQuota {
  limitMonth: number | null;
  remainingMonth: number | null;
  limitDay: number | null;
  remainingDay: number | null;
}

export interface WhoisProviderAttempt {
  provider: WhoisProviderId;
  providerLabel: string;
  status: 'success' | 'failed' | 'skipped';
  errorMessage?: string;
  quota?: WhoisQuota;
}

export interface WhoisData {
  status: DomainStatus;
  expirationDate: string | null;
  registeredDate: string | null;
  registrar: string | null;
  provider?: WhoisProviderId;
  providerLabel?: string;
  providerAttempts?: WhoisProviderAttempt[];
  quota?: WhoisQuota;
}

export interface WhoisProviderStatus {
  id: WhoisProviderId;
  label: string;
  implemented: boolean;
  configured: boolean;
  enabled: boolean;
  priority: number;
  envKeys: string[];
  freeTierLabel: string;
  supportsQuotaHeaders: boolean;
  status: 'active' | 'missing-key' | 'not-implemented' | 'disabled';
  notes: string;
}

interface WhoisProviderConfig {
  id: WhoisProviderId;
  label: string;
  implemented: boolean;
  enabled: boolean;
  priority: number;
  envKeys: string[];
  freeTierLabel: string;
  supportsQuotaHeaders: boolean;
  notes: string;
  isConfigured: () => boolean;
}

//-------------------------------------------------
// Environment Variable Access
//-------------------------------------------------
// @ts-ignore
const WHO_DAT_URL = Deno.env.get('WHO_DAT_URL');
// @ts-ignore
const WHO_DAT_AUTH_KEY = Deno.env.get('WHO_DAT_AUTH_KEY');
// @ts-ignore
const WHOISXMLAPI_KEY = Deno.env.get('WHOIS_API_KEY') || Deno.env.get('VITE_WHOIS_API_KEY');
// @ts-ignore
const APILAYER_KEY = Deno.env.get('APILAYER_API_KEY') || Deno.env.get('VITE_APILAYER_API_KEY');
// @ts-ignore
const WHOISFREAKS_KEY = Deno.env.get('WHOISFREAKS_API_KEY') || Deno.env.get('VITE_WHOISFREAKS_API_KEY');
// @ts-ignore
const WHOAPI_COM_KEY = Deno.env.get('WHOAPI_COM_API_KEY') || Deno.env.get('VITE_WHOAPI_COM_API_KEY');
// @ts-ignore
const RAPIDAPI_KEY = Deno.env.get('RAPIDAPI_KEY') || Deno.env.get('VITE_RAPIDAPI_KEY');
// @ts-ignore
const WHOISJSON_API_KEY = Deno.env.get('WHOISJSON_API_KEY') || Deno.env.get('VITE_WHOISJSON_API_KEY');
// @ts-ignore
const IP2WHOIS_API_KEY = Deno.env.get('IP2WHOIS_API_KEY') || Deno.env.get('VITE_IP2WHOIS_API_KEY');

//-------------------------------------------------
// Provider Registry
//-------------------------------------------------
const WHOIS_PROVIDER_REGISTRY: WhoisProviderConfig[] = [
  {
    id: 'who-dat',
    label: 'who-dat',
    implemented: true,
    enabled: true,
    priority: 1,
    envKeys: ['WHO_DAT_URL', 'WHO_DAT_AUTH_KEY'],
    freeTierLabel: 'Self-hosted; depends on deployment',
    supportsQuotaHeaders: false,
    notes: 'Primary if WHO_DAT_URL exists.',
    isConfigured: () => Boolean(WHO_DAT_URL),
  },
  {
    id: 'whoisxmlapi',
    label: 'WhoisXMLAPI',
    implemented: true,
    enabled: true,
    priority: 2,
    envKeys: ['WHOIS_API_KEY', 'VITE_WHOIS_API_KEY'],
    freeTierLabel: '500 free WHOIS queries',
    supportsQuotaHeaders: false,
    notes: 'Good parsed WHOIS fallback.',
    isConfigured: () => Boolean(WHOISXMLAPI_KEY),
  },
  {
    id: 'apilayer',
    label: 'APILayer Whois API',
    implemented: true,
    enabled: true,
    priority: 3,
    envKeys: ['APILAYER_API_KEY', 'VITE_APILAYER_API_KEY'],
    freeTierLabel: '3,000 requests/month',
    supportsQuotaHeaders: true,
    notes: 'Exposes monthly/daily rate-limit headers.',
    isConfigured: () => Boolean(APILAYER_KEY),
  },
  {
    id: 'whoisfreaks',
    label: 'WhoisFreaks',
    implemented: true,
    enabled: true,
    priority: 4,
    envKeys: ['WHOISFREAKS_API_KEY', 'VITE_WHOISFREAKS_API_KEY'],
    freeTierLabel: '500 signup credits',
    supportsQuotaHeaders: false,
    notes: 'Live WHOIS endpoint.',
    isConfigured: () => Boolean(WHOISFREAKS_KEY),
  },
  {
    id: 'whoapi',
    label: 'WhoAPI',
    implemented: true,
    enabled: true,
    priority: 5,
    envKeys: ['WHOAPI_COM_API_KEY', 'VITE_WHOAPI_COM_API_KEY'],
    freeTierLabel: 'Verify in account',
    supportsQuotaHeaders: false,
    notes: 'Implemented fallback; current free quota not confirmed.',
    isConfigured: () => Boolean(WHOAPI_COM_KEY),
  },
  {
    id: 'rapidapi',
    label: 'RapidAPI Domain WHOIS Lookup',
    implemented: true,
    enabled: true,
    priority: 6,
    envKeys: ['RAPIDAPI_KEY', 'VITE_RAPIDAPI_KEY'],
    freeTierLabel: 'Marketplace plan varies',
    supportsQuotaHeaders: false,
    notes: 'Optional last fallback.',
    isConfigured: () => Boolean(RAPIDAPI_KEY),
  },
  {
    id: 'whoisjson',
    label: 'WhoisJSON',
    implemented: true,
    enabled: true,
    priority: 7,
    envKeys: ['WHOISJSON_API_KEY', 'VITE_WHOISJSON_API_KEY'],
    freeTierLabel: '1,000 requests/month shared across endpoints',
    supportsQuotaHeaders: false,
    notes: 'New backup provider. Response mapping may need adjustment after live testing.',
    isConfigured: () => Boolean(WHOISJSON_API_KEY),
  },
  {
    id: 'ip2whois',
    label: 'IP2WHOIS / IP2Location.io',
    implemented: true,
    enabled: true,
    priority: 8,
    envKeys: ['IP2WHOIS_API_KEY', 'VITE_IP2WHOIS_API_KEY'],
    freeTierLabel: '500 domain WHOIS queries/month',
    supportsQuotaHeaders: false,
    notes: 'New backup provider. Response mapping may need adjustment after live testing.',
    isConfigured: () => Boolean(IP2WHOIS_API_KEY),
  },
];

export const getWhoisProviderStatuses = (): WhoisProviderStatus[] => {
  return WHOIS_PROVIDER_REGISTRY
    .slice()
    .sort((a, b) => a.priority - b.priority)
    .map((provider) => {
      const configured = provider.isConfigured();
      const status = !provider.implemented
        ? 'not-implemented'
        : !provider.enabled
          ? 'disabled'
          : configured
            ? 'active'
            : 'missing-key';

      return {
        id: provider.id,
        label: provider.label,
        implemented: provider.implemented,
        configured,
        enabled: provider.enabled,
        priority: provider.priority,
        envKeys: provider.envKeys,
        freeTierLabel: provider.freeTierLabel,
        supportsQuotaHeaders: provider.supportsQuotaHeaders,
        status,
        notes: provider.notes,
      };
    });
};

const providerById = (id: WhoisProviderId) => {
  const provider = WHOIS_PROVIDER_REGISTRY.find(item => item.id === id);
  if (!provider) throw new Error(`Unknown WHOIS provider: ${id}`);
  return provider;
};

const readQuotaHeaders = (headers: Headers): WhoisQuota => ({
  limitMonth: toNumber(headers.get('x-ratelimit-limit-month')),
  remainingMonth: toNumber(headers.get('x-ratelimit-remaining-month')),
  limitDay: toNumber(headers.get('x-ratelimit-limit-day')),
  remainingDay: toNumber(headers.get('x-ratelimit-remaining-day')),
});

const toNumber = (value: string | null): number | null => {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const hasQuotaData = (quota?: WhoisQuota): quota is WhoisQuota => {
  if (!quota) return false;
  return Object.values(quota).some(value => value !== null);
};

const withProviderMetadata = (
  providerId: WhoisProviderId,
  data: WhoisData,
  attempts: WhoisProviderAttempt[],
): WhoisData => {
  const provider = providerById(providerId);
  const quota = hasQuotaData(data.quota) ? data.quota : undefined;
  return {
    ...data,
    provider: provider.id,
    providerLabel: provider.label,
    providerAttempts: attempts,
    quota,
  };
};

const getErrorMessage = (error: unknown): string => {
  return error instanceof Error ? error.message : String(error);
};

//-------------------------------------------------
// Provider 0: who-dat
//-------------------------------------------------
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

//-------------------------------------------------
// Provider 1: WhoisXMLAPI
//-------------------------------------------------
const getWhoisDataFromWhoisXmlApi = async (domainName: string): Promise<WhoisData> => {
  if (!WHOISXMLAPI_KEY) throw new Error('WhoisXMLAPI Key not provided.');
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

//-------------------------------------------------
// Provider 2: APILayer
//-------------------------------------------------
const APILAYER_SUPPORTED_TLDS = new Set(['com', 'me', 'net', 'org', 'sh', 'io', 'co', 'club', 'biz', 'mobi', 'info', 'us', 'domains', 'cloud', 'fr', 'au', 'ru', 'uk', 'nl', 'fi', 'br', 'hr', 'ee', 'ca', 'sk', 'se', 'no', 'cz', 'it', 'in', 'icu', 'top', 'xyz', 'cn', 'cf', 'hk', 'sg', 'pt', 'site', 'kz', 'si', 'ae', 'do', 'yoga', 'xxx', 'ws', 'work', 'wiki', 'watch', 'wtf', 'world', 'website', 'vip', 'ly', 'dev', 'network', 'company', 'page', 'rs', 'run', 'science', 'sex', 'shop', 'solutions', 'so', 'studio', 'style', 'tech', 'travel', 'vc', 'pub', 'pro', 'app', 'press', 'ooo', 'de']);

const getWhoisDataFromApiLayer = async (domainName: string): Promise<WhoisData> => {
  if (!APILAYER_KEY) throw new Error('APILayer Key not provided.');
  const tld = domainName.split('.').pop();
  if (!tld || !APILAYER_SUPPORTED_TLDS.has(tld)) {
    throw new Error(`TLD ".${tld}" is not supported by APILayer`);
  }
  const response = await fetch(`https://api.apilayer.com/whois/check?domain=${domainName}`, { headers: { apikey: APILAYER_KEY } });
  const quota = readQuotaHeaders(response.headers);
  if (!response.ok) throw new Error(`APILayer failed: ${response.status}`);
  const data = await response.json();
  if (data.message || !data.result) throw new Error(`APILayer Error: ${data.message || 'Invalid response'}`);
  const { result } = data;
  const status = result.status === 'available' ? 'available' : (result.expiration_date && new Date(result.expiration_date) < new Date() ? 'expired' : 'registered');
  return {
    status,
    expirationDate: result.expiration_date || null,
    registeredDate: result.creation_date || null,
    registrar: result.registrar || null,
    quota,
  };
};

//-------------------------------------------------
// Provider 3: WhoisFreaks
//-------------------------------------------------
const getWhoisDataFromWhoisFreaks = async (domainName: string): Promise<WhoisData> => {
  if (!WHOISFREAKS_KEY) throw new Error('WhoisFreaks Key not provided.');
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

//-------------------------------------------------
// Provider 4: WhoAPI
//-------------------------------------------------
const getWhoisDataFromWhoapi = async (domainName: string): Promise<WhoisData> => {
  if (!WHOAPI_COM_KEY) throw new Error('WhoAPI Key not provided.');
  const url = `https://api.whoapi.com/?apikey=${WHOAPI_COM_KEY}&r=whois&domain=${domainName}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`WhoAPI failed: ${response.status}`);
  const data = await response.json();
  if (data.status !== '0') throw new Error(`WhoAPI Error: ${data.status_desc || `Status ${data.status}`}`);
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

//-------------------------------------------------
// Provider 5: RapidAPI
//-------------------------------------------------
const getWhoisDataFromRapidApi = async (domainName: string): Promise<WhoisData> => {
  if (!RAPIDAPI_KEY) throw new Error('RapidAPI Key not provided.');

  const url = `https://domain-whois-lookup-api.p.rapidapi.com/whois?domain_name=${domainName}`;
  const response = await fetch(url, {
    headers: {
      'x-rapidapi-key': RAPIDAPI_KEY,
      'x-rapidapi-host': 'domain-whois-lookup-api.p.rapidapi.com',
    },
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

//-------------------------------------------------
// Provider 6: WhoisJSON
//-------------------------------------------------
const getWhoisDataFromWhoisJson = async (domainName: string): Promise<WhoisData> => {
  if (!WHOISJSON_API_KEY) throw new Error('WhoisJSON Key not provided.');
  const response = await fetch(`https://whoisjson.com/api/v1/whois?domain=${encodeURIComponent(domainName)}`, {
    headers: { Authorization: `Bearer ${WHOISJSON_API_KEY}` },
  });
  if (!response.ok) throw new Error(`WhoisJSON failed: ${response.status}`);
  const data = await response.json();
  const expiryDateStr = data.expires_at || data.expiration_date || data.expiresDate || null;
  const registeredDateStr = data.created_at || data.creation_date || data.createdDate || null;
  const isAvailable = data.available === true || data.domain_registered === false || data.registered === false;
  const status = isAvailable ? 'available' : (expiryDateStr && new Date(expiryDateStr) < new Date() ? 'expired' : 'registered');

  return {
    status,
    expirationDate: expiryDateStr,
    registeredDate: registeredDateStr,
    registrar: data.registrar || data.registrar_name || data.registrarName || null,
  };
};

//-------------------------------------------------
// Provider 7: IP2WHOIS
//-------------------------------------------------
const getWhoisDataFromIp2Whois = async (domainName: string): Promise<WhoisData> => {
  if (!IP2WHOIS_API_KEY) throw new Error('IP2WHOIS Key not provided.');
  const response = await fetch(`https://api.ip2whois.com/v2?key=${IP2WHOIS_API_KEY}&domain=${encodeURIComponent(domainName)}`);
  if (!response.ok) throw new Error(`IP2WHOIS failed: ${response.status}`);
  const data = await response.json();
  if (data.error || data.error_message) throw new Error(`IP2WHOIS Error: ${data.error_message || data.error}`);
  const expiryDateStr = data.expire_date || data.expiration_date || null;
  const registeredDateStr = data.create_date || data.creation_date || null;
  const status = data.available === true ? 'available' : (expiryDateStr && new Date(expiryDateStr) < new Date() ? 'expired' : 'registered');

  return {
    status,
    expirationDate: expiryDateStr,
    registeredDate: registeredDateStr,
    registrar: data.registrar?.name || data.registrar || null,
  };
};

//-------------------------------------------------
// Main Service Function (Waterfall)
//-------------------------------------------------
const providerHandlers: Array<[WhoisProviderId, (domainName: string) => Promise<WhoisData>]> = [
  ['who-dat', getWhoisDataFromWhoDat],
  ['whoisxmlapi', getWhoisDataFromWhoisXmlApi],
  ['apilayer', getWhoisDataFromApiLayer],
  ['whoisfreaks', getWhoisDataFromWhoisFreaks],
  ['whoapi', getWhoisDataFromWhoapi],
  ['rapidapi', getWhoisDataFromRapidApi],
  ['whoisjson', getWhoisDataFromWhoisJson],
  ['ip2whois', getWhoisDataFromIp2Whois],
];

export const getWhoisData = async (domainName: string): Promise<WhoisData> => {
  const attempts: WhoisProviderAttempt[] = [];

  for (const [providerId, handler] of providerHandlers) {
    const provider = providerById(providerId);

    if (!provider.enabled || !provider.implemented || !provider.isConfigured()) {
      attempts.push({
        provider: provider.id,
        providerLabel: provider.label,
        status: 'skipped',
        errorMessage: !provider.implemented
          ? 'Provider is not implemented.'
          : !provider.enabled
            ? 'Provider is disabled.'
            : 'Provider is missing required environment configuration.',
      });
      continue;
    }

    try {
      const data = await handler(domainName);
      attempts.push({
        provider: provider.id,
        providerLabel: provider.label,
        status: 'success',
        quota: hasQuotaData(data.quota) ? data.quota : undefined,
      });
      return withProviderMetadata(provider.id, data, attempts);
    } catch (error) {
      const message = getErrorMessage(error);
      attempts.push({
        provider: provider.id,
        providerLabel: provider.label,
        status: 'failed',
        errorMessage: message,
      });
      console.error(`${provider.label} failed for ${domainName}: ${message}`);
    }
  }

  console.error(`All WHOIS providers failed for ${domainName}.`);
  return {
    status: 'unknown',
    expirationDate: null,
    registeredDate: null,
    registrar: 'Error',
    providerAttempts: attempts,
  };
};
