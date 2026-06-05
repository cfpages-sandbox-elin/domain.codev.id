import React from 'react';
import { Domain } from '../../types';
import { CategorizedDomain } from '../../utils/domainCategorization';
import { SearchIcon, XCircleIcon } from '../icons';

interface KeywordDomainFilterProps {
  containerRef: React.RefObject<HTMLDivElement>;
  keyword: string;
  suggestions: Domain[];
  categorizedDomainById: Map<number, CategorizedDomain>;
  isDisabled: boolean;
  isSuggestionsOpen: boolean;
  onKeywordChange: (keyword: string) => void;
  onSuggestionsOpenChange: (isOpen: boolean) => void;
}

const KeywordDomainFilter: React.FC<KeywordDomainFilterProps> = ({
  containerRef,
  keyword,
  suggestions,
  categorizedDomainById,
  isDisabled,
  isSuggestionsOpen,
  onKeywordChange,
  onSuggestionsOpenChange,
}) => (
  <div className="relative w-full max-w-md sm:w-80" ref={containerRef}>
    <label htmlFor="domain-keyword-filter" className="sr-only">Filter domains by keyword</label>
    <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
    <input
      id="domain-keyword-filter"
      type="search"
      value={keyword}
      onChange={(event) => {
        onKeywordChange(event.target.value);
        onSuggestionsOpenChange(true);
      }}
      onFocus={() => onSuggestionsOpenChange(true)}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          onSuggestionsOpenChange(false);
        }
      }}
      disabled={isDisabled}
      placeholder="Filter keyword..."
      className="h-10 w-full rounded-full bg-slate-200 py-2 pl-9 pr-10 text-sm font-medium text-slate-700 outline-none transition-colors placeholder:text-slate-500 hover:bg-slate-300 focus:bg-white focus:ring-2 focus:ring-brand-blue disabled:opacity-50 dark:bg-slate-700 dark:text-slate-100 dark:placeholder:text-slate-400 dark:hover:bg-slate-600 dark:focus:bg-slate-800"
    />
    {keyword && (
      <button
        type="button"
        onClick={() => {
          onKeywordChange('');
          onSuggestionsOpenChange(false);
        }}
        className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-white/70 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-200"
        aria-label="Clear keyword filter"
      >
        <XCircleIcon className="h-4 w-4" />
      </button>
    )}
    {isSuggestionsOpen && suggestions.length > 0 && (
      <div className="absolute left-0 right-0 z-20 mt-2 rounded-lg border border-slate-200 bg-white p-3 shadow-lg dark:border-slate-700 dark:bg-slate-900">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Existing matches</p>
        <ul className="space-y-1">
          {suggestions.map(domain => {
            const meta = categorizedDomainById.get(domain.id);
            return (
              <li key={domain.id}>
                <button
                  type="button"
                  onClick={() => {
                    onKeywordChange(domain.domain_name);
                    onSuggestionsOpenChange(false);
                  }}
                  className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <span className="min-w-0 truncate font-medium text-slate-800 dark:text-slate-100">{domain.domain_name}</span>
                  <span className="flex-none text-xs capitalize text-slate-500 dark:text-slate-400">
                    {domain.tag.replace('-', ' ')} · {meta?.parts.tld || domain.status}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    )}
  </div>
);

export default KeywordDomainFilter;
