import React from 'react';
import Tooltip from '../Tooltip';
import { RefreshIcon } from '../icons';
import { FilterType } from './domainListLogic';

interface DomainFilterButtonProps {
  filterType: FilterType;
  activeFilter: FilterType;
  count: number;
  icon: React.ReactNode;
  isDisabled: boolean;
  onSelect: (filterType: FilterType) => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  refreshTooltip?: string;
  children: React.ReactNode;
}

const DomainFilterButton: React.FC<DomainFilterButtonProps> = ({
  filterType,
  activeFilter,
  count,
  icon,
  isDisabled,
  onSelect,
  onRefresh,
  isRefreshing = false,
  refreshTooltip = 'Re-check domains',
  children,
}) => {
  const isActive = activeFilter === filterType;

  if (onRefresh) {
    return (
      <div
        className={`inline-flex flex-none items-stretch rounded-full transition-colors ${
          isActive
            ? 'bg-brand-blue text-white shadow-sm'
            : 'bg-slate-200 text-slate-600 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
        }`}
      >
        <button
          type="button"
          onClick={() => onSelect(filterType)}
          disabled={isDisabled}
          className="inline-flex items-center gap-1.5 py-1.5 pl-3 pr-2 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50 sm:py-2 sm:pl-4 sm:pr-2.5 sm:text-sm"
        >
          {icon}
          {children}
          <span
            className={`rounded-full px-1.5 text-[11px] font-semibold ${
              isActive
                ? 'bg-white/25 text-white'
                : 'bg-white/70 text-slate-500 dark:bg-slate-900/60 dark:text-slate-300'
            }`}
          >
            {count}
          </span>
        </button>
        <Tooltip content={refreshTooltip} size="sm">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRefresh();
            }}
            disabled={isDisabled || isRefreshing}
            aria-label={refreshTooltip}
            className={`inline-flex items-center justify-center rounded-r-full border-l px-2 transition-colors disabled:cursor-wait disabled:opacity-50 sm:px-2.5 ${
              isActive
                ? 'border-white/20 hover:bg-white/20 text-white'
                : 'border-slate-300/80 hover:bg-slate-300/80 text-slate-600 dark:border-slate-600/80 dark:hover:bg-slate-600/80 dark:text-slate-300'
            }`}
          >
            <RefreshIcon className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </Tooltip>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onSelect(filterType)}
      disabled={isDisabled}
      className={`inline-flex flex-none items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 sm:px-4 sm:py-2 sm:text-sm ${
        isActive
          ? 'bg-brand-blue text-white'
          : 'bg-slate-200 text-slate-600 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
      }`}
    >
      {icon}
      {children}
      <span
        className={`rounded-full px-1.5 text-[11px] font-semibold ${
          isActive
            ? 'bg-white/25 text-white'
            : 'bg-white/70 text-slate-500 dark:bg-slate-900/60 dark:text-slate-300'
        }`}
      >
        {count}
      </span>
    </button>
  );
};

export default DomainFilterButton;
