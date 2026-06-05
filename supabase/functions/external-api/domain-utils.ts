import { DomainRow, DomainStatus, DomainTag } from './types.ts';

export const normalizeDomainName = (value: unknown) => {
  if (typeof value !== 'string') return null;
  let domain = value.trim().toLowerCase();
  domain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '');
  domain = domain.split(/[/?#]/)[0] || '';
  domain = domain.replace(/\.$/, '');

  if (!domain || domain.length > 253) return null;
  if (domain.includes('@') || domain.includes('_') || domain.includes('*')) return null;
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)) return null;
  if (domain.includes('..')) return null;
  if (domain.split('.').some(label => !label || label.length > 63 || label.startsWith('-') || label.endsWith('-'))) return null;
  return domain;
};

export const normalizeTag = (value: unknown): DomainTag => {
  if (value === 'to-snatch' || value === 'others') return value;
  return 'mine';
};

export const isAvailableLike = (status: DomainStatus) => status === 'available' || status === 'dropped';
export const isAutoCheckTerminal = (status: DomainStatus) => isAvailableLike(status) || status === 'reserved';

export const isMissingWhoisData = (domain: DomainRow) => {
  if (!domain.last_checked || domain.status === 'unknown') return true;
  if (isAutoCheckTerminal(domain.status)) return false;
  return !domain.expiration_date
    || !domain.registrar
    || !domain.domain_statuses
    || domain.domain_statuses.length === 0;
};

export const daysUntil = (dateString: string | null) => {
  if (!dateString) return null;
  const date = new Date(dateString);
  const diffMs = date.getTime() - Date.now();
  if (!Number.isFinite(diffMs)) return null;
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
};

export const formatDomain = (domain: DomainRow) => ({
  id: domain.id,
  domainName: domain.domain_name,
  tag: domain.tag,
  status: domain.status,
  expirationDate: domain.expiration_date,
  registeredDate: domain.registered_date,
  registrar: domain.registrar,
  domainStatuses: domain.domain_statuses || [],
  nameServers: domain.name_servers || [],
  lastChecked: domain.last_checked,
  createdAt: domain.created_at,
});
