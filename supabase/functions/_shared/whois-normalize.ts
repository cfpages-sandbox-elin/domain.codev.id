import { inferDomainStatus } from './whois-status.ts';
import type { WhoisData, WhoisQuota } from './whois-types.ts';

const toNumber = (value: string | null): number | null => {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const readQuotaHeaders = (headers: Headers): WhoisQuota => ({
  limitMonth: toNumber(headers.get('x-ratelimit-limit-month')),
  remainingMonth: toNumber(headers.get('x-ratelimit-remaining-month')),
  limitDay: toNumber(headers.get('x-ratelimit-limit-day')),
  remainingDay: toNumber(headers.get('x-ratelimit-remaining-day')),
});

export const hasQuotaData = (quota?: WhoisQuota): quota is WhoisQuota => {
  if (!quota) return false;
  return Object.values(quota).some(value => value !== null);
};

const compactStrings = (values: unknown[]): string[] => {
  return Array.from(new Set(values
    .flatMap(value => {
      if (Array.isArray(value)) return value;
      if (typeof value === 'string') return value.split(/[,;]/);
      return [];
    })
    .map(value => String(value).trim())
    .filter(Boolean)));
};

export const readNameServers = (...values: unknown[]): string[] => compactStrings(values)
  .map(value => value.replace(/\.$/, '').toLowerCase());

export const readDomainStatuses = (...values: unknown[]): string[] => compactStrings(values)
  .map(value => value.replace(/^https?:\/\/icann\.org\/epp#/i, ''));

let ianaRdapBootstrapCache: { loadedAt: number; services: Array<[string[], string[]]> } | null = null;

const getDomainTld = (domainName: string) => domainName.toLowerCase().split('.').filter(Boolean).pop() || '';

const getIanaRdapServices = async () => {
  const now = Date.now();
  if (ianaRdapBootstrapCache && now - ianaRdapBootstrapCache.loadedAt < 24 * 60 * 60 * 1000) {
    return ianaRdapBootstrapCache.services;
  }

  const response = await fetch('https://data.iana.org/rdap/dns.json');
  if (!response.ok) throw new Error(`IANA RDAP bootstrap failed: ${response.status}`);
  const data = await response.json();
  const services = Array.isArray(data.services) ? data.services : [];
  ianaRdapBootstrapCache = { loadedAt: now, services };
  return services;
};

export const findIanaRdapBaseUrl = async (domainName: string): Promise<string | null> => {
  const tld = getDomainTld(domainName);
  const services = await getIanaRdapServices();
  for (const service of services) {
    const tlds = service[0] || [];
    const urls = service[1] || [];
    if (tlds.includes(tld) && urls.length > 0) {
      return urls[0].replace(/\/$/, '');
    }
  }
  return null;
};

const readRdapEventDate = (events: any[] | undefined, actions: string[]) => {
  if (!Array.isArray(events)) return null;
  const normalizedActions = actions.map(action => action.toLowerCase());
  return events.find(event => normalizedActions.includes(String(event.eventAction || '').toLowerCase()))?.eventDate || null;
};

const readRdapRegistrar = (entities: any[] | undefined) => {
  if (!Array.isArray(entities)) return null;
  const registrar = entities.find(entity => Array.isArray(entity.roles) && entity.roles.includes('registrar'));
  const vcard = registrar?.vcardArray?.[1];
  if (Array.isArray(vcard)) {
    const fn = vcard.find((item: any[]) => item?.[0] === 'fn');
    if (fn?.[3]) return fn[3];
  }
  return registrar?.handle || null;
};

export const normalizeRdapData = (_domainName: string, data: any): WhoisData => {
  const expiryDateStr = readRdapEventDate(data.events, ['expiration']);
  const registeredDateStr = readRdapEventDate(data.events, ['registration']);
  const domainStatuses = readDomainStatuses(data.status);
  const status = inferDomainStatus(false, expiryDateStr, domainStatuses, data.remarks, data.notices);

  return {
    status,
    expirationDate: expiryDateStr,
    registeredDate: registeredDateStr,
    registrar: readRdapRegistrar(data.entities),
    domainStatuses,
    nameServers: readNameServers(
      Array.isArray(data.nameservers)
        ? data.nameservers.map((server: any) => server.ldhName || server.unicodeName || server.name)
        : [],
    ),
  };
};

export const parseFlexibleProviderData = (rawData: any): WhoisData => {
  const data = rawData?.whois || rawData?.result || rawData?.data || rawData;
  const expiryDateStr = data.expires
    || data.expiry
    || data.expire_date
    || data.expiry_date
    || data.expiration_date
    || data.RegistryExpiryDate
    || data.registryExpiryDate
    || data.expiresDate
    || null;
  const registeredDateStr = data.created
    || data.create_date
    || data.creation_date
    || data.CreationDate
    || data.createdDate
    || null;
  const isAvailable = data.available === true
    || data.isAvailable === true
    || data.domain_available === true
    || data.registered === false
    || data.domain_registered === false;
  const domainStatuses = readDomainStatuses(data.status, data.Status, data.statuses, data.domain_status);
  const status = inferDomainStatus(isAvailable, expiryDateStr, domainStatuses, data);

  return {
    status,
    expirationDate: expiryDateStr,
    registeredDate: registeredDateStr,
    registrar: data.registrar || data.Registrar || data.registrar_name || data.registrarName || null,
    domainStatuses,
    nameServers: readNameServers(data.nameservers, data.name_servers, data.nameServers, data.NameServers),
  };
};
