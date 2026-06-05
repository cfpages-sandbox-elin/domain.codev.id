import React, { useCallback, useState, useMemo, useRef, useEffect } from 'react';
import { CategoryManualOverrides, CategoryWordGroup, Domain, WhoisData } from '../types';
import DomainItem from './DomainItem';
import { ChevronUpDownIcon, ArrowUpOnSquareIcon, ArrowDownOnSquareIcon, RefreshIcon, HomeIcon, TargetIcon, CheckCircleIcon, ExclamationTriangleIcon, XCircleIcon, DomainCodevIcon, UsersIcon, SearchIcon } from './icons';
import Tooltip from './Tooltip';
import { applyCategoryManualOverrides, applyCategoryWordGroups, categorizeDomains } from '../utils/domainCategorization';
import DomainFilterButton from './domain-list/DomainFilterButton';
import { DomainListLoadingState, EmptyDomainListState, NoDomainMatchesState } from './domain-list/DomainListEmptyStates';
import KeywordDomainFilter from './domain-list/KeywordDomainFilter';
import {
  CATEGORY_FILTER_STORAGE_KEY,
  FILTER_STORAGE_KEY,
  FilterType,
  HIDE_REGISTERED_TARGETS_STORAGE_KEY,
  INITIAL_RENDERED_DOMAINS,
  RENDER_INCREMENT,
  SORT_STORAGE_KEY,
  SortOption,
  TLD_FILTER_STORAGE_KEY,
  applyKeywordFilter,
  applyStatusFilter,
  getFilterCounts,
  getKeywordSuggestions,
  hasMissingData,
  readStoredBoolean,
  readStoredFilter,
  readStoredSort,
  readStoredString,
  sortDomains,
} from './domain-list/domainListLogic';

interface DomainListProps {
  domains: Domain[];
  isLoadingDomains?: boolean;
  categoryNameOverrides: Record<string, string>;
  categoryManualOverrides: CategoryManualOverrides;
  categoryWordGroups: CategoryWordGroup[];
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

interface RecheckProgress {
  label: string;
  total: number;
  completed: number;
  currentDomainName: string;
}

const CATEGORY_GROUP_STYLES = [
  'border-indigo-300 bg-indigo-50/70 dark:border-indigo-700 dark:bg-indigo-950/30',
  'border-teal-300 bg-teal-50/70 dark:border-teal-700 dark:bg-teal-950/30',
  'border-amber-300 bg-amber-50/70 dark:border-amber-700 dark:bg-amber-950/30',
  'border-rose-300 bg-rose-50/70 dark:border-rose-700 dark:bg-rose-950/30',
  'border-sky-300 bg-sky-50/70 dark:border-sky-700 dark:bg-sky-950/30',
  'border-violet-300 bg-violet-50/70 dark:border-violet-700 dark:bg-violet-950/30',
];

const CATEGORY_ROW_STRIPE_STYLES = [
  'bg-indigo-500 dark:bg-indigo-400',
  'bg-teal-500 dark:bg-teal-400',
  'bg-amber-500 dark:bg-amber-400',
  'bg-rose-500 dark:bg-rose-400',
  'bg-sky-500 dark:bg-sky-400',
  'bg-violet-500 dark:bg-violet-400',
];

const DomainList: React.FC<DomainListProps> = ({ domains, isLoadingDomains = false, categoryNameOverrides, categoryManualOverrides, categoryWordGroups, whoisDetailsByDomainId, onRemove, onShowInfo, onToggleTag, onSetTag, onRecheck, autoRepairingDomainIds, pendingDomainIds, onImportRequest, onExportRequest, isProcessing }) => {
  const [filter, setFilter] = useState<FilterType>(readStoredFilter);
  const [sortOption, setSortOption] = useState<SortOption>(readStoredSort);
  const [categoryFilter, setCategoryFilter] = useState(readStoredString(CATEGORY_FILTER_STORAGE_KEY));
  const [tldFilter, setTldFilter] = useState(readStoredString(TLD_FILTER_STORAGE_KEY));
  const [hideRegisteredTargets, setHideRegisteredTargets] = useState(() => readStoredBoolean(HIDE_REGISTERED_TARGETS_STORAGE_KEY));
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isRecheckMenuOpen, setIsRecheckMenuOpen] = useState(false);
  const [isRecheckingVisible, setIsRecheckingVisible] = useState(false);
  const [keywordFilter, setKeywordFilter] = useState('');
  const [isKeywordSuggestionsOpen, setIsKeywordSuggestionsOpen] = useState(false);
  const [recheckProgress, setRecheckProgress] = useState<RecheckProgress | null>(null);
  const [visibleDomainLimit, setVisibleDomainLimit] = useState(INITIAL_RENDERED_DOMAINS);
  const [isFloatingFilterVisible, setIsFloatingFilterVisible] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const recheckMenuRef = useRef<HTMLDivElement>(null);
  const keywordFilterRef = useRef<HTMLDivElement>(null);
  const floatingFilterRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const recheckProgressTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setIsExportMenuOpen(false);
      }
      if (recheckMenuRef.current && !recheckMenuRef.current.contains(event.target as Node)) {
        setIsRecheckMenuOpen(false);
      }
      if (
        keywordFilterRef.current
        && !keywordFilterRef.current.contains(event.target as Node)
        && (!floatingFilterRef.current || !floatingFilterRef.current.contains(event.target as Node))
      ) {
        setIsKeywordSuggestionsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => () => {
    if (recheckProgressTimeoutRef.current !== null) {
      window.clearTimeout(recheckProgressTimeoutRef.current);
    }
  }, []);

  useEffect(() => {
    const updateFloatingFilterVisibility = () => {
      setIsFloatingFilterVisible(window.scrollY > 220);
    };

    updateFloatingFilterVisibility();
    window.addEventListener('scroll', updateFloatingFilterVisibility, { passive: true });
    return () => window.removeEventListener('scroll', updateFloatingFilterVisibility);
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
    setVisibleDomainLimit(INITIAL_RENDERED_DOMAINS);
  }, [categoryFilter, filter, hideRegisteredTargets, keywordFilter, sortOption, tldFilter]);

  const categorization = useMemo(
    () => applyCategoryManualOverrides(
      applyCategoryWordGroups(categorizeDomains(domains), domains, categoryWordGroups),
      domains,
      categoryManualOverrides,
    ),
    [categoryManualOverrides, categoryWordGroups, domains],
  );
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
  const categoryStyleIndexById = useMemo(() => {
    return Object.fromEntries(categorization.categories.map((category, index) => [category.id, index])) as Record<string, number>;
  }, [categorization.categories]);
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

  const contextFilteredDomains = useMemo(() => domains.filter(domain => {
    const meta = categorizedDomainById.get(domain.id);
    if (categoryFilter !== 'all' && !meta?.categoryIds.includes(categoryFilter)) return false;
    if (tldFilter !== 'all' && meta?.parts.tld !== tldFilter) return false;
    if (hideRegisteredTargets && domain.tag === 'to-snatch' && domain.status === 'registered') return false;
    return true;
  }), [categorizedDomainById, categoryFilter, domains, hideRegisteredTargets, tldFilter]);

  const normalizedKeywordFilter = keywordFilter.trim().toLowerCase();
  const keywordFilteredDomains = useMemo(
    () => applyKeywordFilter(contextFilteredDomains, normalizedKeywordFilter, categorizedDomainById, categoryNames),
    [categorizedDomainById, categoryNames, contextFilteredDomains, normalizedKeywordFilter],
  );

  const keywordSuggestions = useMemo(
    () => getKeywordSuggestions(keywordFilteredDomains, normalizedKeywordFilter),
    [keywordFilteredDomains, normalizedKeywordFilter],
  );

  const filterCounts = useMemo(() => {
    return getFilterCounts(keywordFilteredDomains);
  }, [keywordFilteredDomains]);

  useEffect(() => {
    if (filter === 'missing' && filterCounts.missing === 0) {
      setFilter('all');
    }
  }, [filter, filterCounts.missing]);

  const filteredDomains = useMemo(
    () => applyStatusFilter(keywordFilteredDomains, filter),
    [keywordFilteredDomains, filter],
  );

  const sortedDomains = useMemo(() => {
    return sortDomains(filteredDomains, filter, sortOption, categorizedDomainById, categoryNames);
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
    missing: <ExclamationTriangleIcon className="h-4 w-4" />,
    available: <CheckCircleIcon className="h-4 w-4" />,
    expiring: <ExclamationTriangleIcon className="h-4 w-4" />,
    expired: <XCircleIcon className="h-4 w-4" />,
  };

  const renderFilterButton = (filterType: FilterType, label: string) => (
    <DomainFilterButton
      filterType={filterType}
      activeFilter={filter}
      count={filterCounts[filterType]}
      icon={filterIcons[filterType]}
      isDisabled={isProcessing}
      onSelect={setFilter}
    >
      {label}
    </DomainFilterButton>
  );

  const renderFloatingFilterButton = (filterType: FilterType, label: string) => (
    <Tooltip key={filterType} content={`${label}: ${filterCounts[filterType]} domain${filterCounts[filterType] === 1 ? '' : 's'}`}>
      <button
        type="button"
        onClick={() => setFilter(filterType)}
        disabled={isProcessing}
        className={`relative inline-flex h-9 w-9 flex-none items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
          filter === filterType
            ? 'bg-brand-blue text-white shadow-sm'
            : 'text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700'
        }`}
        aria-label={`Filter ${label}`}
      >
        {filterIcons[filterType]}
      </button>
    </Tooltip>
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
    const primaryCategoryId = meta?.primaryCategoryId || meta?.categoryIds[0] || null;
    const overlapCategoryIds = meta?.categoryIds.filter(categoryId => categoryId !== primaryCategoryId) || [];
    const categoryAccentClass = primaryCategoryId
      ? CATEGORY_ROW_STRIPE_STYLES[(categoryStyleIndexById[primaryCategoryId] ?? 0) % CATEGORY_ROW_STRIPE_STYLES.length]
      : undefined;
    const overlappingCategoryAccentClasses = overlapCategoryIds.map(categoryId => (
      CATEGORY_ROW_STRIPE_STYLES[(categoryStyleIndexById[categoryId] ?? 0) % CATEGORY_ROW_STRIPE_STYLES.length]
    ));
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
        categoryAccentClass={categoryAccentClass}
        overlappingCategoryAccentClasses={overlappingCategoryAccentClasses}
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
    if (recheckProgressTimeoutRef.current !== null) {
      window.clearTimeout(recheckProgressTimeoutRef.current);
      recheckProgressTimeoutRef.current = null;
    }
    setRecheckProgress({
      label,
      total: targetDomains.length,
      completed: 0,
      currentDomainName: targetDomains[0]?.domain_name || '',
    });
    try {
      for (let index = 0; index < targetDomains.length; index += 1) {
        const domain = targetDomains[index];
        setRecheckProgress({
          label,
          total: targetDomains.length,
          completed: index,
          currentDomainName: domain.domain_name,
        });
        await onRecheck(domain.id);
        setRecheckProgress({
          label,
          total: targetDomains.length,
          completed: index + 1,
          currentDomainName: domain.domain_name,
        });
      }
    } finally {
      setIsRecheckingVisible(false);
      recheckProgressTimeoutRef.current = window.setTimeout(() => {
        setRecheckProgress(null);
        recheckProgressTimeoutRef.current = null;
      }, 900);
    }
  };

  const recheckProgressPercent = recheckProgress
    ? Math.round((recheckProgress.completed / Math.max(recheckProgress.total, 1)) * 100)
    : 0;

  if (isLoadingDomains && domains.length === 0) {
    return <DomainListLoadingState />;
  }

  if (domains.length === 0 && !isProcessing) {
    return <EmptyDomainListState onImportRequest={onImportRequest} />;
  }

  return (
    <div>
      <div
        ref={floatingFilterRef}
        className={`fixed left-1/2 top-20 z-40 w-[calc(100%-1.5rem)] max-w-3xl -translate-x-1/2 transition-all duration-200 ${
          isFloatingFilterVisible
            ? 'translate-y-0 opacity-100'
            : 'pointer-events-none -translate-y-3 opacity-0'
        }`}
      >
        <div className="mx-auto flex items-center gap-1 overflow-x-auto rounded-full border border-slate-200 bg-white/95 p-1.5 shadow-xl backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
          {renderFloatingFilterButton('all', 'All')}
          {renderFloatingFilterButton('mine', 'Mine')}
          {renderFloatingFilterButton('to-snatch', 'To Snatch')}
          {renderFloatingFilterButton('others', 'Others')}
          {filterCounts.missing > 0 && renderFloatingFilterButton('missing', 'Missing Data')}
          {renderFloatingFilterButton('available', 'Available')}
          {renderFloatingFilterButton('expiring', 'Expiring Soon')}
          {renderFloatingFilterButton('expired', 'Expired')}
          <div className="relative ml-1 min-w-[10rem] flex-1">
            <label htmlFor="domain-keyword-filter-floating" className="sr-only">Filter domains by keyword</label>
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
            <input
              id="domain-keyword-filter-floating"
              type="search"
              value={keywordFilter}
              onChange={(event) => {
                setKeywordFilter(event.target.value);
                setIsKeywordSuggestionsOpen(false);
              }}
              onFocus={() => setIsKeywordSuggestionsOpen(false)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  setIsKeywordSuggestionsOpen(false);
                }
              }}
              disabled={isProcessing}
              placeholder="Keyword"
              className="h-9 w-full rounded-full bg-slate-100 py-1.5 pl-9 pr-9 text-sm font-medium text-slate-700 outline-none transition-colors placeholder:text-slate-500 focus:bg-white focus:ring-2 focus:ring-brand-blue disabled:opacity-50 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus:bg-slate-950"
            />
            {keywordFilter && (
              <button
                type="button"
                onClick={() => {
                  setKeywordFilter('');
                  setIsKeywordSuggestionsOpen(false);
                }}
                className="absolute right-1.5 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-white hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-200"
                aria-label="Clear keyword filter"
              >
                <XCircleIcon className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
      <div className="mb-6 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-center gap-3">
            {renderFilterButton('all', 'All')}
            {renderFilterButton('mine', 'Mine')}
            {renderFilterButton('to-snatch', 'To Snatch')}
            {renderFilterButton('others', 'Others')}
            {filterCounts.missing > 0 && renderFilterButton('missing', 'Missing Data')}
            {renderFilterButton('available', 'Available')}
            {renderFilterButton('expiring', 'Expiring Soon')}
            {renderFilterButton('expired', 'Expired')}
            <KeywordDomainFilter
              containerRef={keywordFilterRef}
              keyword={keywordFilter}
              suggestions={keywordSuggestions}
              categorizedDomainById={categorizedDomainById}
              isDisabled={isProcessing}
              isSuggestionsOpen={isKeywordSuggestionsOpen}
              onKeywordChange={setKeywordFilter}
              onSuggestionsOpenChange={setIsKeywordSuggestionsOpen}
            />
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
            <NoDomainMatchesState />
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

      {recheckProgress && (
        <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
          <div className="w-full max-w-xl rounded-lg border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Re-checking WHOIS data</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {recheckProgress.completed >= recheckProgress.total ? 'Finished' : `Processing ${recheckProgress.currentDomainName}`}
                </p>
              </div>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {recheckProgress.completed}/{recheckProgress.total}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
              <div
                className="h-full rounded-full bg-brand-blue transition-all"
                style={{ width: `${recheckProgressPercent}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DomainList;
