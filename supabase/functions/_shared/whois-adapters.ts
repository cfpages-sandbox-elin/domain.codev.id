import {
  APILAYER_KEY,
  DOMAINDUCK_API_KEY,
  IP2WHOIS_API_KEY,
  OTI_LABS_API_KEY,
  RAPIDAPI_KEY,
  RDAP_API_KEY,
  WHO_DAT_AUTH_KEY,
  WHO_DAT_URL,
  WHOAPI_COM_KEY,
  WHOISFREAKS_KEY,
  WHOISJSON_API_KEY,
  WHOISXMLAPI_KEY,
} from './whois-env.ts';
import {
  findIanaRdapBaseUrl,
  normalizeRdapData,
  parseFlexibleProviderData,
  readDomainStatuses,
  readNameServers,
  readQuotaHeaders,
} from './whois-normalize.ts';
import { inferDomainStatus } from './whois-status.ts';
import type { WhoisData, WhoisProviderCredentials, WhoisProviderId } from './whois-types.ts';

type WhoisProviderHandler = (domainName: string, credentials: WhoisProviderCredentials) => Promise<WhoisData>;

const getWhoisDataFromWhoDat = async (domainName: string): Promise<WhoisData> => {
  const headers = new Headers();
  if (WHO_DAT_AUTH_KEY) headers.append('Authorization', `Bearer ${WHO_DAT_AUTH_KEY}`);
  const response = await fetch(`${WHO_DAT_URL!}/${domainName}`, { headers });
  if (!response.ok) throw new Error(`who-dat failed: ${response.status}`);
  const data = await response.json();
  if (data.error) throw new Error(`who-dat error: ${data.error}`);
  const domainStatuses = readDomainStatuses(data.status, data.statuses);
  const status = inferDomainStatus(Boolean(data.isAvailable), data.dates?.expiry || null, domainStatuses, data);
  return {
    status,
    expirationDate: data.dates?.expiry || null,
    registeredDate: data.dates?.created || null,
    registrar: data.registrar?.name || null,
    domainStatuses,
    nameServers: readNameServers(data.nameservers, data.nameServers),
  };
};

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
  const domainStatuses = readDomainStatuses(record.status, record.registryData?.status);
  const status = inferDomainStatus(record.domainAvailability === 'AVAILABLE', expiryDateStr, domainStatuses, record);
  return {
    status,
    expirationDate: expiryDateStr || null,
    registeredDate: record.registryData?.createdDate || record.createdDate || null,
    registrar: record.registrarName || null,
    domainStatuses,
    nameServers: readNameServers(record.nameServers?.hostNames, record.registryData?.nameServers?.hostNames),
  };
};

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
  const domainStatuses = readDomainStatuses(result.status, result.domain_status);
  const status = inferDomainStatus(result.status === 'available', result.expiration_date || null, domainStatuses, result);
  return {
    status,
    expirationDate: result.expiration_date || null,
    registeredDate: result.creation_date || null,
    registrar: result.registrar || null,
    domainStatuses,
    nameServers: readNameServers(result.name_servers, result.nameservers),
    quota,
  };
};

const getWhoisDataFromWhoisFreaks = async (domainName: string): Promise<WhoisData> => {
  if (!WHOISFREAKS_KEY) throw new Error('WhoisFreaks Key not provided.');
  const url = `https://api.whoisfreaks.com/v1.0/whois?apiKey=${WHOISFREAKS_KEY}&whois=live&domainName=${domainName}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`WhoisFreaks failed: ${response.status}`);
  const data = await response.json();
  if (!data.status || data.error) throw new Error(`WhoisFreaks Error: ${data.error?.message || 'Request failed'}`);
  const domainStatuses = readDomainStatuses(data.domain_status, data.statuses);
  const status = inferDomainStatus(data.domain_registered === 'no', data.expiry_date || null, domainStatuses, data);
  return {
    status,
    expirationDate: data.expiry_date || null,
    registeredDate: data.create_date || null,
    registrar: data.domain_registrar?.registrar_name || null,
    domainStatuses,
    nameServers: readNameServers(data.name_servers, data.nameservers),
  };
};

const getWhoisDataFromWhoapi = async (domainName: string): Promise<WhoisData> => {
  if (!WHOAPI_COM_KEY) throw new Error('WhoAPI Key not provided.');
  const url = `https://api.whoapi.com/?apikey=${WHOAPI_COM_KEY}&r=whois&domain=${domainName}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`WhoAPI failed: ${response.status}`);
  const data = await response.json();
  if (data.status !== '0') throw new Error(`WhoAPI Error: ${data.status_desc || `Status ${data.status}`}`);
  const expiryDateStr = data.date_expires;
  const domainStatuses = readDomainStatuses(data.statuses, data.domain_status);
  const status = inferDomainStatus(!data.registered, expiryDateStr, domainStatuses, data);
  const registrarContact = data.contacts?.find((c: any) => c.type === 'registrar');
  const registrarName = registrarContact?.organization || data.whois_name || null;
  return {
    status,
    expirationDate: expiryDateStr || null,
    registeredDate: data.date_created || null,
    registrar: registrarName,
    domainStatuses,
    nameServers: readNameServers(data.nameservers, data.name_servers),
  };
};

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
  const domainStatuses = readDomainStatuses(data.status, data.domain_status);
  const status = inferDomainStatus(false, expiryDateStr, domainStatuses, data);

  return {
    status,
    expirationDate: data.expiration_date || null,
    registeredDate: data.creation_date || null,
    registrar: data.registrar || null,
    domainStatuses,
    nameServers: readNameServers(data.name_servers, data.nameservers),
  };
};

const getRapidApiJson = async (url: string, host: string) => {
  if (!RAPIDAPI_KEY) throw new Error('RapidAPI Key not provided.');

  const response = await fetch(url, {
    headers: {
      'x-rapidapi-key': RAPIDAPI_KEY,
      'x-rapidapi-host': host,
      Accept: 'application/json',
    },
  });
  const quota = readQuotaHeaders(response.headers);
  const text = await response.text();
  let data: any = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      if (response.ok) throw new Error(`${host} returned invalid JSON`);
      data = { message: text.slice(0, 240) };
    }
  }

  return { response, data, quota };
};

const getWhoisDataFromRapidApiDomainsApi = async (domainName: string): Promise<WhoisData> => {
  const host = 'domains-api.p.rapidapi.com';
  const { response, data, quota } = await getRapidApiJson(
    `https://${host}/domains/${encodeURIComponent(domainName)}/whois`,
    host,
  );

  if (response.status === 404 || data.status === 'Available for registration' || data.available === true) {
    return {
      status: 'available',
      expirationDate: null,
      registeredDate: null,
      registrar: null,
      quota,
    };
  }
  if (!response.ok) {
    throw new Error(`RapidAPI Domains API failed: ${response.status}: ${data.error || data.message || JSON.stringify(data)}`);
  }
  if (data.error || data.message === 'rate limit exceeded') {
    throw new Error(`RapidAPI Domains API Error: ${data.error || data.message}`);
  }

  const normalized = parseFlexibleProviderData(data?.whois || data?.result?.whois || data?.data?.whois || data);
  return { ...normalized, quota };
};

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
  const domainStatuses = readDomainStatuses(data.status, data.domain_status, data.domainStatuses);
  const status = inferDomainStatus(isAvailable, expiryDateStr, domainStatuses, data);

  return {
    status,
    expirationDate: expiryDateStr,
    registeredDate: registeredDateStr,
    registrar: data.registrar || data.registrar_name || data.registrarName || null,
    domainStatuses,
    nameServers: readNameServers(data.name_servers, data.nameservers, data.nameServers),
  };
};

const getWhoisDataFromIp2Whois = async (domainName: string): Promise<WhoisData> => {
  if (!IP2WHOIS_API_KEY) throw new Error('IP2WHOIS Key not provided.');
  const response = await fetch(`https://api.ip2whois.com/v2?key=${IP2WHOIS_API_KEY}&domain=${encodeURIComponent(domainName)}`);
  if (!response.ok) throw new Error(`IP2WHOIS failed: ${response.status}`);
  const data = await response.json();
  if (data.error || data.error_message) throw new Error(`IP2WHOIS Error: ${data.error_message || data.error}`);
  const expiryDateStr = data.expire_date || data.expiration_date || null;
  const registeredDateStr = data.create_date || data.creation_date || null;
  const domainStatuses = readDomainStatuses(data.status, data.domain_status);
  const status = inferDomainStatus(data.available === true, expiryDateStr, domainStatuses, data);

  return {
    status,
    expirationDate: expiryDateStr,
    registeredDate: registeredDateStr,
    registrar: data.registrar?.name || data.registrar || null,
    domainStatuses,
    nameServers: readNameServers(data.nameservers, data.name_servers),
  };
};

const getWhoisDataFromIanaRdap = async (domainName: string): Promise<WhoisData> => {
  const baseUrl = await findIanaRdapBaseUrl(domainName);
  if (!baseUrl) throw new Error(`No IANA RDAP server found for ${domainName}`);

  const response = await fetch(`${baseUrl}/domain/${encodeURIComponent(domainName)}`, {
    headers: { Accept: 'application/rdap+json, application/json' },
  });
  if (response.status === 404) {
    return {
      status: 'available',
      expirationDate: null,
      registeredDate: null,
      registrar: null,
    };
  }
  if (!response.ok) throw new Error(`IANA RDAP lookup failed: ${response.status}`);

  const data = await response.json();
  return normalizeRdapData(domainName, data);
};

const getWhoisDataFromRdapOrg = async (domainName: string): Promise<WhoisData> => {
  const response = await fetch(`https://rdap.org/domain/${encodeURIComponent(domainName)}`, {
    headers: { Accept: 'application/rdap+json, application/json' },
  });
  if (response.status === 404) {
    return {
      status: 'available',
      expirationDate: null,
      registeredDate: null,
      registrar: null,
    };
  }
  if (!response.ok) throw new Error(`RDAP.org lookup failed: ${response.status}`);

  const data = await response.json();
  return normalizeRdapData(domainName, data);
};

const getWhoisDataFromOtiLabs = async (domainName: string, credentials: WhoisProviderCredentials): Promise<WhoisData> => {
  const apiKey = credentials['oti-labs'] || OTI_LABS_API_KEY || RAPIDAPI_KEY;
  if (!apiKey) throw new Error('OTI Labs API key not provided.');

  const response = await fetch(`https://domain-intelligence-api.p.rapidapi.com/domain/${encodeURIComponent(domainName)}/whois`, {
    headers: {
      'x-rapidapi-key': apiKey,
      'x-rapidapi-host': 'domain-intelligence-api.p.rapidapi.com',
      Accept: 'application/json',
    },
  });
  if (response.status === 404) {
    return {
      status: 'available',
      expirationDate: null,
      registeredDate: null,
      registrar: null,
    };
  }
  if (!response.ok) throw new Error(`OTI Labs failed: ${response.status}`);

  const data = await response.json();
  return parseFlexibleProviderData(data);
};

const getWhoisDataFromDomainduck = async (domainName: string, credentials: WhoisProviderCredentials): Promise<WhoisData> => {
  const apiKey = credentials.domainduck || DOMAINDUCK_API_KEY;
  if (!apiKey) throw new Error('Domainduck API key not provided.');

  const response = await fetch(`https://v1.api.domainduck.io/api/get/?domain=${encodeURIComponent(domainName)}&apikey=${encodeURIComponent(apiKey)}&whois=1`);
  if (!response.ok) throw new Error(`Domainduck failed: ${response.status}`);
  const data = await response.json();
  if (data.error || data.message === 'rate limit exceeded') throw new Error(`Domainduck Error: ${data.error || data.message}`);
  return parseFlexibleProviderData(data);
};

const getWhoisDataFromRdapApi = async (domainName: string, credentials: WhoisProviderCredentials): Promise<WhoisData> => {
  const apiKey = credentials['rdap-api'] || RDAP_API_KEY;
  if (!apiKey) throw new Error('RDAP API key not provided.');

  const response = await fetch(`https://rdapapi.io/api/v1/domain/${encodeURIComponent(domainName)}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
    },
  });
  if (response.status === 404) {
    return {
      status: 'available',
      expirationDate: null,
      registeredDate: null,
      registrar: null,
    };
  }
  if (!response.ok) throw new Error(`RDAP API failed: ${response.status}`);

  const data = await response.json();
  return normalizeRdapData(domainName, data.object || data.rdap || data);
};

export const providerHandlers: Array<[WhoisProviderId, WhoisProviderHandler]> = [
  ['who-dat', getWhoisDataFromWhoDat],
  ['whoisxmlapi', getWhoisDataFromWhoisXmlApi],
  ['apilayer', getWhoisDataFromApiLayer],
  ['whoisfreaks', getWhoisDataFromWhoisFreaks],
  ['whoapi', getWhoisDataFromWhoapi],
  ['rapidapi', getWhoisDataFromRapidApi],
  ['rapidapi-domains-api', getWhoisDataFromRapidApiDomainsApi],
  ['whoisjson', getWhoisDataFromWhoisJson],
  ['ip2whois', getWhoisDataFromIp2Whois],
  ['rdap-iana', getWhoisDataFromIanaRdap],
  ['rdap-org', getWhoisDataFromRdapOrg],
  ['oti-labs', getWhoisDataFromOtiLabs],
  ['domainduck', getWhoisDataFromDomainduck],
  ['rdap-api', getWhoisDataFromRdapApi],
];
