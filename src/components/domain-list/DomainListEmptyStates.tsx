import React from 'react';
import { ArrowUpOnSquareIcon } from '../icons';
import Spinner from '../Spinner';

export const DomainListLoadingState: React.FC = () => (
  <div className="flex flex-col items-center justify-center py-12 text-center">
    <Spinner size="md" color="border-brand-blue" />
    <h3 className="mt-4 text-xl font-semibold text-slate-700 dark:text-slate-300">Your domains are loading</h3>
    <p className="mt-2 text-slate-500 dark:text-slate-400">Fetching your saved domain list from Supabase.</p>
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
