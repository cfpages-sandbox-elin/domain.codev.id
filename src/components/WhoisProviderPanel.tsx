import React, { useState } from 'react';
import { WhoisProviderStatus } from '../types';
import { ChevronDownIcon, ChevronUpIcon, RefreshIcon } from './icons';
import Tooltip from './Tooltip';

interface WhoisProviderPanelProps {
  providers: WhoisProviderStatus[];
  isLoading: boolean;
  onRefresh: () => void;
  onSaveCredential: (providerId: string, apiKey: string) => Promise<boolean>;
  onRemoveCredential: (providerId: string) => Promise<boolean>;
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

const formatQuotaPair = (remaining: number | null | undefined, limit: number | null | undefined, label: string) => {
  if (remaining === null && limit === null) return 'Unknown';
  if (remaining === undefined && limit === undefined) return 'Unknown';
  return `${remaining ?? '?'} / ${limit ?? '?'} ${label}`;
};

const formatDailyQuota = (provider: WhoisProviderStatus) => {
  return formatQuotaPair(provider.quota?.remainingDay, provider.quota?.limitDay, 'today');
};

const formatMonthlyQuota = (provider: WhoisProviderStatus) => {
  return formatQuotaPair(provider.quota?.remainingMonth, provider.quota?.limitMonth, 'month');
};

const CREDENTIAL_PROVIDER_IDS = new Set(['oti-labs', 'domainduck', 'rdap-api']);

const WhoisProviderPanel: React.FC<WhoisProviderPanelProps> = ({ providers, isLoading, onRefresh, onSaveCredential, onRemoveCredential }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [apiKeysByProviderId, setApiKeysByProviderId] = useState<Record<string, string>>({});
  const [savingProviderId, setSavingProviderId] = useState<string | null>(null);
  const activeCount = providers.filter(provider => provider.status === 'active').length;
  const implementedCount = providers.filter(provider => provider.implemented).length;
  const missingCount = providers.filter(provider => provider.status === 'missing-key').length;
  const latestProvider = providers.find(provider => provider.lastResultAt);

  const saveCredential = async (providerId: string) => {
    const apiKey = apiKeysByProviderId[providerId]?.trim();
    if (!apiKey) return;
    setSavingProviderId(providerId);
    try {
      const saved = await onSaveCredential(providerId, apiKey);
      if (saved) {
        setApiKeysByProviderId(current => ({ ...current, [providerId]: '' }));
        onRefresh();
      }
    } finally {
      setSavingProviderId(null);
    }
  };

  const removeCredential = async (providerId: string) => {
    setSavingProviderId(providerId);
    try {
      const removed = await onRemoveCredential(providerId);
      if (removed) onRefresh();
    } finally {
      setSavingProviderId(null);
    }
  };

  return (
    <section className="mb-6 border-y border-slate-200 py-4 dark:border-slate-700">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setIsExpanded(current => !current)}
          className="flex min-w-0 flex-1 items-start gap-3 text-left"
          aria-expanded={isExpanded}
          aria-controls="whois-provider-details"
        >
          <span className="mt-0.5 rounded-md bg-slate-100 p-1 text-slate-500 dark:bg-slate-700 dark:text-slate-300">
            {isExpanded ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />}
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">WHOIS Providers</span>
            <span className="mt-1 block text-sm text-slate-600 dark:text-slate-300">
              {activeCount} active / {implementedCount} implemented / {providers.length} known
              {missingCount > 0 ? `, ${missingCount} missing key${missingCount === 1 ? '' : 's'}` : ''}
              {latestProvider ? `, last used ${latestProvider.label}` : ''}
            </span>
          </span>
        </button>
        <Tooltip content="Refresh server-side WHOIS provider configuration.">
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="inline-flex items-center gap-2 rounded-md bg-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-300 disabled:opacity-50 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
          >
            <RefreshIcon className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </Tooltip>
      </div>

      {isExpanded && (
        <div id="whois-provider-details" className="mt-3">
          <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
            Providers are tried in priority order. Missing keys, exhausted quotas, and temporary rate limits are skipped server-side before the app spends another request.
          </p>

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
                    <th className="whitespace-nowrap py-2 pr-4 font-semibold">Daily quota</th>
                    <th className="whitespace-nowrap py-2 pr-4 font-semibold">Monthly quota</th>
                    <th className="whitespace-nowrap py-2 pr-4 font-semibold">Live quota</th>
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
                        <td className="whitespace-nowrap py-2 pr-4">{formatDailyQuota(provider)}</td>
                        <td className="whitespace-nowrap py-2 pr-4">{formatMonthlyQuota(provider)}</td>
                        <td className="whitespace-nowrap py-2 pr-4">
                          {provider.supportsQuotaHeaders ? 'Provider headers' : provider.quota ? 'Telemetry only' : 'Not exposed'}
                        </td>
                        <td className="whitespace-nowrap py-2 pr-4">
                          {provider.envKeys.length > 0 ? provider.envKeys.join(', ') : 'None'}
                        </td>
                        <td className="min-w-[180px] py-2 text-xs text-slate-500 dark:text-slate-400">
                          {provider.lastErrorMessage || provider.notes}
                          {CREDENTIAL_PROVIDER_IDS.has(provider.id) && (
                            <div className="mt-2 flex min-w-[260px] flex-wrap items-center gap-2">
                              <input
                                type="password"
                                value={apiKeysByProviderId[provider.id] || ''}
                                onChange={(event) => setApiKeysByProviderId(current => ({ ...current, [provider.id]: event.target.value }))}
                                placeholder={provider.configured ? 'Replace saved key' : 'Paste API key'}
                                className="min-w-[160px] flex-1 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                              />
                              <button
                                type="button"
                                onClick={() => saveCredential(provider.id)}
                                disabled={savingProviderId === provider.id || !apiKeysByProviderId[provider.id]?.trim()}
                                className="rounded-md bg-brand-blue px-2.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {provider.configured ? 'Replace' : 'Save'}
                              </button>
                              {provider.configured && (
                                <button
                                  type="button"
                                  onClick={() => removeCredential(provider.id)}
                                  disabled={savingProviderId === provider.id}
                                  className="rounded-md bg-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-300 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                                >
                                  Remove
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
};

export default WhoisProviderPanel;
