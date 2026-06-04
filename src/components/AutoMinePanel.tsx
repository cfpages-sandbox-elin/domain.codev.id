import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Domain } from '../types';
import { ChevronDownIcon, ChevronUpIcon, HomeIcon, PlusIcon, TrashIcon } from './icons';
import Tooltip from './Tooltip';

export interface AutoMineRule {
  id: string;
  label: string;
  nameServers: string[];
  enabled: boolean;
}

interface AutoMinePanelProps {
  domains: Domain[];
  onApplyMatches: (domainIds: number[], reason: string) => Promise<void>;
  addLog: (message: string) => void;
}

const STORAGE_KEY = 'domain-codev-auto-mine-rules';

const normalizeNameServer = (value: string) => value
  .trim()
  .toLowerCase()
  .replace(/^https?:\/\//, '')
  .replace(/\/.*$/, '')
  .replace(/\.$/, '');

const splitNameServers = (value: string) => value
  .split(/[\s,;]+/)
  .map(normalizeNameServer)
  .filter(Boolean);

const readStoredRules = (): AutoMineRule[] => {
  if (typeof window === 'undefined') return [];
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(item => ({
        id: typeof item.id === 'string' ? item.id : crypto.randomUUID(),
        label: typeof item.label === 'string' && item.label.trim() ? item.label.trim() : 'Name server rule',
        nameServers: Array.isArray(item.nameServers)
          ? Array.from(new Set<string>(item.nameServers.map(String).map(normalizeNameServer).filter(Boolean)))
          : [],
        enabled: item.enabled !== false,
      }))
      .filter(item => item.nameServers.length >= 2);
  } catch {
    return [];
  }
};

const getRuleLabel = (nameServers: string[]) => nameServers
  .slice(0, 2)
  .map(server => server.split('.')[0] || server)
  .join(' + ') || 'Name server rule';

const findRuleMatches = (domains: Domain[], rules: AutoMineRule[]) => {
  const enabledRules = rules.filter(rule => rule.enabled && rule.nameServers.length >= 2);
  const matches = new Map<number, string[]>();

  for (const domain of domains) {
    if (domain.tag === 'mine') continue;
    if (domain.status === 'available' || domain.status === 'dropped') continue;
    const domainNameServers = new Set((domain.name_servers || []).map(normalizeNameServer).filter(Boolean));
    if (domainNameServers.size < 2) continue;

    for (const rule of enabledRules) {
      const isMatch = rule.nameServers.every(server => domainNameServers.has(server));
      if (!isMatch) continue;
      matches.set(domain.id, [...(matches.get(domain.id) || []), rule.label]);
    }
  }

  return matches;
};

const AutoMinePanel: React.FC<AutoMinePanelProps> = ({ domains, onApplyMatches, addLog }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [rules, setRules] = useState<AutoMineRule[]>(readStoredRules);
  const [label, setLabel] = useState('');
  const [nameServerInput, setNameServerInput] = useState('');
  const [isApplying, setIsApplying] = useState(false);
  const lastAutoApplyKeyRef = useRef('');

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
  }, [rules]);

  const matchesByDomainId = useMemo(() => findRuleMatches(domains, rules), [domains, rules]);
  const matchedDomainIds = useMemo(() => Array.from(matchesByDomainId.keys()), [matchesByDomainId]);
  const matchedDomains = useMemo(
    () => domains.filter(domain => matchesByDomainId.has(domain.id)),
    [domains, matchesByDomainId],
  );

  const applyMatches = async (mode: 'auto' | 'manual') => {
    if (isApplying || matchedDomainIds.length === 0) return;
    setIsApplying(true);
    try {
      await onApplyMatches(matchedDomainIds, mode === 'auto' ? 'Auto Mine name-server rule' : 'Manual Auto Mine apply');
    } finally {
      setIsApplying(false);
    }
  };

  useEffect(() => {
    if (matchedDomainIds.length === 0 || isApplying) return;
    const key = matchedDomainIds.slice().sort((a, b) => a - b).join(',');
    if (lastAutoApplyKeyRef.current === key) return;
    lastAutoApplyKeyRef.current = key;
    void applyMatches('auto');
  }, [matchedDomainIds, isApplying]);

  const addRule = () => {
    const nameServers = Array.from(new Set(splitNameServers(nameServerInput)));
    if (nameServers.length < 2) {
      alert('Add at least two unique name servers. One name server is not enough evidence that the domain is yours.');
      return;
    }

    const duplicate = rules.some(rule => (
      rule.nameServers.length === nameServers.length
      && rule.nameServers.every(server => nameServers.includes(server))
    ));
    if (duplicate) {
      alert('This name-server combination is already whitelisted.');
      return;
    }

    const nextRule: AutoMineRule = {
      id: crypto.randomUUID(),
      label: label.trim() || getRuleLabel(nameServers),
      nameServers,
      enabled: true,
    };
    setRules(current => [nextRule, ...current]);
    setLabel('');
    setNameServerInput('');
    addLog(`✅ Added Auto Mine rule: ${nextRule.label}.`);
  };

  const toggleRule = (id: string) => {
    setRules(current => current.map(rule => rule.id === id ? { ...rule, enabled: !rule.enabled } : rule));
  };

  const removeRule = (id: string) => {
    setRules(current => current.filter(rule => rule.id !== id));
  };

  return (
    <section className="mb-6 border-b border-slate-200 pb-4 dark:border-slate-700">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setIsExpanded(current => !current)}
          className="flex min-w-0 flex-1 items-start gap-3 text-left"
          aria-expanded={isExpanded}
          aria-controls="auto-mine-panel"
        >
          <span className="mt-0.5 rounded-md bg-indigo-50 p-1 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-200">
            {isExpanded ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />}
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Auto Mine</span>
            <span className="mt-1 block text-sm text-slate-600 dark:text-slate-300">
              {rules.length} name-server combination rule{rules.length === 1 ? '' : 's'}
              {matchedDomainIds.length > 0 ? `, ${matchedDomainIds.length} match${matchedDomainIds.length === 1 ? '' : 'es'} ready` : ''}
            </span>
          </span>
        </button>

        <Tooltip content="Apply enabled name-server rules to matching domains now. The panel also auto-applies matches while the dashboard is open.">
          <button
            type="button"
            onClick={() => void applyMatches('manual')}
            disabled={isApplying || matchedDomainIds.length === 0}
            className="inline-flex items-center gap-2 rounded-md bg-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-300 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
          >
            <HomeIcon className="h-4 w-4" />
            {isApplying ? 'Applying...' : 'Apply matches'}
          </button>
        </Tooltip>
      </div>

      {isExpanded && (
        <div id="auto-mine-panel" className="mt-4 space-y-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Add combinations of two or more name servers that are unique to your Cloudflare/hosting account. A domain is marked Mine only when every server in a saved combination is present.
          </p>

          <div className="grid gap-3 md:grid-cols-[1fr_1.4fr_auto]">
            <input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Rule label, optional"
              className="rounded-lg border-2 border-slate-200 bg-slate-100 px-3 py-2 text-sm focus:border-brand-blue focus:ring-0 dark:border-slate-700 dark:bg-slate-800"
            />
            <textarea
              value={nameServerInput}
              onChange={(event) => setNameServerInput(event.target.value)}
              placeholder="alice.ns.cloudflare.com&#10;bob.ns.cloudflare.com"
              rows={2}
              className="rounded-lg border-2 border-slate-200 bg-slate-100 px-3 py-2 text-sm focus:border-brand-blue focus:ring-0 dark:border-slate-700 dark:bg-slate-800"
            />
            <button
              type="button"
              onClick={addRule}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-600"
            >
              <PlusIcon className="h-4 w-4" />
              Add
            </button>
          </div>

          {rules.length > 0 ? (
            <div className="space-y-2">
              {rules.map(rule => (
                <div key={rule.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950/60">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800 dark:text-slate-100">{rule.label}</p>
                    <p className="mt-1 break-all font-mono text-[11px] text-slate-500 dark:text-slate-400">{rule.nameServers.join(' + ')}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleRule(rule.id)}
                      className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${rule.enabled ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200' : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}
                    >
                      {rule.enabled ? 'Enabled' : 'Disabled'}
                    </button>
                    <Tooltip content="Remove this name-server rule">
                      <button
                        type="button"
                        onClick={() => removeRule(rule.id)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-red-500 transition-colors hover:bg-red-100 dark:hover:bg-red-900/50"
                        aria-label={`Remove ${rule.label}`}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </Tooltip>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500 dark:bg-slate-950 dark:text-slate-400">
              No Auto Mine rules yet.
            </p>
          )}

          {matchedDomains.length > 0 && (
            <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 dark:border-indigo-900/70 dark:bg-indigo-950/40">
              <p className="mb-2 text-sm font-semibold text-indigo-900 dark:text-indigo-100">Matched domains</p>
              <div className="flex flex-wrap gap-2">
                {matchedDomains.slice(0, 12).map(domain => (
                  <span key={domain.id} className="rounded-full bg-white px-2 py-1 text-xs font-medium text-indigo-800 dark:bg-slate-900 dark:text-indigo-200">
                    {domain.domain_name}
                  </span>
                ))}
                {matchedDomains.length > 12 && (
                  <span className="rounded-full bg-white px-2 py-1 text-xs font-medium text-indigo-800 dark:bg-slate-900 dark:text-indigo-200">
                    +{matchedDomains.length - 12}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
};

export default AutoMinePanel;
