import { Domain } from '../../types';
import { CategorizedDomain } from '../../utils/domainCategorization';

export type FilterType = 'all' | 'mine' | 'to-snatch' | 'others' | 'missing' | 'expiring' | 'expired' | 'available';
export type SortOption = 'added-desc' | 'added-asc' | 'name-asc' | 'name-desc' | 'expiry-asc' | 'expiry-desc' | 'checked-desc' | 'checked-asc' | 'category-asc' | 'category-desc' | 'tld-asc' | 'tld-desc';

export const FILTER_STORAGE_KEY = 'domain-codev-filter';
export const SORT_STORAGE_KEY = 'domain-codev-sort';
export const CATEGORY_FILTER_STORAGE_KEY = 'domain-codev-category-filter';
export const TLD_FILTER_STORAGE_KEY = 'domain-codev-tld-filter';
export const HIDE_REGISTERED_TARGETS_STORAGE_KEY = 'domain-codev-hide-registered-targets';
export const FILTER_OPTIONS: FilterType[] = ['all', 'mine', 'to-snatch', 'others', 'missing', 'expiring', 'expired', 'available'];
export const SORT_OPTIONS: SortOption[] = ['added-desc', 'added-asc', 'name-asc', 'name-desc', 'expiry-asc', 'expiry-desc', 'checked-desc', 'checked-asc', 'category-asc', 'category-desc', 'tld-asc', 'tld-desc'];
/** Sliding window size (mounted rows) for dense domain lists. */
export const WINDOW_ROWS = 50;
/** Extra rows above/below the estimated viewport. */
export const WINDOW_OVERSCAN = 15;
/** Estimated row height for spacer math (compact/standard average). */
export const ESTIMATED_ROW_HEIGHT = 72;
/** @deprecated Prefer WINDOW_ROWS — kept for callers that still import the old name. */
export const INITIAL_RENDERED_DOMAINS = WINDOW_ROWS + WINDOW_OVERSCAN * 2;
/** @deprecated Prefer sliding window. */
export const RENDER_INCREMENT = WINDOW_ROWS;
const DAY_MS = 1000 * 3600 * 24;

export const readStoredFilter = (): FilterType => {
  if (typeof window === 'undefined') return 'all';
  const stored = window.localStorage.getItem(FILTER_STORAGE_KEY);
  return FILTER_OPTIONS.includes(stored as FilterType) ? stored as FilterType : 'all';
};

export const readStoredSort = (): SortOption => {
  if (typeof window === 'undefined') return 'added-desc';
  const stored = window.localStorage.getItem(SORT_STORAGE_KEY);
  return SORT_OPTIONS.includes(stored as SortOption) ? stored as SortOption : 'added-desc';
};

export const readStoredString = (key: string) => {
  if (typeof window === 'undefined') return 'all';
  return window.localStorage.getItem(key) || 'all';
};

export const readStoredBoolean = (key: string) => {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(key) === 'true';
};

export const hasMissingData = (domain: Domain) => {
  if (!domain.last_checked || domain.status === 'unknown') return true;
  if (domain.status === 'available' || domain.status === 'dropped' || domain.status === 'reserved') return false;

  const shouldHaveFullWhoisData = domain.status === 'registered' || domain.status === 'expired' || domain.tag === 'mine';
  if (!shouldHaveFullWhoisData) return false;

  return !domain.expiration_date
    || !domain.registrar
    || !domain.domain_statuses
    || domain.domain_statuses.length === 0;
};

export const getDaysUntilExpiry = (domain: Domain, now = new Date()) => {
  if (!domain.expiration_date) return null;
  const expiryDate = new Date(domain.expiration_date);
  const diffMs = expiryDate.getTime() - now.getTime();
  if (!Number.isFinite(diffMs)) return null;
  return Math.ceil(diffMs / DAY_MS);
};

export const canDeriveExpiryState = (domain: Domain) => (
  domain.status !== 'available'
  && domain.status !== 'dropped'
  && domain.status !== 'reserved'
  && Boolean(domain.expiration_date)
);

export const isExpiredByDate = (domain: Domain, now = new Date()) => {
  if (domain.status === 'expired') return true;
  if (!canDeriveExpiryState(domain)) return false;
  const daysLeft = getDaysUntilExpiry(domain, now);
  return daysLeft !== null && daysLeft < 0;
};

export const isExpiringSoonByDate = (domain: Domain, now = new Date()) => {
  if (!canDeriveExpiryState(domain) || isExpiredByDate(domain, now)) return false;
  const daysLeft = getDaysUntilExpiry(domain, now);
  return daysLeft !== null && daysLeft >= 0 && daysLeft <= 90;
};

export const getFilterMatch = (domain: Domain, filterType: FilterType, now = new Date()) => {
  switch (filterType) {
    case 'mine':
      return domain.tag === 'mine' && domain.status !== 'available' && domain.status !== 'dropped';
    case 'to-snatch':
      return domain.tag === 'to-snatch' || domain.status === 'available' || domain.status === 'dropped';
    case 'others':
      return domain.tag === 'others' && domain.status !== 'available' && domain.status !== 'dropped';
    case 'missing':
      return hasMissingData(domain);
    case 'available':
      return domain.status === 'available' || domain.status === 'dropped';
    case 'expiring':
      return isExpiringSoonByDate(domain, now);
    case 'expired':
      return isExpiredByDate(domain, now);
    case 'all':
    default:
      return true;
  }
};

export const getFilterCounts = (domains: Domain[], now = new Date()) => {
  const counts: Record<FilterType, number> = {
    all: 0,
    mine: 0,
    'to-snatch': 0,
    others: 0,
    expiring: 0,
    expired: 0,
    missing: 0,
    available: 0,
  };

  for (const domain of domains) {
    counts.all += 1;
    if (getFilterMatch(domain, 'mine', now)) counts.mine += 1;
    if (getFilterMatch(domain, 'to-snatch', now)) counts['to-snatch'] += 1;
    if (getFilterMatch(domain, 'others', now)) counts.others += 1;
    if (getFilterMatch(domain, 'missing', now)) counts.missing += 1;
    if (getFilterMatch(domain, 'expiring', now)) counts.expiring += 1;
    if (getFilterMatch(domain, 'expired', now)) counts.expired += 1;
    if (getFilterMatch(domain, 'available', now)) counts.available += 1;
  }

  return counts;
};

export const applyStatusFilter = (domains: Domain[], filter: FilterType, now = new Date()) => (
  domains.filter(domain => getFilterMatch(domain, filter, now))
);

export const applyKeywordFilter = (
  domains: Domain[],
  normalizedKeyword: string,
  categorizedDomainById: Map<number, CategorizedDomain>,
  categoryNames: Record<string, string>,
) => {
  if (!normalizedKeyword) return domains;

  return domains.filter(domain => {
    const meta = categorizedDomainById.get(domain.id);
    const categoryLabels = meta?.categoryIds.map(categoryId => categoryNames[categoryId] || categoryId) || [];
    const searchable = [
      domain.domain_name,
      domain.status,
      domain.tag,
      domain.registrar || '',
      meta?.parts.tld || '',
      ...categoryLabels,
      ...(domain.domain_statuses || []),
      ...(domain.name_servers || []),
    ].join(' ').toLowerCase();

    return searchable.includes(normalizedKeyword);
  });
};

export const getKeywordSuggestions = (domains: Domain[], normalizedKeyword: string, limit = 5) => {
  if (normalizedKeyword.length < 2) return [];
  return domains
    .filter(domain => domain.domain_name.toLowerCase().includes(normalizedKeyword))
    .slice(0, limit);
};

export const sortDomains = (
  domains: Domain[],
  filter: FilterType,
  sortOption: SortOption,
  categorizedDomainById: Map<number, CategorizedDomain>,
  categoryNames: Record<string, string>,
) => {
  const sortable = [...domains];
  const getCategoryLabel = (domain: Domain) => {
    const meta = categorizedDomainById.get(domain.id);
    if (!meta?.primaryCategoryId) return 'zzzzzz-uncategorized';
    return categoryNames[meta.primaryCategoryId] || 'zzzzzz-uncategorized';
  };
  const getTld = (domain: Domain) => categorizedDomainById.get(domain.id)?.parts.tld || '';

  sortable.sort((a, b) => {
    if (filter === 'expiring') {
      if (!a.expiration_date) return 1;
      if (!b.expiration_date) return -1;
      return new Date(a.expiration_date).getTime() - new Date(b.expiration_date).getTime();
    }

    switch (sortOption) {
      case 'name-asc':
        return a.domain_name.localeCompare(b.domain_name);
      case 'name-desc':
        return b.domain_name.localeCompare(a.domain_name);
      case 'expiry-asc':
        if (!a.expiration_date) return 1;
        if (!b.expiration_date) return -1;
        return new Date(a.expiration_date).getTime() - new Date(b.expiration_date).getTime();
      case 'expiry-desc':
        if (!a.expiration_date) return 1;
        if (!b.expiration_date) return -1;
        return new Date(b.expiration_date).getTime() - new Date(a.expiration_date).getTime();
      case 'added-asc':
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      case 'checked-asc':
        if (!a.last_checked) return 1;
        if (!b.last_checked) return -1;
        return new Date(a.last_checked).getTime() - new Date(b.last_checked).getTime();
      case 'checked-desc':
        if (!a.last_checked) return 1;
        if (!b.last_checked) return -1;
        return new Date(b.last_checked).getTime() - new Date(a.last_checked).getTime();
      case 'category-asc':
        return getCategoryLabel(a).localeCompare(getCategoryLabel(b)) || a.domain_name.localeCompare(b.domain_name);
      case 'category-desc':
        return getCategoryLabel(b).localeCompare(getCategoryLabel(a)) || a.domain_name.localeCompare(b.domain_name);
      case 'tld-asc':
        return getTld(a).localeCompare(getTld(b)) || a.domain_name.localeCompare(b.domain_name);
      case 'tld-desc':
        return getTld(b).localeCompare(getTld(a)) || a.domain_name.localeCompare(b.domain_name);
      case 'added-desc':
      default:
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
  });

  return sortable;
};
