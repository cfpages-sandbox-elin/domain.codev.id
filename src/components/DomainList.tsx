import React, { useState, useMemo, useRef, useEffect, useDeferredValue, useCallback } from 'react';
import { CategoryManualOverrides, CategoryWordGroup, Domain, WhoisData } from '../types';
import DomainItem from './DomainItem';
import { ChevronUpDownIcon, ArrowUpOnSquareIcon, ArrowDownOnSquareIcon, RefreshIcon, HomeIcon, TargetIcon, CheckCircleIcon, ExclamationTriangleIcon, XCircleIcon, DomainCodevIcon, UsersIcon, SearchIcon } from './icons';
import Spinner from './Spinner';
import Tooltip from './Tooltip';
import { applyCategoryManualOverrides, applyCategoryWordGroups, categorizeDomains } from '../utils/domainCategorization';
import DomainFilterButton from './domain-list/DomainFilterButton';
import { DomainListLoadingState, EmptyDomainListState, NoDomainMatchesState } from './domain-list/DomainListEmptyStates';
import FloatingFilterBar from './domain-list/FloatingFilterBar';
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
  getFilterMatch,
  getKeywordSuggestions,
  hasMissingData,
  readStoredBoolean,
  readStoredFilter,
  readStoredSort,
  readStoredString,
  sortDomains,
} from './domain-list/domainListLogic';

type CategoryLabel = { id: string; label: string; kind: 'word-group' | 'auto' };

interface DomainListProps {
  dateRefreshTick: number;
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
  onRemoveDomainCategory: (domainId: number, categoryId: string) => void;
  onCreateWordGroupCategory: (domain: Domain, suggestedWords: string[]) => void;
  autoRepairingDomainIds?: Set<number>;
  pendingDomainIds?: Set<number>;
  tagUpdatingDomainIds?: Set<number>;
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
const UNCATEGORIZED_CATEGORY_FILTER = '__uncategorized__';
const getCategoryKind = (categoryId: string): 'word-group' | 'auto' => (
  categoryId.startsWith('word-group:') ? 'word-group' : 'auto'
);
const getCategoryGroupStyle = (categoryId: string, index: number) => {
  if (categoryId === 'uncategorized') return 'border-slate-300 bg-slate-50/70 dark:border-slate-700 dark:bg-slate-950/40';
  if (getCategoryKind(categoryId) === 'word-group') return 'border-blue-300 bg-blue-50/75 dark:border-blue-700 dark:bg-blue-950/35';
  return CATEGORY_GROUP_STYLES[index % CATEGORY_GROUP_STYLES.length];
};

const DomainList: React.FC<DomainListProps> = ({ dateRefreshTick, domains, isLoadingDomains = false, categoryNameOverrides, categoryManualOverrides, categoryWordGroups, whoisDetailsByDomainId, onRemove, onShowInfo, onToggleTag, onSetTag, onRecheck, onRemoveDomainCategory, onCreateWordGroupCategory, autoRepairingDomainIds, pendingDomainIds, tagUpdatingDomainIds, onImportRequest, onExportRequest, isProcessing }) => {
  const now = useMemo(() => new Date(dateRefreshTick), [dateRefreshTick]);
  const [filter, setFilter] = useState<FilterType>(readStoredFilter);
  const [sortOption, setSortOption] = useState<SortOption>(readStoredSort);
  const [categoryFilter, setCategoryFilter] = useState(readStoredString(CATEGORY_FILTER_STORAGE_KEY));
  const [tldFilter, setTldFilter] = useState(readStoredString(TLD_FILTER_STORAGE_KEY));
  const [hideRegisteredTargets, setHideRegisteredTargets] = useState(() => readStoredBoolean(HIDE_REGISTERED_TARGETS_STORAGE_KEY));
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isRecheckMenuOpen, setIsRecheckMenuOpen] = useState(false);
  const [isRecheckingVisible, setIsRecheckingVisible] = useState(false);
  const [keywordFilter, setKeywordFilter] = useState('');
  const deferredKeywordFilter = useDeferredValue(keywordFilter);
  const [isKeywordSuggestionsOpen, setIsKeywordSuggestionsOpen] = useState(false);
  const [recheckProgress, setRecheckProgress] = useState<RecheckProgress | null>(null);
  const [visibleDomainLimit, setVisibleDomainLimit] = useState(INITIAL_RENDERED_DOMAINS);
  const [isDesktopLayout, setIsDesktopLayout] = useState(() => (
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 768px)').matches : true
  ));
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const recheckMenuRef = useRef<HTMLDivElement>(null);
  const keywordFilterRef = useRef<HTMLDivElement>(null);
  const floatingFilterRef = useRef<HTMLDivElement>(null);
  const listAnchorRef = useRef<HTMLDivElement>(null);
  const loadMoreSentinelRef = useRef<HTMLDivElement>(null);
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
  }, [categoryFilter, deferredKeywordFilter, filter, hideRegisteredTargets, sortOption, tldFilter]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia('(min-width: 768px)');
    const onChange = () => setIsDesktopLayout(media.matches);
    onChange();
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

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

  const quickTldCounts = useMemo(() => {
    let idCount = 0;
    let coIdCount = 0;
    let comCount = 0;
    for (const item of categorization.categorizedDomains) {
      if (item.parts.tld === '.id') idCount += 1;
      else if (item.parts.tld === '.co.id') coIdCount += 1;
      else if (item.parts.tld === '.com') comCount += 1;
    }
    return {
      all: categorization.categorizedDomains.length,
      '.id': idCount,
      '.co.id': coIdCount,
      '.com': comCount,
    };
  }, [categorization.categorizedDomains]);

  useEffect(() => {
    if (categoryFilter !== 'all' && categoryFilter !== UNCATEGORIZED_CATEGORY_FILTER && !categoriesById.has(categoryFilter)) {
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
    if (categoryFilter === UNCATEGORIZED_CATEGORY_FILTER && (meta?.categoryIds.length || 0) > 0) return false;
    if (categoryFilter !== 'all' && categoryFilter !== UNCATEGORIZED_CATEGORY_FILTER && !meta?.categoryIds.includes(categoryFilter)) return false;
    if (tldFilter !== 'all' && meta?.parts.tld !== tldFilter) return false;
    if (hideRegisteredTargets && domain.tag === 'to-snatch' && domain.status === 'registered') return false;
    return true;
  }), [categorizedDomainById, categoryFilter, domains, hideRegisteredTargets, tldFilter]);

  const normalizedKeywordFilter = deferredKeywordFilter.trim().toLowerCase();
  const keywordFilteredDomains = useMemo(
    () => applyKeywordFilter(contextFilteredDomains, normalizedKeywordFilter, categorizedDomainById, categoryNames),
    [categorizedDomainById, categoryNames, contextFilteredDomains, normalizedKeywordFilter],
  );

  const keywordSuggestions = useMemo(
    () => getKeywordSuggestions(keywordFilteredDomains, normalizedKeywordFilter),
    [keywordFilteredDomains, normalizedKeywordFilter],
  );

  const filterCounts = useMemo(() => {
    return getFilterCounts(keywordFilteredDomains, now);
  }, [keywordFilteredDomains, now]);

  useEffect(() => {
    if (filter === 'missing' && filterCounts.missing === 0) {
      setFilter('all');
    }
  }, [filter, filterCounts.missing]);

  const filteredDomains = useMemo(
    () => applyStatusFilter(keywordFilteredDomains, filter, now),
    [keywordFilteredDomains, filter, now],
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
          style: getCategoryGroupStyle(category.id, index),
          kind: getCategoryKind(category.id),
          overlapCategoryIds: Array.from(overlapCategoryIds),
          overlapLabels: Array.from(overlapCategoryIds).map(categoryId => categoryNames[categoryId] || categoryId),
        };
      })
      .filter((group): group is {
        id: string;
        label: string;
        domains: Domain[];
        style: string;
        kind: 'word-group' | 'auto';
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
        style: getCategoryGroupStyle('uncategorized', 0),
        kind: 'auto',
        overlapCategoryIds: [],
        overlapLabels: [],
      });
    }

    return orderedGroups;
  }, [categorizedDomainById, categorization.categories, categoryFilter, categoryNames, sortedDomains]);

  const categoryLabelsByDomainId = useMemo(() => {
    const map = new Map<number, CategoryLabel[]>();
    for (const item of categorization.categorizedDomains) {
      const labels = item.categoryIds.map(categoryId => ({
        id: categoryId,
        label: categoryNames[categoryId] || categoryId,
        kind: getCategoryKind(categoryId),
      }));
      map.set(item.domain.id, labels);
    }
    return map;
  }, [categorization.categorizedDomains, categoryNames]);

  const totalSorted = sortedDomains.length;
  const hasMoreDomains = visibleDomainLimit < totalSorted;

  const loadMoreDomains = useCallback(() => {
    setVisibleDomainLimit(current => Math.min(current + RENDER_INCREMENT, totalSorted));
  }, [totalSorted]);

  useEffect(() => {
    if (!hasMoreDomains || !loadMoreSentinelRef.current || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some(entry => entry.isIntersecting)) {
        loadMoreDomains();
      }
    }, { rootMargin: '1400px 0px' });
    observer.observe(loadMoreSentinelRef.current);
    return () => observer.disconnect();
  }, [hasMoreDomains, loadMoreDomains]);

  const renderedDomains = useMemo(
    () => sortedDomains.slice(0, visibleDomainLimit),
    [sortedDomains, visibleDomainLimit],
  );

  const renderedCategoryGroups = useMemo(() => {
    if (categoryGroups.length === 0) return [];
    let remaining = visibleDomainLimit;
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
  }, [categoryGroups, visibleDomainLimit]);

  const renderedCategoryBlocks = useMemo(() => {
    if (renderedCategoryGroups.length === 0) return [];

    const groupsById = new Map(renderedCategoryGroups.map(group => [group.id, group]));
    const adjacency = new Map<string, Set<string>>();

    for (const group of renderedCategoryGroups) {
      if (!adjacency.has(group.id)) adjacency.set(group.id, new Set());
      for (const relatedId of group.overlapCategoryIds) {
        if (!groupsById.has(relatedId)) continue;
        adjacency.get(group.id)!.add(relatedId);
        if (!adjacency.has(relatedId)) adjacency.set(relatedId, new Set());
        adjacency.get(relatedId)!.add(group.id);
      }
    }

    const visited = new Set<string>();
    return renderedCategoryGroups.map(group => {
      if (visited.has(group.id)) return null;

      const queue = [group.id];
      const blockGroups = [];
      visited.add(group.id);

      while (queue.length > 0) {
        const currentId = queue.shift()!;
        const currentGroup = groupsById.get(currentId);
        if (currentGroup) blockGroups.push(currentGroup);

        for (const relatedId of adjacency.get(currentId) || []) {
          if (visited.has(relatedId)) continue;
          visited.add(relatedId);
          queue.push(relatedId);
        }
      }

      const orderedBlockGroups = blockGroups.sort((a, b) => (
        renderedCategoryGroups.indexOf(a) - renderedCategoryGroups.indexOf(b)
      ));

      return {
        id: orderedBlockGroups.map(item => item.id).join('__'),
        isOverlapBlock: orderedBlockGroups.length > 1,
        groups: orderedBlockGroups,
      };
    }).filter((block): block is {
      id: string;
      isOverlapBlock: boolean;
      groups: typeof renderedCategoryGroups;
    } => Boolean(block));
  }, [renderedCategoryGroups]);

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

  const renderFilterButton = (
    filterType: FilterType,
    label: string,
    onRefresh?: () => void,
    isRefreshing?: boolean,
  ) => (
    <DomainFilterButton
      filterType={filterType}
      activeFilter={filter}
      count={filterCounts[filterType]}
      icon={filterIcons[filterType]}
      isDisabled={isProcessing}
      onSelect={setFilter}
      onRefresh={onRefresh}
      isRefreshing={isRefreshing}
      refreshTooltip={filterType === 'expired' ? `Re-check ${filterCounts.expired} expired domain(s)` : undefined}
    >
      {label}
    </DomainFilterButton>
  );


  const handleExportClick = (format: 'json' | 'csv') => {
    onExportRequest(format);
    setIsExportMenuOpen(false);
  }

  const missingDataDomains = useMemo(
    () => sortedDomains.filter(hasMissingData),
    [sortedDomains],
  );
  const expiredDomains = useMemo(
    () => domains.filter(domain => getFilterMatch(domain, 'expired', now)),
    [domains, now],
  );
  const registeredTargetCount = useMemo(
    () => domains.filter(domain => domain.tag === 'to-snatch' && domain.status === 'registered').length,
    [domains],
  );
  const uncategorizedCount = useMemo(
    () => categorization.categorizedDomains.filter(item => item.categoryIds.length === 0).length,
    [categorization.categorizedDomains],
  );

  const emptyCategoryLabels = useMemo<CategoryLabel[]>(() => [], []);

  const renderDomainItem = (domain: Domain) => {
    const meta = categorizedDomainById.get(domain.id);
    const labels = categoryLabelsByDomainId.get(domain.id) || emptyCategoryLabels;
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
        onRemoveCategory={onRemoveDomainCategory}
        onCreateWordGroupCategory={() => onCreateWordGroupCategory(
          domain,
          Array.from(new Set([
            meta?.parts.base || '',
            ...(meta?.categoryIds.map(categoryId => categoryNames[categoryId] || '') || []),
          ].filter(word => word.length >= 3))).slice(0, 3),
        )}
        isAutoRefreshing={autoRepairingDomainIds?.has(domain.id)}
        isPending={pendingDomainIds?.has(domain.id)}
        isTagUpdating={tagUpdatingDomainIds?.has(domain.id)}
        categoryLabels={labels}
        tld={meta?.parts.tld}
        isDesktopLayout={isDesktopLayout}
      />
    );
  };

  const renderCategorySection = (group: (typeof renderedCategoryGroups)[number]) => (
    <section key={group.id} className={`rounded-lg border-2 p-1.5 shadow-sm sm:p-2 ${group.style}`}>
      <div className="mb-2 flex flex-wrap items-center gap-1.5 px-1 sm:gap-2">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{group.label}</h3>
        {group.id !== 'uncategorized' && (
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
            group.kind === 'word-group'
              ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200'
              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
          }`}>
            {group.kind === 'word-group' ? 'Word group' : 'Auto'}
          </span>
        )}
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
  );

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
      <FloatingFilterBar
        filter={filter}
        filterCounts={filterCounts}
        filterIcons={filterIcons}
        isProcessing={isProcessing}
        onSelectFilter={setFilter}
        keywordFilter={keywordFilter}
        onKeywordFilterChange={setKeywordFilter}
        containerRef={floatingFilterRef}
      />
      <div className="mb-4 flex flex-col gap-3 sm:mb-6">
        <div className="order-2 -mx-3 flex items-center gap-2 overflow-x-auto px-3 pb-1 sm:order-1 sm:mx-0 sm:flex-wrap sm:justify-center sm:overflow-visible sm:px-0 sm:pb-0 sm:gap-3">
            {renderFilterButton('all', 'All')}
            {renderFilterButton('mine', 'Mine')}
            {renderFilterButton('to-snatch', 'To Snatch')}
            {renderFilterButton('others', 'Others')}
            {filterCounts.missing > 0 && renderFilterButton('missing', 'Missing Data')}
            {renderFilterButton('available', 'Available')}
            {renderFilterButton('expiring', 'Expiring Soon')}
            {renderFilterButton(
              'expired',
              'Expired',
              expiredDomains.length > 0 ? () => runRecheck(expiredDomains, 'expired domain(s)') : undefined,
              isRecheckingVisible,
            )}
        </div>
        <div className="order-1 flex flex-wrap items-center justify-center gap-2 sm:order-2">
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
            <div
              className="inline-flex items-center rounded-full bg-slate-200/90 p-1 text-xs font-semibold shadow-inner dark:bg-slate-800"
              role="group"
              aria-label="Filter domains by extension"
            >
              {[
                { id: 'all', label: 'All', count: quickTldCounts.all },
                { id: '.id', label: '.id', count: quickTldCounts['.id'] },
                { id: '.co.id', label: '.co.id', count: quickTldCounts['.co.id'] },
                { id: '.com', label: '.com', count: quickTldCounts['.com'] },
              ].map(option => {
                const isSelected = tldFilter === option.id || (option.id === 'all' && (tldFilter === 'all' || !tldFilter));
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      setTldFilter(current => (current === option.id && option.id !== 'all' ? 'all' : option.id));
                    }}
                    disabled={isProcessing || (option.id !== 'all' && option.count === 0)}
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs transition-all ${
                      isSelected
                        ? 'bg-white font-bold text-brand-blue shadow-sm dark:bg-slate-700 dark:text-blue-400'
                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                    } disabled:cursor-not-allowed disabled:opacity-40`}
                    title={option.id === 'all' ? `Show all extensions (${option.count})` : `Filter by ${option.label} (${option.count} domain${option.count === 1 ? '' : 's'})`}
                  >
                    <span>{option.label}</span>
                    {option.count > 0 && (
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                        isSelected
                          ? 'bg-blue-100 text-brand-blue dark:bg-blue-900/60 dark:text-blue-300'
                          : 'bg-slate-300/70 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
                      }`}>
                        {option.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
        </div>

        <div className="order-3 grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-center sm:gap-3">
            <div className="relative" ref={recheckMenuRef}>
                <Tooltip content="Choose what to re-check. This may use WHOIS API quota.">
                    <button
                        onClick={() => setIsRecheckMenuOpen(prev => !prev)}
                        disabled={isProcessing || isRecheckingVisible || sortedDomains.length === 0}
                        className="flex w-full items-center justify-center gap-1.5 rounded-full bg-slate-200 px-2 py-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-300 disabled:opacity-50 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600 sm:w-auto sm:gap-2 sm:px-3 sm:text-sm"
                    >
                        <RefreshIcon className={`w-5 h-5 ${isRecheckingVisible ? 'animate-spin' : ''}`} />
                        <span className="truncate">{isRecheckingVisible ? 'Checking...' : 'Re-check'}</span>
                    </button>
                </Tooltip>
                {isRecheckMenuOpen && (
                    <div className="absolute left-0 z-10 mt-2 w-64 overflow-hidden rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 dark:bg-slate-700 sm:left-auto sm:right-0">
                        <button
                            onClick={() => runRecheck(sortedDomains, 'visible domain(s)')}
                            className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600"
                        >
                            Re-check all visible
                            <span className="block text-xs text-slate-500 dark:text-slate-400">{sortedDomains.length} domain(s)</span>
                        </button>
                        <button
                            onClick={() => runRecheck(expiredDomains, 'expired domain(s)')}
                            disabled={expiredDomains.length === 0}
                            className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-slate-600"
                        >
                            Re-check expired
                            <span className="block text-xs text-slate-500 dark:text-slate-400">{expiredDomains.length} domain(s)</span>
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
                    className="flex w-full items-center justify-center gap-1.5 rounded-full bg-slate-200 px-2 py-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-300 disabled:opacity-50 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600 sm:w-auto sm:gap-2 sm:px-3 sm:text-sm"
                >
                    <ArrowUpOnSquareIcon className="w-5 h-5" />
                    <span className="truncate sm:hidden">Add</span>
                    <span className="hidden sm:inline">Import / Add Bulk</span>
                </button>
            </Tooltip>

            <div className="relative" ref={exportMenuRef}>
                <Tooltip content="Export your domain list.">
                    <button
                        onClick={() => setIsExportMenuOpen(prev => !prev)}
                        disabled={isProcessing}
                        className="flex w-full items-center justify-center gap-1.5 rounded-full bg-slate-200 px-2 py-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-300 disabled:opacity-50 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600 sm:w-auto sm:gap-2 sm:px-3 sm:text-sm"
                    >
                        <ArrowDownOnSquareIcon className="w-5 h-5" />
                        <span>Export</span>
                    </button>
                </Tooltip>
                {isExportMenuOpen && (
                    <div className="absolute right-0 z-10 mt-2 w-40 overflow-hidden rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 dark:bg-slate-700">
                        <button onClick={() => handleExportClick('json')} className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600">
                            Export as JSON
                        </button>
                        <button onClick={() => handleExportClick('csv')} className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600">
                            Export as CSV
                        </button>
                    </div>
                )}
            </div>

            <div className="relative col-span-3 sm:col-span-1">
                <label htmlFor="sort-select" className="sr-only">Sort by</label>
                <select 
                    id="sort-select"
                    value={sortOption}
                    onChange={(e) => setSortOption(e.target.value as SortOption)}
                    disabled={isProcessing}
                    className="w-full appearance-none rounded-full bg-slate-200 py-2 pl-4 pr-10 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-blue disabled:opacity-50 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600 sm:w-auto sm:text-sm"
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

      <div className="mb-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-center sm:gap-3">
        <Tooltip content="Registered target domains are mostly useful for their expiry date. Hide them when you want to focus on owned, client, available, expired, or failed rows.">
          <button
            type="button"
            onClick={() => setHideRegisteredTargets(current => !current)}
            disabled={isProcessing || registeredTargetCount === 0}
            className={`col-span-2 inline-flex items-center justify-center gap-2 rounded-full px-3 py-2 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 sm:col-span-1 sm:px-4 sm:text-sm ${
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

        <div className="relative min-w-0">
          <label htmlFor="category-filter-select" className="sr-only">Filter by category</label>
          <select
            id="category-filter-select"
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            disabled={isProcessing || (categorization.categories.length === 0 && uncategorizedCount === 0)}
            className="w-full appearance-none rounded-full bg-slate-200 py-2 pl-3 pr-9 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-blue disabled:opacity-50 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600 sm:w-auto sm:pl-4 sm:pr-10 sm:text-sm"
          >
            <option value="all">All categories</option>
            {uncategorizedCount > 0 && (
              <option value={UNCATEGORIZED_CATEGORY_FILTER}>Uncategorized ({uncategorizedCount})</option>
            )}
            {categorization.categories.some(category => category.id.startsWith('word-group:')) && (
              <optgroup label="Word groups">
                {categorization.categories
                  .filter(category => category.id.startsWith('word-group:'))
                  .map(category => (
                    <option key={category.id} value={category.id}>{categoryNames[category.id]}</option>
                  ))}
              </optgroup>
            )}
            {categorization.categories.some(category => category.id.startsWith('category:')) && (
              <optgroup label="Auto categories">
                {categorization.categories
                  .filter(category => category.id.startsWith('category:'))
                  .map(category => (
                    <option key={category.id} value={category.id}>{categoryNames[category.id]}</option>
                  ))}
              </optgroup>
            )}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500 dark:text-slate-400">
            <ChevronUpDownIcon className="h-5 w-5" />
          </div>
        </div>

        <div className="relative min-w-0">
          <label htmlFor="tld-filter-select" className="sr-only">Filter by TLD</label>
          <select
            id="tld-filter-select"
            value={tldFilter}
            onChange={(event) => setTldFilter(event.target.value)}
            disabled={isProcessing || tldOptions.length === 0}
            className="w-full appearance-none rounded-full bg-slate-200 py-2 pl-3 pr-9 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-blue disabled:opacity-50 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600 sm:w-auto sm:pl-4 sm:pr-10 sm:text-sm"
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

      {filter === 'expired' && expiredDomains.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-amber-900 shadow-sm dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200">
              <RefreshIcon className={`h-4 w-4 ${isRecheckingVisible ? 'animate-spin' : ''}`} />
            </span>
            <div>
              <p className="text-sm font-semibold">
                Expired Domains Drop Watch ({expiredDomains.length})
              </p>
              <p className="text-xs text-amber-800/80 dark:text-amber-300/80">
                Continuous daily check active. Re-check WHOIS to confirm registry release and transition to available/dropped.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => runRecheck(expiredDomains, 'expired domain(s)')}
            disabled={isProcessing || isRecheckingVisible}
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white shadow transition-colors hover:bg-amber-700 disabled:opacity-50 dark:bg-amber-700 dark:hover:bg-amber-600"
          >
            <RefreshIcon className={`h-3.5 w-3.5 ${isRecheckingVisible ? 'animate-spin' : ''}`} />
            <span>{isRecheckingVisible ? 'Re-checking...' : `Re-check Expired (${expiredDomains.length})`}</span>
          </button>
        </div>
      )}

      <div
        ref={listAnchorRef}
        className={`space-y-2 transition-opacity sm:space-y-3 ${isProcessing ? 'opacity-50' : 'opacity-100'}`}
      >
        {sortedDomains.length > 0 ? (
          <>
            {categoryGroups.length > 0 ? (
              renderedCategoryBlocks.map(block => (
                block.isOverlapBlock ? (
                  <div key={block.id} className="rounded-xl border-2 border-dashed border-brand-blue/70 bg-white/45 p-1.5 shadow-sm dark:border-blue-400/70 dark:bg-slate-900/35 sm:p-2">
                    <div className="space-y-2">
                      {block.groups.map(renderCategorySection)}
                    </div>
                  </div>
                ) : (
                  renderCategorySection(block.groups[0])
                )
              ))
            ) : (
              renderedDomains.map(renderDomainItem)
            )}
            {hasMoreDomains && (
              <div ref={loadMoreSentinelRef} className="space-y-3 py-3" role="status" aria-label="Loading more domains">
                <div className="flex items-center justify-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                  <Spinner size="sm" color="border-brand-blue" />
                  <span>
                    Loading more domains... ({Math.min(visibleDomainLimit, totalSorted)} of {totalSorted} displayed)
                  </span>
                </div>
                <div className="animate-pulse space-y-2 sm:space-y-3" aria-hidden="true">
                  {Array.from({ length: 3 }, (_, index) => (
                    <div
                      key={index}
                      className="grid min-h-16 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border-2 border-slate-200/80 bg-white/60 p-2 sm:p-2.5 dark:border-slate-800 dark:bg-slate-900/40 sm:grid-cols-[minmax(0,1.6fr)_7rem_6rem_5rem]"
                    >
                      <div className="min-w-0 space-y-2">
                        <div className={`h-4 rounded bg-slate-300 dark:bg-slate-700 ${index % 2 === 0 ? 'w-48' : 'w-36'}`} />
                        <div className="h-3 w-24 rounded bg-slate-200 dark:bg-slate-800" />
                      </div>
                      <div className="h-6 w-20 rounded-full bg-slate-200 dark:bg-slate-800 sm:w-full" />
                      <div className="hidden h-4 rounded bg-slate-200 dark:bg-slate-800 sm:block" />
                      <div className="hidden h-7 rounded-md bg-slate-200 dark:bg-slate-800 sm:block" />
                    </div>
                  ))}
                </div>
                <div className="flex justify-center pt-1">
                  <button
                    type="button"
                    onClick={loadMoreDomains}
                    className="rounded-full bg-slate-200 px-4 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 sm:text-sm"
                  >
                    Load next {Math.min(RENDER_INCREMENT, totalSorted - visibleDomainLimit)} domains
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <NoDomainMatchesState />
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
                className="h-full rounded-full bg-brand-blue transition-[width] duration-300 ease-out"
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
