import type { Dispatch, SetStateAction } from 'react';
import type { AutoMineRule, Domain, SerpProviderStatus, WhoisProviderStatus } from '../../types';
import AutoMinePanel from '../AutoMinePanel';
import WhoisProviderPanel from '../WhoisProviderPanel';
import MonitoringSettingsPanel from '../MonitoringSettingsPanel';
import SerpProviderPanel from '../SerpProviderPanel';

type SettingsTab = 'whois' | 'monitoring' | 'auto-mine' | 'serp';

type SettingsViewProps = {
  domains: Domain[];
  settingsTab: SettingsTab;
  setSettingsTab: (tab: SettingsTab) => void;
  whoisProviders: WhoisProviderStatus[];
  isWhoisProviderLoading: boolean;
  serpProviders: SerpProviderStatus[];
  isSerpProviderLoading: boolean;
  autoMineRules: AutoMineRule[];
  onRefreshWhoisProviders: () => void;
  onSaveWhoisProviderCredential: (providerId: string, apiKey: string) => Promise<boolean>;
  onRemoveWhoisProviderCredential: (providerId: string) => Promise<boolean>;
  onRefreshSerpProviders: () => void;
  onSaveSerpProviderCredential: (providerId: string, apiKey: string) => Promise<boolean>;
  onRemoveSerpProviderCredential: (providerId: string) => Promise<boolean>;
  onAutoMineRulesChange: Dispatch<SetStateAction<AutoMineRule[]>>;
  onApplyAutoMineMatches: (domainIds: number[], reason: string) => Promise<void>;
  addLog: (message: string) => void;
};

const tabClassName = (active: boolean) => `w-full rounded-full px-3 py-2 text-xs font-semibold transition-colors sm:w-auto sm:px-4 sm:text-sm ${
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
  serpProviders,
  isSerpProviderLoading,
  autoMineRules,
  onRefreshWhoisProviders,
  onSaveWhoisProviderCredential,
  onRemoveWhoisProviderCredential,
  onRefreshSerpProviders,
  onSaveSerpProviderCredential,
  onRemoveSerpProviderCredential,
  onAutoMineRulesChange,
  onApplyAutoMineMatches,
  addLog,
}: SettingsViewProps) => (
  <div className="mx-auto max-w-5xl">
    <div className="mb-4 sm:mb-6">
      <h2 className="text-xl font-bold text-slate-800 dark:text-white sm:text-2xl">Settings</h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Manage WHOIS/SERP providers, monitoring cadence, and ownership automation.
      </p>
    </div>

    <div className="mb-4 grid grid-cols-2 gap-2 sm:mb-5 sm:flex sm:flex-wrap sm:justify-center">
      <button type="button" onClick={() => setSettingsTab('whois')} className={tabClassName(settingsTab === 'whois')}>
        WHOIS Providers
      </button>
      <button type="button" onClick={() => setSettingsTab('serp')} className={tabClassName(settingsTab === 'serp')}>
        SERP Providers
      </button>
      <button type="button" onClick={() => setSettingsTab('monitoring')} className={tabClassName(settingsTab === 'monitoring')}>
        Monitoring
      </button>
      <button type="button" onClick={() => setSettingsTab('auto-mine')} className={tabClassName(settingsTab === 'auto-mine')}>
        Auto Mine
      </button>
    </div>

    <div className="-mx-4 bg-white px-3 py-4 shadow-sm dark:bg-slate-900 dark:shadow-black/30 sm:mx-0 sm:rounded-xl sm:p-5 md:rounded-2xl md:p-6 md:shadow-lg">
      {settingsTab === 'whois' ? (
        <WhoisProviderPanel
          providers={whoisProviders}
          isLoading={isWhoisProviderLoading}
          onRefresh={onRefreshWhoisProviders}
          onSaveCredential={onSaveWhoisProviderCredential}
          onRemoveCredential={onRemoveWhoisProviderCredential}
          defaultExpanded
        />
      ) : settingsTab === 'serp' ? (
        <SerpProviderPanel
          providers={serpProviders}
          isLoading={isSerpProviderLoading}
          onRefresh={onRefreshSerpProviders}
          onSaveCredential={onSaveSerpProviderCredential}
          onRemoveCredential={onRemoveSerpProviderCredential}
          defaultExpanded
        />
      ) : settingsTab === 'auto-mine' ? (
        <AutoMinePanel
          domains={domains}
          rules={autoMineRules}
          onRulesChange={onAutoMineRulesChange}
          onApplyMatches={onApplyAutoMineMatches}
          addLog={addLog}
        />
      ) : (
        <MonitoringSettingsPanel addLog={addLog} />
      )}
    </div>
  </div>
);

export default SettingsView;
