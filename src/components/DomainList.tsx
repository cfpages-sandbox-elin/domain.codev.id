import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Domain, WhoisData } from '../types';
import DomainItem from './DomainItem';
import { ChevronUpDownIcon, ArrowUpOnSquareIcon, ArrowDownOnSquareIcon, RefreshIcon, HomeIcon, TargetIcon, CheckCircleIcon, ExclamationTriangleIcon, XCircleIcon, DomainCodevIcon } from './icons';
import Tooltip from './Tooltip';

interface DomainListProps {
  domains: Domain[];
  whoisDetailsByDomainId: Record<number, WhoisData>;
  onRemove: (id: number) => void;
  onShowInfo: (domain: Domain) => void;
  onToggleTag: (id: number) => void;
  onRecheck: (id: number) => Promise<void>;
  onImportRequest: () => void;
  onExportRequest: (format: 'json' | 'csv') => void;
  isProcessing: boolean;
}

type FilterType = 'all' | 'mine' | 'to-snatch' | 'expiring' | 'expired' | 'available';
type SortOption = 'added-desc' | 'added-asc' | 'name-asc' | 'name-desc' | 'expiry-asc' | 'expiry-desc' | 'checked-desc' | 'checked-asc';

const DomainList: React.FC<DomainListProps> = ({ domains, whoisDetailsByDomainId, onRemove, onShowInfo, onToggleTag, onRecheck, onImportRequest, onExportRequest, isProcessing }) => {
  const [filter, setFilter] = useState<FilterType>('all');
  const [sortOption, setSortOption] = useState<SortOption>('added-desc');
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isRecheckingVisible, setIsRecheckingVisible] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setIsExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredDomains = useMemo(() => domains.filter(domain => {
    switch (filter) {
      case 'mine':
        return domain.tag === 'mine' && domain.status !== 'available' && domain.status !== 'dropped';
      case 'to-snatch':
        return domain.tag === 'to-snatch' || domain.status === 'available' || domain.status === 'dropped';
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
  }), [domains, filter]);

  const sortedDomains = useMemo(() => {
    const sortable = [...filteredDomains];
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
            case 'added-desc':
            default:
                return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
    });
    return sortable;
  }, [filteredDomains, sortOption]);

  const filterIcons: Record<FilterType, React.ReactNode> = {
    all: <DomainCodevIcon className="h-4 w-4" />,
    mine: <HomeIcon className="h-4 w-4" />,
    'to-snatch': <TargetIcon className="h-4 w-4" />,
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
      </button>
  );

  const handleExportClick = (format: 'json' | 'csv') => {
    onExportRequest(format);
    setIsExportMenuOpen(false);
  }

  const handleRecheckVisible = async () => {
    if (isRecheckingVisible || sortedDomains.length === 0) return;
    const confirmed = window.confirm(`Re-check ${sortedDomains.length} visible domain(s)? This may use WHOIS API quota.`);
    if (!confirmed) return;

    setIsRecheckingVisible(true);
    try {
      for (const domain of sortedDomains) {
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
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap items-center gap-3">
            <FilterButton filterType="all">All</FilterButton>
            <FilterButton filterType="mine">Mine</FilterButton>
            <FilterButton filterType="to-snatch">To Snatch</FilterButton>
            <FilterButton filterType="available">Available</FilterButton>
            <FilterButton filterType="expiring">Expiring Soon</FilterButton>
            <FilterButton filterType="expired">Expired</FilterButton>
        </div>
        
        <div className="flex-grow"></div>

        <div className="flex flex-wrap items-center gap-3">
            <Tooltip content="Re-check all domains in the current filter. This may use WHOIS API quota.">
                <button
                    onClick={handleRecheckVisible}
                    disabled={isProcessing || isRecheckingVisible || sortedDomains.length === 0}
                    className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-full transition-colors disabled:opacity-50"
                >
                    <RefreshIcon className={`w-5 h-5 ${isRecheckingVisible ? 'animate-spin' : ''}`} />
                    <span>{isRecheckingVisible ? 'Re-checking...' : 'Re-check Visible'}</span>
                </button>
            </Tooltip>

            <Tooltip content="Import or add a list of domains.">
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
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500 dark:text-slate-400">
                    <ChevronUpDownIcon className="h-5 w-5" />
                </div>
            </div>
        </div>
      </div>

      <div className={`space-y-2 transition-opacity ${isProcessing ? 'opacity-50' : 'opacity-100'}`}>
        {sortedDomains.length > 0 ? (
          sortedDomains.map(domain => (
            <DomainItem
              key={domain.id}
              domain={domain}
              whoisDetails={whoisDetailsByDomainId[domain.id]}
              onRemove={onRemove}
              onShowInfo={onShowInfo}
              onToggleTag={onToggleTag}
              onRecheck={onRecheck}
            />
          ))
        ) : (
            <div className="text-center py-12">
                <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300">No domains match this filter</h3>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Try selecting another category.</p>
            </div>
        )}
      </div>
    </div>
  );
};

export default DomainList;
