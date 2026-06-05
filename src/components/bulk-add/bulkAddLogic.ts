import { Domain, DomainTag } from '../../types';

export type BulkDomain = { domainName: string; tag?: DomainTag };
export type ActiveTab = 'single' | 'bulk';
export type BulkEntryMode = 'paste' | 'file';

export const splitBulkInput = (value: string) => value
  .split(/[\s,;]+/)
  .map(item => item.trim())
  .filter(Boolean);

export const normalizeDomainInput = (value: string): string | null => {
  let normalized = value.trim().toLowerCase();
  normalized = normalized.replace(/^https?:\/\//, '').replace(/^www\./, '');
  normalized = normalized.split(/[/?#]/)[0];
  normalized = normalized.replace(/\.$/, '');
  return normalized || null;
};

export const isValidDomainName = (value: string) => {
  if (value.length < 3 || value.length > 253) return false;
  if (value.includes('@') || value.includes('*') || value.includes('_')) return false;
  if (!value.includes('.')) return false;
  const labels = value.split('.');
  if (labels.length < 2) return false;
  return labels.every(label => (
    label.length > 0
    && label.length <= 63
    && /^[a-z0-9-]+$/.test(label)
    && !label.startsWith('-')
    && !label.endsWith('-')
  ));
};

export const parseBulkDomains = (values: string[], existingDomainNames: Set<string> = new Set()) => {
  const seen = new Set<string>();
  const domains: BulkDomain[] = [];
  const invalid: string[] = [];
  const duplicates: string[] = [];
  const existing: string[] = [];

  for (const rawValue of values) {
    const domainName = normalizeDomainInput(rawValue);
    if (!domainName || !isValidDomainName(domainName)) {
      invalid.push(rawValue);
      continue;
    }

    if (seen.has(domainName)) {
      duplicates.push(domainName);
      continue;
    }

    if (existingDomainNames.has(domainName)) {
      existing.push(domainName);
      continue;
    }

    seen.add(domainName);
    domains.push({ domainName });
  }

  return { domains, invalid, duplicates, existing };
};

export type ParsedBulkDomains = ReturnType<typeof parseBulkDomains>;

export const formatSkippedImportLog = (source: string, parsed: ParsedBulkDomains) => {
  const parts: string[] = [];
  if (parsed.invalid.length > 0) parts.push(`${parsed.invalid.length} invalid`);
  if (parsed.duplicates.length > 0) parts.push(`${parsed.duplicates.length} duplicate`);
  if (parsed.existing.length > 0) parts.push(`${parsed.existing.length} already tracked`);
  if (parts.length === 0) return null;
  return `⚠️ ${source} skipped ${parts.join(', ')} entr${parts.length === 1 && (parsed.invalid.length + parsed.duplicates.length + parsed.existing.length) === 1 ? 'y' : 'ies'}.`;
};

export const isDomainTag = (value: unknown): value is DomainTag => value === 'mine' || value === 'to-snatch' || value === 'others';

export const getTagLabel = (tag: DomainTag) => {
  if (tag === 'mine') return 'Mine';
  if (tag === 'others') return 'Others';
  return 'To Snatch';
};

export const findExistingDomainMatches = (existingDomains: Domain[], normalizedDomain: string | null) => {
  if (!normalizedDomain || normalizedDomain.length < 2) return [];
  return existingDomains
    .filter(domain => domain.domain_name.toLowerCase().includes(normalizedDomain))
    .slice(0, 5);
};
