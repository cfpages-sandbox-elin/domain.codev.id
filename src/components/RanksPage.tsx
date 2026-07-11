import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { Domain, RankDevice, RankKeywordWithLinks } from '../types';
import {
  createRankKeyword,
  deleteRankKeyword,
  listRankKeywords,
  runRankCheck,
  setRankKeywordEnabled,
  updateRankKeywordDomains,
} from '../services/rankService';
import Spinner from './Spinner';
import { PlusIcon, RefreshIcon, TrashIcon } from './icons';

type RanksPageProps = {
  domains: Domain[];
  addLog: (message: string) => void;
};

const formatPosition = (position: number | null | undefined, found?: boolean) => {
  if (found === false || position == null) return '—';
  if (position > 100) return '100+';
  return String(position);
};

const RanksPage: React.FC<RanksPageProps> = ({ domains, addLog }) => {
  const [keywords, setKeywords] = useState<RankKeywordWithLinks[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [keywordInput, setKeywordInput] = useState('');
  const [locale, setLocale] = useState('id');
  const [device, setDevice] = useState<RankDevice>('desktop');
  const [selectedDomainIds, setSelectedDomainIds] = useState<number[]>([]);
  const [domainSearch, setDomainSearch] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const mineAndOthers = useMemo(
    () => domains.filter(domain => domain.tag === 'mine' || domain.tag === 'others'),
    [domains],
  );

  const filteredDomains = useMemo(() => {
    const q = domainSearch.trim().toLowerCase();
    if (!q) return mineAndOthers;
    return mineAndOthers.filter(domain => domain.domain_name.toLowerCase().includes(q));
  }, [domainSearch, mineAndOthers]);

  const domainsById = useMemo(() => new Map(domains.map(domain => [domain.id, domain])), [domains]);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const rows = await listRankKeywords();
      setKeywords(rows);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      addLog(`❌ Rank keywords: ${message}`);
    } finally {
      setIsLoading(false);
    }
  }, [addLog]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const toggleDomain = (domainId: number) => {
    setSelectedDomainIds(current => (
      current.includes(domainId)
        ? current.filter(id => id !== domainId)
        : [...current, domainId]
    ));
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!keywordInput.trim() || selectedDomainIds.length === 0) return;
    setIsSaving(true);
    setError(null);
    try {
      await createRankKeyword({
        keyword: keywordInput,
        locale,
        device,
        domainIds: selectedDomainIds,
      });
      addLog(`✅ Rank keyword saved: ${keywordInput.trim()}`);
      setKeywordInput('');
      setSelectedDomainIds([]);
      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      addLog(`❌ Could not save keyword: ${message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCheck = async (keywordId: string) => {
    setCheckingId(keywordId);
    setError(null);
    try {
      const result = await runRankCheck(keywordId);
      if (!result.ok) {
        throw new Error(result.error || 'Rank check failed');
      }
      addLog(`✅ SERP check done via ${result.provider || 'provider'} (${result.organicCount ?? 0} results).`);
      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      addLog(`❌ Rank check failed: ${message}`);
    } finally {
      setCheckingId(null);
    }
  };

  const handleSaveDomains = async (keywordId: string) => {
    setIsSaving(true);
    try {
      await updateRankKeywordDomains(keywordId, selectedDomainIds);
      addLog('✅ Updated domains linked to keyword.');
      setEditingId(null);
      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const startEdit = (row: RankKeywordWithLinks) => {
    setEditingId(row.id);
    setSelectedDomainIds(row.domainIds);
    setKeywordInput(row.keyword);
    setLocale(row.locale);
    setDevice(row.device);
  };

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-4 sm:mb-6">
        <h2 className="text-xl font-bold text-slate-800 dark:text-white sm:text-2xl">Rank Tracking</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Attach one keyword to multiple sites, run a single SERP check, and read every domain position from the same snapshot.
          Add free-tier API keys under Settings → SERP Providers.
        </p>
      </div>

      <form
        onSubmit={handleCreate}
        className="mb-6 space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-5"
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Keyword</span>
            <input
              value={keywordInput}
              onChange={(event) => setKeywordInput(event.target.value)}
              placeholder="e.g. filtrasi air"
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
              required
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Locale</span>
            <input
              value={locale}
              onChange={(event) => setLocale(event.target.value)}
              placeholder="id"
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
            />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
            <span className="text-xs font-semibold uppercase text-slate-500">Device</span>
            <select
              value={device}
              onChange={(event) => setDevice(event.target.value as RankDevice)}
              className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800"
            >
              <option value="desktop">Desktop</option>
              <option value="mobile">Mobile</option>
            </select>
          </label>
          <input
            value={domainSearch}
            onChange={(event) => setDomainSearch(event.target.value)}
            placeholder="Filter domains…"
            className="min-w-[12rem] flex-1 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800"
          />
        </div>

        <div className="max-h-48 overflow-y-auto rounded-md border border-slate-200 dark:border-slate-700">
          {filteredDomains.length === 0 ? (
            <p className="p-3 text-sm text-slate-500">No mine/others domains match.</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredDomains.map(domain => (
                <li key={domain.id}>
                  <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800/70">
                    <input
                      type="checkbox"
                      checked={selectedDomainIds.includes(domain.id)}
                      onChange={() => toggleDomain(domain.id)}
                    />
                    <span className="min-w-0 flex-1 break-all font-medium text-slate-800 dark:text-slate-100">
                      {domain.domain_name}
                    </span>
                    <span className="text-[10px] font-semibold uppercase text-slate-400">{domain.tag}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={isSaving || !keywordInput.trim() || selectedDomainIds.length === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-600 disabled:opacity-50"
          >
            {isSaving ? <Spinner size="sm" color="border-white" /> : <PlusIcon className="h-4 w-4" />}
            {editingId ? 'Create as new keyword' : 'Save keyword + domains'}
          </button>
          {editingId && (
            <button
              type="button"
              disabled={isSaving}
              onClick={() => void handleSaveDomains(editingId)}
              className="rounded-lg bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-300 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-200"
            >
              Update domains on selected keyword
            </button>
          )}
          <button
            type="button"
            onClick={() => void refresh()}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-200"
          >
            <RefreshIcon className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </form>

      {error && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Spinner size="lg" color="border-brand-blue" />
          </div>
        ) : keywords.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
            No keywords yet. Create one and attach multiple domains above.
          </div>
        ) : (
          keywords.map(row => (
            <article
              key={row.id}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-white">{row.keyword}</h3>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Google · {row.locale} · {row.device}
                    {row.last_checked_at ? ` · last check ${new Date(row.last_checked_at).toLocaleString()}` : ' · never checked'}
                    {row.enabled ? '' : ' · paused'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => startEdit(row)}
                    className="rounded-md bg-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-200"
                  >
                    Edit domains
                  </button>
                  <button
                    type="button"
                    disabled={checkingId === row.id}
                    onClick={() => void handleCheck(row.id)}
                    className="inline-flex items-center gap-1.5 rounded-md bg-brand-blue px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-600 disabled:opacity-50"
                  >
                    {checkingId === row.id ? <Spinner size="sm" color="border-white" /> : <RefreshIcon className="h-3.5 w-3.5" />}
                    Check now
                  </button>
                  <button
                    type="button"
                    onClick={() => void setRankKeywordEnabled(row.id, !row.enabled).then(refresh)}
                    className="rounded-md bg-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-200"
                  >
                    {row.enabled ? 'Pause' : 'Enable'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteRankKeyword(row.id).then(refresh)}
                    className="inline-flex items-center gap-1 rounded-md p-1.5 text-red-500 transition-colors hover:bg-red-100 dark:hover:bg-red-950"
                    aria-label={`Delete keyword ${row.keyword}`}
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-700">
                      <th className="py-2 pr-4 font-semibold">Domain</th>
                      <th className="py-2 pr-4 font-semibold">Position</th>
                      <th className="py-2 font-semibold">URL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {row.domainIds.map(domainId => {
                      const domain = domainsById.get(domainId);
                      const latest = row.latestPositions.find(item => item.domain_id === domainId);
                      return (
                        <tr key={domainId} className="border-b border-slate-100 dark:border-slate-800">
                          <td className="py-2 pr-4 font-medium text-slate-800 dark:text-slate-100">
                            {domain?.domain_name || `#${domainId}`}
                          </td>
                          <td className="py-2 pr-4 font-semibold text-brand-blue">
                            {formatPosition(latest?.position, latest?.found)}
                          </td>
                          <td className="max-w-xs truncate py-2 text-xs text-slate-500">
                            {latest?.rank_url ? (
                              <a href={latest.rank_url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                                {latest.rank_url}
                              </a>
                            ) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
};

export default RanksPage;
