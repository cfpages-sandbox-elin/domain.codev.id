import React from 'react';
import { WhoisProviderStatus } from '../types';
import { RefreshIcon } from './icons';

interface WhoisProviderPanelProps {
  providers: WhoisProviderStatus[];
  isLoading: boolean;
  onRefresh: () => void;
}

const statusStyles: Record<WhoisProviderStatus['status'], string> = {
  active: 'bg-green-500',
  'missing-key': 'bg-yellow-500',
  'not-implemented': 'bg-slate-400',
  disabled: 'bg-red-500',
};

const statusLabels: Record<WhoisProviderStatus['status'], string> = {
  active: 'Active',
  'missing-key': 'Missing key',
  'not-implemented': 'Not implemented',
  disabled: 'Disabled',
};

const formatRemaining = (provider: WhoisProviderStatus) => {
  if (!provider.quota) return 'Unknown';
  const { remainingDay, limitDay, remainingMonth, limitMonth } = provider.quota;
  if (remainingDay !== null || limitDay !== null) {
    return `${remainingDay ?? '?'} / ${limitDay ?? '?'} today`;
  }
  if (remainingMonth !== null || limitMonth !== null) {
    return `${remainingMonth ?? '?'} / ${limitMonth ?? '?'} this month`;
  }
  return 'Unknown';
};

const WhoisProviderPanel: React.FC<WhoisProviderPanelProps> = ({ providers, isLoading, onRefresh }) => {
  const activeCount = providers.filter(provider => provider.status === 'active').length;
  const implementedCount = providers.filter(provider => provider.implemented).length;
  const missingCount = providers.filter(provider => provider.status === 'missing-key').length;
  const latestProvider = providers.find(provider => provider.lastResultAt);

  return (
    <section className="mb-6 border-y border-slate-200 py-4 dark:border-slate-700">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">WHOIS Providers</h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            {activeCount} active / {implementedCount} implemented / {providers.length} known
            {missingCount > 0 ? `, ${missingCount} missing key${missingCount === 1 ? '' : 's'}` : ''}
            {latestProvider ? `, last used ${latestProvider.label}` : ''}
          </p>
        </div>
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="inline-flex items-center gap-2 rounded-md bg-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-300 disabled:opacity-50 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
        >
          <RefreshIcon className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {providers.length === 0 && isLoading ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading provider configuration...</p>
      ) : providers.length === 0 ? (
        <p className="text-sm text-yellow-700 dark:text-yellow-300">
          Provider dashboard is unavailable. Deploy the `get-whois-providers` Supabase function to read server-side provider configuration.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-500 dark:text-slate-400">
              <tr>
                <th className="whitespace-nowrap py-2 pr-4 font-semibold">Provider</th>
                <th className="whitespace-nowrap py-2 pr-4 font-semibold">State</th>
                <th className="whitespace-nowrap py-2 pr-4 font-semibold">Priority</th>
                <th className="whitespace-nowrap py-2 pr-4 font-semibold">Free limit</th>
                <th className="whitespace-nowrap py-2 pr-4 font-semibold">Remaining</th>
                <th className="whitespace-nowrap py-2 pr-4 font-semibold">Keys</th>
                <th className="whitespace-nowrap py-2 font-semibold">Last issue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {providers
                .slice()
                .sort((a, b) => a.priority - b.priority)
                .map(provider => (
                  <tr key={provider.id} className="text-slate-700 dark:text-slate-300">
                    <td className="whitespace-nowrap py-2 pr-4 font-medium text-slate-900 dark:text-white">{provider.label}</td>
                    <td className="whitespace-nowrap py-2 pr-4">
                      <span className="inline-flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${statusStyles[provider.status]}`} />
                        {statusLabels[provider.status]}
                      </span>
                    </td>
                    <td className="whitespace-nowrap py-2 pr-4">{provider.priority}</td>
                    <td className="whitespace-nowrap py-2 pr-4">{provider.freeTierLabel}</td>
                    <td className="whitespace-nowrap py-2 pr-4">{formatRemaining(provider)}</td>
                    <td className="whitespace-nowrap py-2 pr-4">
                      {provider.envKeys.length > 0 ? provider.envKeys.join(', ') : 'None'}
                    </td>
                    <td className="min-w-[180px] py-2 text-xs text-slate-500 dark:text-slate-400">
                      {provider.lastErrorMessage || provider.notes}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

export default WhoisProviderPanel;
