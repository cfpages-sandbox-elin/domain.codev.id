

import React, { useState } from 'react';
import { Domain } from '../types';
import DomainItem from './DomainItem';

interface DomainListProps {
  domains: Domain[];
  onRemove: (id: number) => void;
  onShowInfo: (domain: Domain) => void;
  onToggleTag: (id: number) => void;
}

type FilterType = 'all' | 'mine' | 'to-snatch' | 'expiring' | 'expired';

const DomainList: React.FC<DomainListProps> = ({ domains, onRemove, onShowInfo, onToggleTag }) => {
  const [filter, setFilter] = useState<FilterType>('all');

  const filteredDomains = domains.filter(domain => {
    switch (filter) {
      case 'mine':
        return domain.tag === 'mine';
      case 'to-snatch':
        return domain.tag === 'to-snatch';
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
  });

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
            <p className="mt-2 text-slate-500 dark:text-slate-400">Add a domain above to start tracking!</p>
        </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap gap-2">
        <FilterButton filterType="all">All</FilterButton>
        <FilterButton filterType="mine">Mine</FilterButton>
        <FilterButton filterType="to-snatch">To Snatch</FilterButton>
        <FilterButton filterType="expiring">Expiring Soon</FilterButton>
        <FilterButton filterType="expired">Expired</FilterButton>
      </div>

      <div className="space-y-4">
        {filteredDomains.length > 0 ? (
          filteredDomains.map(domain => (
            <DomainItem key={domain.id} domain={domain} onRemove={onRemove} onShowInfo={onShowInfo} onToggleTag={onToggleTag}/>
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