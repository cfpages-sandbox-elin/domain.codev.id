import type { Dispatch, SetStateAction } from 'react';
import type { AutoMineRule, Domain, WhoisProviderStatus } from '../../types';
import AutoMinePanel from '../AutoMinePanel';
import WhoisProviderPanel from '../WhoisProviderPanel';

type SettingsTab = 'whois' | 'auto-mine';

type SettingsViewProps = {
  domains: Domain[];
  settingsTab: SettingsTab;
  setSettingsTab: (tab: SettingsTab) => void;
  whoisProviders: WhoisProviderStatus[];
  isWhoisProviderLoading: boolean;
  autoMineRules: AutoMineRule[];
  onRefreshWhoisProviders: () => void;
  onSaveWhoisProviderCredential: (providerId: string, apiKey: string) => Promise<boolean>;
  onRemoveWhoisProviderCredential: (providerId: string) => Promise<boolean>;
  onAutoMineRulesChange: Dispatch<SetStateAction<AutoMineRule[]>>;
  onApplyAutoMineMatches: (domainIds: number[], reason: string) => Promise<void>;
  addLog: (message: string) => void;
};

const tabClassName = (active: boolean) => `rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
  active
    ? 'bg-brand-blue text-white'
    : 'bg-slate-200 text-slate-600 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
}`;

const SettingsView = ({
  domains,
  settingsTab,
  setSettingsTab,
  whoisProviders,
  isWhoisProviderLoading,
  autoMineRules,
  onRefreshWhoisProviders,
  onSaveWhoisProviderCredential,
  onRemoveWhoisProviderCredential,
  onAutoMineRulesChange,
  onApplyAutoMineMatches,
  addLog,
}: SettingsViewProps) => (
  <div className="mx-auto max-w-5xl">
    <div className="mb-6">
      <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Settings</h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Manage provider fallback behavior and ownership automation.</p>
    </div>

    <div className="mb-5 flex flex-wrap justify-center gap-2">
      <button type="button" onClick={() => setSettingsTab('whois')} className={tabClassName(settingsTab === 'whois')}>
        WHOIS Providers
      </button>
      <button type="button" onClick={() => setSettingsTab('auto-mine')} className={tabClassName(settingsTab === 'auto-mine')}>
        Auto Mine
      </button>
    </div>

    <div className="rounded-2xl bg-white p-6 shadow-lg dark:bg-slate-900 dark:shadow-black/40">
      {settingsTab === 'whois' ? (
        <WhoisProviderPanel
          providers={whoisProviders}
          isLoading={isWhoisProviderLoading}
          onRefresh={onRefreshWhoisProviders}
          onSaveCredential={onSaveWhoisProviderCredential}
          onRemoveCredential={onRemoveWhoisProviderCredential}
          defaultExpanded
        />
      ) : (
        <AutoMinePanel
          domains={domains}
          rules={autoMineRules}
          onRulesChange={onAutoMineRulesChange}
          onApplyMatches={onApplyAutoMineMatches}
          addLog={addLog}
        />
      )}
    </div>
  </div>
);

export default SettingsView;
