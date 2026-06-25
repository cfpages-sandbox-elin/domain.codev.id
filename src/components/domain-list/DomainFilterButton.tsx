import React from 'react';
import { FilterType } from './domainListLogic';

interface DomainFilterButtonProps {
  filterType: FilterType;
  activeFilter: FilterType;
  count: number;
  icon: React.ReactNode;
  isDisabled: boolean;
  onSelect: (filterType: FilterType) => void;
  children: React.ReactNode;
}

const DomainFilterButton: React.FC<DomainFilterButtonProps> = ({
  filterType,
  activeFilter,
  count,
  icon,
  isDisabled,
  onSelect,
  children,
}) => (
  <button
    onClick={() => onSelect(filterType)}
    disabled={isDisabled}
    className={`inline-flex flex-none items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 sm:px-4 sm:py-2 sm:text-sm ${
      activeFilter === filterType
        ? 'bg-brand-blue text-white'
        : 'bg-slate-200 text-slate-600 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
    }`}
  >
    {icon}
    {children}
    <span className={`rounded-full px-1.5 text-[11px] font-semibold ${
      activeFilter === filterType
        ? 'bg-white/25 text-white'
        : 'bg-white/70 text-slate-500 dark:bg-slate-900/60 dark:text-slate-300'
    }`}>
      {count}
    </span>
  </button>
);

export default DomainFilterButton;
