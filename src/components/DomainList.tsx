import React, { useState, useMemo } from 'react';
import { Domain } from '../types';
import DomainItem from './DomainItem';
import { ChevronUpDownIcon } from './icons';

interface DomainListProps {
  domains: Domain[];
  onRemove: (id: number) => void;
  onShowInfo: (domain: Domain) => void;
  onToggleTag: (id: number) => void;
  onRecheck: (id: number) => Promise<void>;
}

type FilterType = 'all' | 'mine' | 'to-snatch' | 'expiring' | 'expired' | 'available';
type SortOption = 'added-desc' | 'added-asc' | 'name-asc' | 'name-desc' | 'expiry-asc' | 'expiry-desc' | 'checked-desc' | 'checked-asc';

const DomainList: React.FC<DomainListProps> = ({ domains, onRemove, onShowInfo, onToggleTag, onRecheck }) => {
  const [filter, setFilter] = useState<FilterType>('all');
  const [sortOption, setSortOption] = useState<SortOption>('added-desc');

  const filteredDomains = useMemo(() => domains.filter(domain => {
    switch (filter) {
      case 'mine':
        return domain.tag === 'mine';
      case 'to-snatch':
        return domain.tag === 'to-snatch';
      case 'available':
        return domain.status === 'available' || domain.status === 'dropped';
      case 'expiring':
        if (!domain.expiration_date) return false;
        const daysLeft = (new Date(domain.expiration_date).getTime() - Date.now()) / (1000 * 3600 * 24);
        return daysLeft > 0 && daysLeft <= 7;
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

  const FilterButton: React.FC<{ filterType: FilterType, children: React.ReactNode }> = ({ filterType, children }) => (
     <button
        onClick={() => setFilter(filterType)}
        className={`px-4 py-2 text-sm font-medium rounded-full transition-colors ${
          filter === filterType 
            ? 'bg-brand-blue text-white' 
            : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'
        }`}
      >
        {children}
      </button>
  );


  if (domains.length === 0) {
    return (
        <div className="text-center py-12">
            <h3 className="text-xl font-semibold text-slate-700 dark:text-slate-300">Your list is empty</h3>
            <p className="mt-2 text-slate-500 dark:text-slate-400">Add a domain to start tracking!</p>
        </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <FilterButton filterType="all">All</FilterButton>
        <FilterButton filterType="mine">Mine</FilterButton>
        <FilterButton filterType="to-snatch">To Snatch</FilterButton>
        <FilterButton filterType="available">Available</FilterButton>
        <FilterButton filterType="expiring">Expiring Soon</FilterButton>
        <FilterButton filterType="expired">Expired</FilterButton>
        
        <div className="relative ml-auto">
            <label htmlFor="sort-select" className="sr-only">Sort by</label>
            <select 
                id="sort-select"
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value as SortOption)}
                className="appearance-none pl-4 pr-10 py-2 text-sm font-medium bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-full transition-colors focus:ring-2 focus:ring-brand-blue focus:outline-none"
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

      <div className="space-y-2">
        {sortedDomains.length > 0 ? (
          sortedDomains.map(domain => (
            <DomainItem key={domain.id} domain={domain} onRemove={onRemove} onShowInfo={onShowInfo} onToggleTag={onToggleTag} onRecheck={onRecheck}/>
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