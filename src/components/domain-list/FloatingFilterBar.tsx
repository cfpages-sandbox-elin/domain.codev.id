import React, { memo, useEffect, useRef, useState } from 'react';
import Tooltip from '../Tooltip';
import { SearchIcon, XCircleIcon } from '../icons';
import { FilterType } from './domainListLogic';

interface FloatingFilterBarProps {
  filter: FilterType;
  filterCounts: Record<FilterType, number>;
  filterIcons: Record<FilterType, React.ReactNode>;
  isProcessing: boolean;
  onSelectFilter: (filter: FilterType) => void;
  keywordFilter: string;
  onKeywordFilterChange: (keyword: string) => void;
  containerRef?: React.RefObject<HTMLDivElement>;
}

const FloatingFilterBar: React.FC<FloatingFilterBarProps> = ({
  filter,
  filterCounts,
  filterIcons,
  isProcessing,
  onSelectFilter,
  keywordFilter,
  onKeywordFilterChange,
  containerRef,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const isVisibleRef = useRef(false);

  useEffect(() => {
    const handleScroll = () => {
      const nextVisible = window.scrollY > 220;
      if (isVisibleRef.current === nextVisible) return;
      isVisibleRef.current = nextVisible;
      setIsVisible(nextVisible);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const renderFilterButton = (filterType: FilterType, label: string) => (
    <Tooltip key={filterType} content={`${label}: ${filterCounts[filterType]} domain${filterCounts[filterType] === 1 ? '' : 's'}`}>
      <button
        type="button"
        onClick={() => onSelectFilter(filterType)}
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

  return (
    <div
      ref={containerRef}
      className={`fixed bottom-4 left-1/2 z-40 w-[calc(100%-1rem)] max-w-3xl -translate-x-1/2 transition-all duration-200 md:bottom-6 ${
        isVisible
          ? 'translate-y-0 opacity-100'
          : 'pointer-events-none translate-y-3 opacity-0'
      }`}
    >
      <div className="mx-auto flex items-center gap-1 overflow-x-auto rounded-full border border-slate-200 bg-white/95 p-1 shadow-xl backdrop-blur dark:border-slate-700 dark:bg-slate-900/95 sm:p-1.5">
        {renderFilterButton('all', 'All')}
        {renderFilterButton('mine', 'Mine')}
        {renderFilterButton('to-snatch', 'To Snatch')}
        {renderFilterButton('others', 'Others')}
        {filterCounts.missing > 0 && renderFilterButton('missing', 'Missing Data')}
        {renderFilterButton('available', 'Available')}
        {renderFilterButton('expiring', 'Expiring Soon')}
        {renderFilterButton('expired', 'Expired')}
        <div className="relative ml-1 hidden min-w-[10rem] flex-1 md:block">
          <label htmlFor="domain-keyword-filter-floating" className="sr-only">Filter domains by keyword</label>
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
          <input
            id="domain-keyword-filter-floating"
            type="search"
            value={keywordFilter}
            onChange={(event) => onKeywordFilterChange(event.target.value)}
            disabled={isProcessing}
            placeholder="Keyword"
            className="h-9 w-full rounded-full bg-slate-100 py-1.5 pl-9 pr-9 text-sm font-medium text-slate-700 outline-none transition-colors placeholder:text-slate-500 focus:bg-white focus:ring-2 focus:ring-brand-blue disabled:opacity-50 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus:bg-slate-950"
          />
          {keywordFilter && (
            <button
              type="button"
              onClick={() => onKeywordFilterChange('')}
              className="absolute right-1.5 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-white hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-200"
              aria-label="Clear keyword filter"
            >
              <XCircleIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default memo(FloatingFilterBar);
