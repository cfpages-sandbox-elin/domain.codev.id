import React, { useCallback, useState, useMemo, useRef, useEffect } from 'react';
import { Domain, WhoisData } from '../types';
import DomainItem from './DomainItem';
import { ChevronUpDownIcon, ArrowUpOnSquareIcon, ArrowDownOnSquareIcon, RefreshIcon, HomeIcon, TargetIcon, CheckCircleIcon, ExclamationTriangleIcon, XCircleIcon, DomainCodevIcon, UsersIcon } from './icons';
import Tooltip from './Tooltip';
import { categorizeDomains, DomainCategory } from '../utils/domainCategorization';

interface DomainListProps {
  domains: Domain[];
  whoisDetailsByDomainId: Record<number, WhoisData>;
  onRemove: (id: number) => void;
  onShowInfo: (domain: Domain) => void;
  onToggleTag: (id: number) => void;
  onSetTag: (id: number, tag: Domain['tag']) => void;
  onRecheck: (id: number) => Promise<void>;
  autoRepairingDomainIds?: Set<number>;
  pendingDomainIds?: Set<number>;
  onImportRequest: () => void;
  onExportRequest: (format: 'json' | 'csv') => void;
  isProcessing: boolean;
}

type FilterType = 'all' | 'mine' | 'to-snatch' | 'others' | 'expiring' | 'expired' | 'available';
type SortOption = 'added-desc' | 'added-asc' | 'name-asc' | 'name-desc' | 'expiry-asc' | 'expiry-desc' | 'checked-desc' | 'checked-asc' | 'category-asc' | 'category-desc' | 'tld-asc' | 'tld-desc';

const FILTER_STORAGE_KEY = 'domain-codev-filter';
const SORT_STORAGE_KEY = 'domain-codev-sort';
const CATEGORY_FILTER_STORAGE_KEY = 'domain-codev-category-filter';
const TLD_FILTER_STORAGE_KEY = 'domain-codev-tld-filter';
const CATEGORY_NAMES_STORAGE_KEY = 'domain-codev-category-names';
const HIDE_REGISTERED_TARGETS_STORAGE_KEY = 'domain-codev-hide-registered-targets';
const FILTER_OPTIONS: FilterType[] = ['all', 'mine', 'to-snatch', 'others', 'expiring', 'expired', 'available'];
const SORT_OPTIONS: SortOption[] = ['added-desc', 'added-asc', 'name-asc', 'name-desc', 'expiry-asc', 'expiry-desc', 'checked-desc', 'checked-asc', 'category-asc', 'category-desc', 'tld-asc', 'tld-desc'];
const INITIAL_RENDERED_DOMAINS = 180;
const RENDER_INCREMENT = 120;

const readStoredFilter = (): FilterType => {
  if (typeof window === 'undefined') return 'all';
  const stored = window.localStorage.getItem(FILTER_STORAGE_KEY);
  return FILTER_OPTIONS.includes(stored as FilterType) ? stored as FilterType : 'all';
};

const readStoredSort = (): SortOption => {
  if (typeof window === 'undefined') return 'added-desc';
  const stored = window.localStorage.getItem(SORT_STORAGE_KEY);
  return SORT_OPTIONS.includes(stored as SortOption) ? stored as SortOption : 'added-desc';
};

const readStoredString = (key: string) => {
  if (typeof window === 'undefined') return 'all';
  return window.localStorage.getItem(key) || 'all';
};

const readStoredBoolean = (key: string) => {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(key) === 'true';
};

const readStoredCategoryNames = (): Record<string, string> => {
  if (typeof window === 'undefined') return {};
  try {
    const stored = window.localStorage.getItem(CATEGORY_NAMES_STORAGE_KEY);
    if (!stored) return {};
    const parsed = JSON.parse(stored);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const hasMissingData = (domain: Domain) => {
  if (!domain.last_checked || domain.status === 'unknown') return true;
  if (domain.status === 'available' || domain.status === 'dropped') return false;

  const shouldHaveFullWhoisData = domain.status === 'registered' || domain.status === 'expired' || domain.tag === 'mine';
  if (!shouldHaveFullWhoisData) return false;

  return !domain.expiration_date
    || !domain.registrar
    || !domain.domain_statuses
    || domain.domain_statuses.length === 0
    || !domain.name_servers
    || domain.name_servers.length === 0;
};

const CATEGORY_GROUP_STYLES = [
  'border-indigo-300 bg-indigo-50/70 dark:border-indigo-700 dark:bg-indigo-950/30',
  'border-teal-300 bg-teal-50/70 dark:border-teal-700 dark:bg-teal-950/30',
  'border-amber-300 bg-amber-50/70 dark:border-amber-700 dark:bg-amber-950/30',
  'border-rose-300 bg-rose-50/70 dark:border-rose-700 dark:bg-rose-950/30',
  'border-sky-300 bg-sky-50/70 dark:border-sky-700 dark:bg-sky-950/30',
  'border-violet-300 bg-violet-50/70 dark:border-violet-700 dark:bg-violet-950/30',
];

const CategoryControls: React.FC<{
  categories: DomainCategory[];
  categoryNames: Record<string, string>;
  selectedCategoryId: string;
  onSelectCategory: (categoryId: string) => void;
  onRenameCategory: (categoryId: string, name: string) => void;
}> = ({ categories, categoryNames, selectedCategoryId, onSelectCategory, onRenameCategory }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  if (categories.length === 0) return null;

  return (
    <div className="mb-5 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950/60">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Categories</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">Rows are grouped by primary base-name category. Domains can still carry overlap chips when they match more than one category.</p>
        </div>
        <button
          type="button"
          onClick={() => setIsExpanded(current => !current)}
          className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          {isExpanded ? 'Collapse' : `Show ${categories.length} categories`}
        </button>
      </div>

      {selectedCategoryId !== 'all' && (
        <div className="mb-3 flex justify-center">
          <button
            type="button"
            onClick={() => onSelectCategory('all')}
            className="rounded-full bg-brand-blue px-3 py-1.5 text-xs font-semibold text-white"
          >
            Clear category filter
          </button>
        </div>
      )}

      {isExpanded && (
        <div className="flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => onSelectCategory('all')}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${selectedCategoryId === 'all' ? 'bg-brand-blue text-white' : 'bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'}`}
          >
            All
          </button>
          {categories.map((category, index) => {
            const label = categoryNames[category.id] || category.suggestedName;
            const isSelected = selectedCategoryId === category.id;
            return (
              <div
                key={category.id}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 ${CATEGORY_GROUP_STYLES[index % CATEGORY_GROUP_STYLES.length]} ${isSelected ? 'ring-2 ring-brand-blue ring-offset-2 dark:ring-offset-slate-950' : ''}`}
              >
                <button
                  type="button"
                  onClick={() => onSelectCategory(category.id)}
                  className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-semibold text-slate-600 hover:bg-white dark:bg-slate-900/60 dark:text-slate-300 dark:hover:bg-slate-900"
                >
                  {category.members.length}
                </button>
                <input
                  value={label}
                  onChange={(event) => onRenameCategory(category.id, event.target.value)}
                  onFocus={() => onSelectCategory(category.id)}
                  className="w-28 rounded bg-white/70 px-1.5 py-0.5 text-center text-xs font-bold text-slate-700 outline-none focus:ring-1 focus:ring-brand-blue dark:bg-black/20 dark:text-slate-100"
                  aria-label={`Rename category ${category.suggestedName}`}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const DomainList: React.FC<DomainListProps> = ({ domains, whoisDetailsByDomainId, onRemove, onShowInfo, onToggleTag, onSetTag, onRecheck, autoRepairingDomainIds, pendingDomainIds, onImportRequest, onExportRequest, isProcessing }) => {
  const [filter, setFilter] = useState<FilterType>(readStoredFilter);
  const [sortOption, setSortOption] = useState<SortOption>(readStoredSort);
  const [categoryFilter, setCategoryFilter] = useState(readStoredString(CATEGORY_FILTER_STORAGE_KEY));
  const [tldFilter, setTldFilter] = useState(readStoredString(TLD_FILTER_STORAGE_KEY));
  const [hideRegisteredTargets, setHideRegisteredTargets] = useState(() => readStoredBoolean(HIDE_REGISTERED_TARGETS_STORAGE_KEY));
  const [categoryNameOverrides, setCategoryNameOverrides] = useState<Record<string, string>>(readStoredCategoryNames);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isRecheckMenuOpen, setIsRecheckMenuOpen] = useState(false);
  const [isRecheckingVisible, setIsRecheckingVisible] = useState(false);
  const [visibleDomainLimit, setVisibleDomainLimit] = useState(INITIAL_RENDERED_DOMAINS);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const recheckMenuRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setIsExportMenuOpen(false);
      }
      if (recheckMenuRef.current && !recheckMenuRef.current.contains(event.target as Node)) {
        setIsRecheckMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(FILTER_STORAGE_KEY, filter);
  }, [filter]);

  useEffect(() => {
    window.localStorage.setItem(SORT_STORAGE_KEY, sortOption);
  }, [sortOption]);

  useEffect(() => {
    window.localStorage.setItem(CATEGORY_FILTER_STORAGE_KEY, categoryFilter);
  }, [categoryFilter]);

  useEffect(() => {
    window.localStorage.setItem(TLD_FILTER_STORAGE_KEY, tldFilter);
  }, [tldFilter]);

  useEffect(() => {
    window.localStorage.setItem(HIDE_REGISTERED_TARGETS_STORAGE_KEY, String(hideRegisteredTargets));
  }, [hideRegisteredTargets]);

  useEffect(() => {
    window.localStorage.setItem(CATEGORY_NAMES_STORAGE_KEY, JSON.stringify(categoryNameOverrides));
  }, [categoryNameOverrides]);

  useEffect(() => {
    setVisibleDomainLimit(INITIAL_RENDERED_DOMAINS);
  }, [categoryFilter, filter, hideRegisteredTargets, sortOption, tldFilter]);

  const categorization = useMemo(() => categorizeDomains(domains), [domains]);
  const categoriesById = useMemo(
    () => new Map(categorization.categories.map(category => [category.id, category])),
    [categorization.categories],
  );
  const categoryNames = useMemo(() => {
    const names: Record<string, string> = {};
    for (const category of categorization.categories) {
      names[category.id] = (categoryNameOverrides[category.id] || category.suggestedName).trim() || category.suggestedName;
    }
    return names;
  }, [categorization.categories, categoryNameOverrides]);
  const categorizedDomainById = useMemo(
    () => new Map(categorization.categorizedDomains.map(item => [item.domain.id, item])),
    [categorization.categorizedDomains],
  );
  const tldOptions = useMemo(() => {
    const tlds = new Set<string>();
    for (const item of categorization.categorizedDomains) {
      if (item.parts.tld) tlds.add(item.parts.tld);
    }
    return Array.from(tlds).sort((a, b) => a.localeCompare(b));
  }, [categorization.categorizedDomains]);

  useEffect(() => {
    if (categoryFilter !== 'all' && !categoriesById.has(categoryFilter)) {
      setCategoryFilter('all');
    }
  }, [categoriesById, categoryFilter]);

  useEffect(() => {
    if (tldFilter !== 'all' && !tldOptions.includes(tldFilter)) {
      setTldFilter('all');
    }
  }, [tldFilter, tldOptions]);

  const handleRenameCategory = (categoryId: string, name: string) => {
    setCategoryNameOverrides(current => ({ ...current, [categoryId]: name }));
  };

  const contextFilteredDomains = useMemo(() => domains.filter(domain => {
    const meta = categorizedDomainById.get(domain.id);
    if (categoryFilter !== 'all' && !meta?.categoryIds.includes(categoryFilter)) return false;
    if (tldFilter !== 'all' && meta?.parts.tld !== tldFilter) return false;
    if (hideRegisteredTargets && domain.tag === 'to-snatch' && domain.status === 'registered') return false;
    return true;
  }), [categorizedDomainById, categoryFilter, domains, hideRegisteredTargets, tldFilter]);

  const getFilterMatch = (domain: Domain, filterType: FilterType) => {
    switch (filterType) {
      case 'mine':
        return domain.tag === 'mine' && domain.status !== 'available' && domain.status !== 'dropped';
      case 'to-snatch':
        return domain.tag === 'to-snatch' || domain.status === 'available' || domain.status === 'dropped';
      case 'others':
        return domain.tag === 'others' && domain.status !== 'available' && domain.status !== 'dropped';
      case 'available':
        return domain.status === 'available' || domain.status === 'dropped';
      case 'expiring':
        if (!domain.expiration_date) return false;
        const daysLeft = (new Date(domain.expiration_date).getTime() - Date.now()) / (1000 * 3600 * 24);
        return daysLeft > 0 && daysLeft <= 90;
      case 'expired':
        return domain.status === 'expired';
      case 'all':
      default:
        return true;
    }
  };

  const filterCounts = useMemo(() => {
    const counts: Record<FilterType, number> = {
      all: 0,
      mine: 0,
      'to-snatch': 0,
      others: 0,
      expiring: 0,
      expired: 0,
      available: 0,
    };

    for (const domain of contextFilteredDomains) {
      counts.all += 1;
      if (getFilterMatch(domain, 'mine')) counts.mine += 1;
      if (getFilterMatch(domain, 'to-snatch')) counts['to-snatch'] += 1;
      if (getFilterMatch(domain, 'others')) counts.others += 1;
      if (getFilterMatch(domain, 'expiring')) counts.expiring += 1;
      if (getFilterMatch(domain, 'expired')) counts.expired += 1;
      if (getFilterMatch(domain, 'available')) counts.available += 1;
    }

    return counts;
  }, [contextFilteredDomains]);

  const filteredDomains = useMemo(() => contextFilteredDomains.filter(domain => {
    switch (filter) {
      case 'mine':
        return domain.tag === 'mine' && domain.status !== 'available' && domain.status !== 'dropped';
      case 'to-snatch':
        return domain.tag === 'to-snatch' || domain.status === 'available' || domain.status === 'dropped';
      case 'others':
        return domain.tag === 'others' && domain.status !== 'available' && domain.status !== 'dropped';
      case 'available':
        return domain.status === 'available' || domain.status === 'dropped';
      case 'expiring':
        if (!domain.expiration_date) return false;
        const daysLeft = (new Date(domain.expiration_date).getTime() - Date.now()) / (1000 * 3600 * 24);
        return daysLeft > 0 && daysLeft <= 90;
      case 'expired':
        return domain.status === 'expired';
      case 'all':
      default:
        return true;
    }
  }), [contextFilteredDomains, filter]);

  const sortedDomains = useMemo(() => {
    const sortable = [...filteredDomains];
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
  }, [categorizedDomainById, categoryNames, filter, filteredDomains, sortOption]);

  const categoryGroups = useMemo(() => {
    if (categoryFilter !== 'all' || categorization.categories.length === 0) {
      return [];
    }

    const domainsByPrimaryCategory = new Map<string, Domain[]>();
    const uncategorized: Domain[] = [];
    for (const domain of sortedDomains) {
      const primaryCategoryId = categorizedDomainById.get(domain.id)?.primaryCategoryId;
      if (!primaryCategoryId) {
        uncategorized.push(domain);
        continue;
      }
      domainsByPrimaryCategory.set(primaryCategoryId, [
        ...(domainsByPrimaryCategory.get(primaryCategoryId) || []),
        domain,
      ]);
    }

    const groups = categorization.categories
      .map((category, index) => {
        const groupDomains = domainsByPrimaryCategory.get(category.id) || [];
        if (groupDomains.length === 0) return null;

        const overlapCategoryIds = new Set<string>();
        for (const domain of groupDomains) {
          const meta = categorizedDomainById.get(domain.id);
          for (const categoryId of meta?.categoryIds || []) {
            if (categoryId !== category.id) overlapCategoryIds.add(categoryId);
          }
        }

        return {
          id: category.id,
          label: categoryNames[category.id] || category.suggestedName,
          domains: groupDomains,
          style: CATEGORY_GROUP_STYLES[index % CATEGORY_GROUP_STYLES.length],
          overlapCategoryIds: Array.from(overlapCategoryIds),
          overlapLabels: Array.from(overlapCategoryIds).map(categoryId => categoryNames[categoryId] || categoryId),
        };
      })
      .filter((group): group is {
        id: string;
        label: string;
        domains: Domain[];
        style: string;
        overlapCategoryIds: string[];
        overlapLabels: string[];
      } => Boolean(group));

    const orderedGroups: typeof groups = [];
    const remaining = new Map(groups.map(group => [group.id, group]));
    while (remaining.size > 0) {
      const seed = Array.from(remaining.values())
        .sort((a, b) => b.overlapCategoryIds.length - a.overlapCategoryIds.length || a.label.localeCompare(b.label))[0];
      const queue = [seed.id];
      while (queue.length > 0) {
        const id = queue.shift()!;
        const group = remaining.get(id);
        if (!group) continue;
        remaining.delete(id);
        orderedGroups.push(group);
        const relatedIds = group.overlapCategoryIds
          .filter(categoryId => remaining.has(categoryId))
          .sort((a, b) => (categoryNames[a] || a).localeCompare(categoryNames[b] || b));
        queue.push(...relatedIds);
      }
    }

    if (uncategorized.length > 0) {
      orderedGroups.push({
        id: 'uncategorized',
        label: 'Uncategorized',
        domains: uncategorized,
        style: 'border-slate-300 bg-slate-50/70 dark:border-slate-700 dark:bg-slate-950/40',
        overlapCategoryIds: [],
        overlapLabels: [],
      });
    }

    return orderedGroups;
  }, [categorizedDomainById, categorization.categories, categoryFilter, categoryNames, sortedDomains]);

  const shouldWindowDomains = sortedDomains.length > INITIAL_RENDERED_DOMAINS;
  const renderedDomainLimit = shouldWindowDomains ? visibleDomainLimit : sortedDomains.length;
  const renderedDomains = useMemo(
    () => sortedDomains.slice(0, renderedDomainLimit),
    [renderedDomainLimit, sortedDomains],
  );
  const renderedCategoryGroups = useMemo(() => {
    if (categoryGroups.length === 0) return [];
    let remaining = renderedDomainLimit;
    const groups = [];

    for (const group of categoryGroups) {
      if (remaining <= 0) break;
      const domainsForGroup = group.domains.slice(0, remaining);
      if (domainsForGroup.length > 0) {
        groups.push({
          ...group,
          domains: domainsForGroup,
          renderedCount: domainsForGroup.length,
          totalCount: group.domains.length,
        });
        remaining -= domainsForGroup.length;
      }
    }

    return groups;
  }, [categoryGroups, renderedDomainLimit]);
  const renderedCount = Math.min(renderedDomainLimit, sortedDomains.length);
  const hasMoreDomainsToRender = renderedCount < sortedDomains.length;

  const loadMoreDomains = useCallback(() => {
    setVisibleDomainLimit(current => Math.min(current + RENDER_INCREMENT, sortedDomains.length));
  }, [sortedDomains.length]);

  useEffect(() => {
    if (!hasMoreDomainsToRender || !loadMoreRef.current || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some(entry => entry.isIntersecting)) {
        loadMoreDomains();
      }
    }, { rootMargin: '600px 0px' });
    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasMoreDomainsToRender, loadMoreDomains]);

  const filterIcons: Record<FilterType, React.ReactNode> = {
    all: <DomainCodevIcon className="h-4 w-4" />,
    mine: <HomeIcon className="h-4 w-4" />,
    'to-snatch': <TargetIcon className="h-4 w-4" />,
    others: <UsersIcon className="h-4 w-4" />,
    available: <CheckCircleIcon className="h-4 w-4" />,
    expiring: <ExclamationTriangleIcon className="h-4 w-4" />,
    expired: <XCircleIcon className="h-4 w-4" />,
  };

  const FilterButton: React.FC<{ filterType: FilterType, children: React.ReactNode }> = ({ filterType, children }) => (
     <button
        onClick={() => setFilter(filterType)}
        disabled={isProcessing}
        className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
          filter === filterType 
            ? 'bg-brand-blue text-white' 
            : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'
        }`}
      >
        {filterIcons[filterType]}
        {children}
        <span className={`rounded-full px-1.5 text-[11px] font-semibold ${
          filter === filterType
            ? 'bg-white/25 text-white'
            : 'bg-white/70 text-slate-500 dark:bg-slate-900/60 dark:text-slate-300'
        }`}>
          {filterCounts[filterType]}
        </span>
      </button>
  );

  const handleExportClick = (format: 'json' | 'csv') => {
    onExportRequest(format);
    setIsExportMenuOpen(false);
  }

  const missingDataDomains = useMemo(
    () => sortedDomains.filter(hasMissingData),
    [sortedDomains],
  );
  const registeredTargetCount = useMemo(
    () => domains.filter(domain => domain.tag === 'to-snatch' && domain.status === 'registered').length,
    [domains],
  );

  const renderDomainItem = (domain: Domain) => {
    const meta = categorizedDomainById.get(domain.id);
    const labels = meta?.categoryIds.map(categoryId => categoryNames[categoryId] || categoryId) || [];
    return (
      <DomainItem
        key={domain.id}
        domain={domain}
        whoisDetails={whoisDetailsByDomainId[domain.id]}
        onRemove={onRemove}
        onShowInfo={onShowInfo}
        onToggleTag={onToggleTag}
        onSetTag={onSetTag}
        onRecheck={onRecheck}
        isAutoRefreshing={autoRepairingDomainIds?.has(domain.id)}
        isPending={pendingDomainIds?.has(domain.id)}
        categoryLabels={labels}
        tld={meta?.parts.tld}
      />
    );
  };

  const runRecheck = async (targetDomains: Domain[], label: string) => {
    if (isRecheckingVisible || targetDomains.length === 0) return;
    const confirmed = window.confirm(`Re-check ${targetDomains.length} ${label}? This may use WHOIS API quota.`);
    if (!confirmed) return;

    setIsRecheckMenuOpen(false);
    setIsRecheckingVisible(true);
    try {
      for (const domain of targetDomains) {
        await onRecheck(domain.id);
      }
    } finally {
      setIsRecheckingVisible(false);
    }
  };

  if (domains.length === 0 && !isProcessing) {
    return (
        <div className="text-center py-12">
            <h3 className="text-xl font-semibold text-slate-700 dark:text-slate-300">Your list is empty</h3>
            <p className="mt-2 text-slate-500 dark:text-slate-400">Add a domain or import a list to start tracking!</p>
            <button
                onClick={onImportRequest}
                className="mt-6 inline-flex items-center gap-2 px-4 py-2 font-semibold text-white bg-brand-blue hover:bg-blue-600 rounded-lg transition-colors"
            >
                <ArrowUpOnSquareIcon className="w-5 h-5" />
                Import / Add Bulk
            </button>
        </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-center gap-3">
            <FilterButton filterType="all">All</FilterButton>
            <FilterButton filterType="mine">Mine</FilterButton>
            <FilterButton filterType="to-snatch">To Snatch</FilterButton>
            <FilterButton filterType="others">Others</FilterButton>
            <FilterButton filterType="available">Available</FilterButton>
            <FilterButton filterType="expiring">Expiring Soon</FilterButton>
            <FilterButton filterType="expired">Expired</FilterButton>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
            <div className="relative" ref={recheckMenuRef}>
                <Tooltip content="Choose what to re-check. This may use WHOIS API quota.">
                    <button
                        onClick={() => setIsRecheckMenuOpen(prev => !prev)}
                        disabled={isProcessing || isRecheckingVisible || sortedDomains.length === 0}
                        className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-full transition-colors disabled:opacity-50"
                    >
                        <RefreshIcon className={`w-5 h-5 ${isRecheckingVisible ? 'animate-spin' : ''}`} />
                        <span>{isRecheckingVisible ? 'Re-checking...' : 'Re-check'}</span>
                    </button>
                </Tooltip>
                {isRecheckMenuOpen && (
                    <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-700 rounded-md shadow-lg overflow-hidden z-10 ring-1 ring-black ring-opacity-5">
                        <button
                            onClick={() => runRecheck(sortedDomains, 'visible domain(s)')}
                            className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600"
                        >
                            Re-check all visible
                            <span className="block text-xs text-slate-500 dark:text-slate-400">{sortedDomains.length} domain(s)</span>
                        </button>
                        <button
                            onClick={() => runRecheck(missingDataDomains, 'domain(s) with missing data')}
                            disabled={missingDataDomains.length === 0}
                            className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-slate-600"
                        >
                            Re-check missing data
                            <span className="block text-xs text-slate-500 dark:text-slate-400">{missingDataDomains.length} domain(s)</span>
                        </button>
                    </div>
                )}
            </div>

            <Tooltip content="Open Add Domains. Ctrl + N opens the same window when the browser allows it; Alt + N is the fallback shortcut.">
                <button
                    onClick={onImportRequest}
                    disabled={isProcessing}
                    className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-full transition-colors disabled:opacity-50"
                >
                    <ArrowUpOnSquareIcon className="w-5 h-5" />
                    <span>Import / Add Bulk</span>
                </button>
            </Tooltip>

            <div className="relative" ref={exportMenuRef}>
                <Tooltip content="Export your domain list.">
                    <button
                        onClick={() => setIsExportMenuOpen(prev => !prev)}
                        disabled={isProcessing}
                        className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-full transition-colors disabled:opacity-50"
                    >
                        <ArrowDownOnSquareIcon className="w-5 h-5" />
                        <span>Export</span>
                    </button>
                </Tooltip>
                {isExportMenuOpen && (
                    <div className="absolute right-0 mt-2 w-40 bg-white dark:bg-slate-700 rounded-md shadow-lg overflow-hidden z-10 ring-1 ring-black ring-opacity-5">
                        <button onClick={() => handleExportClick('json')} className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600">
                            Export as JSON
                        </button>
                        <button onClick={() => handleExportClick('csv')} className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600">
                            Export as CSV
                        </button>
                    </div>
                )}
            </div>

            <div className="relative">
                <label htmlFor="sort-select" className="sr-only">Sort by</label>
                <select 
                    id="sort-select"
                    value={sortOption}
                    onChange={(e) => setSortOption(e.target.value as SortOption)}
                    disabled={isProcessing}
                    className="appearance-none pl-4 pr-10 py-2 text-sm font-medium bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-full transition-colors focus:ring-2 focus:ring-brand-blue focus:outline-none disabled:opacity-50"
                >
                    <option value="added-desc">Added: Newest</option>
                    <option value="added-asc">Added: Oldest</option>
                    <option value="name-asc">Name: A-Z</option>
                    <option value="name-desc">Name: Z-A</option>
                    <option value="expiry-asc">Expires: Soonest</option>
                    <option value="expiry-desc">Expires: Latest</option>
                    <option value="checked-desc">Checked: Newest</option>
                    <option value="checked-asc">Checked: Oldest</option>
                    <option value="category-asc">Category: A-Z</option>
                    <option value="category-desc">Category: Z-A</option>
                    <option value="tld-asc">TLD: A-Z</option>
                    <option value="tld-desc">TLD: Z-A</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500 dark:text-slate-400">
                    <ChevronUpDownIcon className="h-5 w-5" />
                </div>
            </div>
        </div>
      </div>

      <CategoryControls
        categories={categorization.categories}
        categoryNames={categoryNames}
        selectedCategoryId={categoryFilter}
        onSelectCategory={setCategoryFilter}
        onRenameCategory={handleRenameCategory}
      />

      <div className="mb-4 flex flex-wrap items-center justify-center gap-3">
        <Tooltip content="Registered target domains are mostly useful for their expiry date. Hide them when you want to focus on owned, client, available, expired, or failed rows.">
          <button
            type="button"
            onClick={() => setHideRegisteredTargets(current => !current)}
            disabled={isProcessing || registeredTargetCount === 0}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              hideRegisteredTargets
                ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900'
                : 'bg-slate-200 text-slate-600 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
            }`}
          >
            <TargetIcon className="h-4 w-4" />
            <span>{hideRegisteredTargets ? 'Registered targets hidden' : 'Hide registered targets'}</span>
            {registeredTargetCount > 0 && <span className="rounded-full bg-white/30 px-1.5 text-xs">{registeredTargetCount}</span>}
          </button>
        </Tooltip>

        <div className="relative">
          <label htmlFor="category-filter-select" className="sr-only">Filter by category</label>
          <select
            id="category-filter-select"
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            disabled={isProcessing || categorization.categories.length === 0}
            className="appearance-none rounded-full bg-slate-200 py-2 pl-4 pr-10 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-blue disabled:opacity-50 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
          >
            <option value="all">All categories</option>
            {categorization.categories.map(category => (
              <option key={category.id} value={category.id}>{categoryNames[category.id]}</option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500 dark:text-slate-400">
            <ChevronUpDownIcon className="h-5 w-5" />
          </div>
        </div>

        <div className="relative">
          <label htmlFor="tld-filter-select" className="sr-only">Filter by TLD</label>
          <select
            id="tld-filter-select"
            value={tldFilter}
            onChange={(event) => setTldFilter(event.target.value)}
            disabled={isProcessing || tldOptions.length === 0}
            className="appearance-none rounded-full bg-slate-200 py-2 pl-4 pr-10 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-blue disabled:opacity-50 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
          >
            <option value="all">All TLDs</option>
            {tldOptions.map(tld => (
              <option key={tld} value={tld}>{tld}</option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500 dark:text-slate-400">
            <ChevronUpDownIcon className="h-5 w-5" />
          </div>
        </div>
      </div>

      <div className={`space-y-3 transition-opacity ${isProcessing ? 'opacity-50' : 'opacity-100'}`}>
        {sortedDomains.length > 0 ? (
          categoryGroups.length > 0 ? (
            renderedCategoryGroups.map(group => (
              <section key={group.id} className={`rounded-lg border-2 p-2 shadow-sm ${group.style}`}>
                <div className="mb-2 flex flex-wrap items-center gap-2 px-1">
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{group.label}</h3>
                  <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-900/70 dark:text-slate-300">
                    {group.renderedCount === group.totalCount ? group.totalCount : `${group.renderedCount}/${group.totalCount}`}
                  </span>
                  {group.overlapLabels.length > 0 && (
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      overlaps {group.overlapLabels.slice(0, 3).join(' + ')}
                      {group.overlapLabels.length > 3 ? ` +${group.overlapLabels.length - 3}` : ''}
                    </span>
                  )}
                </div>
                <div className="space-y-2">
                  {group.domains.map(renderDomainItem)}
                </div>
              </section>
            ))
          ) : (
            renderedDomains.map(renderDomainItem)
          )
        ) : (
            <div className="text-center py-12">
                <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300">No domains match this filter</h3>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Try selecting another category.</p>
            </div>
        )}
        {hasMoreDomainsToRender && (
          <div ref={loadMoreRef} className="flex flex-col items-center gap-2 py-4">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Showing {renderedCount} of {sortedDomains.length} domains
            </p>
            <button
              type="button"
              onClick={loadMoreDomains}
              className="rounded-full bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
            >
              Load more
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default DomainList;
