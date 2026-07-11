import { useState } from 'react';
import type { SerpProviderStatus } from '../types';
import Spinner from './Spinner';
import { ExternalLinkIcon, RefreshIcon } from './icons';

type SerpProviderPanelProps = {
  providers: SerpProviderStatus[];
  isLoading: boolean;
  onRefresh: () => void;
  onSaveCredential: (providerId: string, apiKey: string) => Promise<boolean>;
  onRemoveCredential: (providerId: string) => Promise<boolean>;
  defaultExpanded?: boolean;
};

const statusClass = (status: SerpProviderStatus['status']) => {
  if (status === 'active') return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200';
  if (status === 'blocked') return 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200';
  return 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
};

const SerpProviderPanel = ({
  providers,
  isLoading,
  onRefresh,
  onSaveCredential,
  onRemoveCredential,
  defaultExpanded = false,
}: SerpProviderPanelProps) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [draftKeys, setDraftKeys] = useState<Record<string, string>>({});
  const [busyProviderId, setBusyProviderId] = useState<string | null>(null);

  const configuredCount = providers.filter(provider => provider.configured).length;
  const activeCount = providers.filter(provider => provider.status === 'active').length;

  const handleSave = async (providerId: string) => {
    const apiKey = (draftKeys[providerId] || '').trim();
    if (!apiKey) return;
    setBusyProviderId(providerId);
    try {
      const ok = await onSaveCredential(providerId, apiKey);
      if (ok) {
        setDraftKeys(current => ({ ...current, [providerId]: '' }));
        onRefresh();
      }
    } finally {
      setBusyProviderId(null);
    }
  };

  const handleRemove = async (providerId: string) => {
    setBusyProviderId(providerId);
    try {
      const ok = await onRemoveCredential(providerId);
      if (ok) onRefresh();
    } finally {
      setBusyProviderId(null);
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
        <div>
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">SERP Providers</h3>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Paste free-tier API keys. Checks rotate providers and skip exhausted free limits.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {activeCount} active · {configuredCount} keyed
          </span>
          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 rounded-md bg-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-300 disabled:opacity-50 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
          >
            {isLoading ? <Spinner size="sm" color="border-brand-blue" /> : <RefreshIcon className="h-4 w-4" />}
            Refresh
          </button>
          <button
            type="button"
            onClick={() => setIsExpanded(current => !current)}
            className="rounded-md bg-brand-blue px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-600"
          >
            {isExpanded ? 'Collapse' : 'Expand'}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="space-y-3 p-4">
          {providers.length === 0 && !isLoading && (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              No provider status loaded. Deploy `get-serp-providers` and apply the rank-tracking migration.
            </p>
          )}
          {providers.map(provider => (
            <article
              key={provider.id}
              className="rounded-lg border border-slate-200 p-3 dark:border-slate-700"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{provider.label}</h4>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${statusClass(provider.status)}`}>
                      {provider.status}
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      priority {provider.priority}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{provider.notes}</p>
                  <p className="mt-1 text-xs font-medium text-brand-blue">{provider.freeTierLabel}</p>
                  {typeof provider.estimatedMonthUsed === 'number' && (
                    <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                      Est. used this month: {provider.estimatedMonthUsed}
                      {provider.monthlyFreeEstimate ? ` / ~${provider.monthlyFreeEstimate}` : ''}
                    </p>
                  )}
                  {provider.lastErrorMessage && (
                    <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-300">{provider.lastErrorMessage}</p>
                  )}
                </div>
                <a
                  href={provider.signupUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-brand-blue hover:underline"
                >
                  Get key <ExternalLinkIcon className="h-3.5 w-3.5" />
                </a>
              </div>

              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  type="password"
                  value={draftKeys[provider.id] || ''}
                  onChange={(event) => setDraftKeys(current => ({ ...current, [provider.id]: event.target.value }))}
                  placeholder={provider.configured ? 'Replace API key (write-only)' : 'Paste API key'}
                  className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
                  autoComplete="off"
                />
                <button
                  type="button"
                  disabled={busyProviderId === provider.id || !(draftKeys[provider.id] || '').trim()}
                  onClick={() => void handleSave(provider.id)}
                  className="rounded-md bg-brand-blue px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-600 disabled:opacity-50"
                >
                  Save
                </button>
                {provider.configured && (
                  <button
                    type="button"
                    disabled={busyProviderId === provider.id}
                    onClick={() => void handleRemove(provider.id)}
                    className="rounded-md bg-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-300 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    Remove
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
};

export default SerpProviderPanel;
