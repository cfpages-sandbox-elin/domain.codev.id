import React from 'react';
import { ArrowUpOnSquareIcon } from '../icons';

export const DomainListLoadingState: React.FC = () => (
  <div className="animate-pulse space-y-3" role="status" aria-label="Loading saved domains">
    <span className="sr-only">Loading saved domains from Supabase.</span>
    <div className="mx-auto mb-5 h-9 w-full max-w-md rounded-full bg-slate-200 dark:bg-slate-800" />
    {Array.from({ length: 6 }, (_, index) => (
      <div
        key={index}
        className="grid min-h-20 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/60 sm:min-h-16 sm:grid-cols-[minmax(0,1.6fr)_7rem_6rem_5rem]"
      >
        <div className="min-w-0 space-y-2">
          <div className={`h-4 rounded bg-slate-300 dark:bg-slate-700 ${index % 3 === 0 ? 'w-2/3' : index % 3 === 1 ? 'w-1/2' : 'w-3/4'}`} />
          <div className="h-3 w-28 rounded bg-slate-200 dark:bg-slate-800" />
        </div>
        <div className="h-7 w-20 rounded-full bg-slate-200 dark:bg-slate-800 sm:w-full" />
        <div className="hidden h-4 rounded bg-slate-200 dark:bg-slate-800 sm:block" />
        <div className="hidden h-8 rounded-md bg-slate-200 dark:bg-slate-800 sm:block" />
      </div>
    ))}
  </div>
);

export const EmptyDomainListState: React.FC<{ onImportRequest: () => void }> = ({ onImportRequest }) => (
  <div className="py-12 text-center">
    <h3 className="text-xl font-semibold text-slate-700 dark:text-slate-300">Your list is empty</h3>
    <p className="mt-2 text-slate-500 dark:text-slate-400">Add a domain or import a list to start tracking!</p>
    <button
      onClick={onImportRequest}
      className="mt-6 inline-flex items-center gap-2 rounded-lg bg-brand-blue px-4 py-2 font-semibold text-white transition-colors hover:bg-blue-600"
    >
      <ArrowUpOnSquareIcon className="h-5 w-5" />
      Import / Add Bulk
    </button>
  </div>
);

export const NoDomainMatchesState: React.FC = () => (
  <div className="py-12 text-center">
    <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300">No domains match this filter</h3>
    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Try another keyword, category, TLD, or status filter.</p>
  </div>
);
