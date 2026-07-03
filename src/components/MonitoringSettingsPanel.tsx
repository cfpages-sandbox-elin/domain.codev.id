import { useEffect, useMemo, useState } from 'react';
import { DomainMonitoringSettingsInput } from '../types';
import { getDomainMonitoringSettings, saveDomainMonitoringSettings } from '../services/supabaseService';
import { DEFAULT_MONITORING_SETTINGS, MONITORING_PRESETS } from '../utils/monitoringSettings';
import { CheckCircleIcon, RefreshIcon } from './icons';
import Spinner from './Spinner';

type PresetName = keyof typeof MONITORING_PRESETS;

const numericFields: Array<{
  key: Exclude<keyof DomainMonitoringSettingsInput, 'enabled'>;
  label: string;
  unit: string;
  min: number;
  max: number;
}> = [
  { key: 'max_checks_per_run', label: 'Maximum checks per run', unit: 'domains', min: 1, max: 100 },
  { key: 'grace_interval_hours', label: 'Grace/redemption cadence', unit: 'hours', min: 1, max: 720 },
  { key: 'pre_drop_start_days', label: 'Start pre-drop watch after expiry', unit: 'days', min: 1, max: 180 },
  { key: 'pre_drop_interval_hours', label: 'Pre-drop cadence', unit: 'hours', min: 1, max: 168 },
  { key: 'estimated_drop_days', label: 'Estimated drop after expiry', unit: 'days', min: 1, max: 365 },
  { key: 'active_window_before_hours', label: 'Active window before estimate', unit: 'hours', min: 0, max: 336 },
  { key: 'active_window_after_hours', label: 'Active window after estimate', unit: 'hours', min: 0, max: 720 },
  { key: 'active_interval_minutes', label: 'Active polling cadence', unit: 'minutes', min: 15, max: 1440 },
  { key: 'post_window_interval_hours', label: 'Post-window cadence', unit: 'hours', min: 1, max: 168 },
];

const MonitoringSettingsPanel = ({ addLog }: { addLog: (message: string) => void }) => {
  const [settings, setSettings] = useState<DomainMonitoringSettingsInput>(DEFAULT_MONITORING_SETTINGS);
  const [savedSettings, setSavedSettings] = useState<DomainMonitoringSettingsInput>(DEFAULT_MONITORING_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getDomainMonitoringSettings()
      .then(value => {
        if (cancelled) return;
        const next = value || DEFAULT_MONITORING_SETTINGS;
        setSettings(next);
        setSavedSettings(next);
      })
      .catch(error => addLog(`❌ Could not load monitoring settings: ${error instanceof Error ? error.message : String(error)}`))
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [addLog]);

  const activeChecksPerDay = Math.ceil(1440 / settings.active_interval_minutes);
  const hasChanges = useMemo(() => JSON.stringify(settings) !== JSON.stringify(savedSettings), [savedSettings, settings]);
  const activePreset = (Object.entries(MONITORING_PRESETS) as Array<[PresetName, DomainMonitoringSettingsInput]>)
    .find(([, preset]) => JSON.stringify(settings) === JSON.stringify(preset))?.[0];

  const updateNumber = (key: Exclude<keyof DomainMonitoringSettingsInput, 'enabled'>, value: string, min: number, max: number) => {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) return;
    setSettings(current => ({ ...current, [key]: Math.min(Math.max(parsed, min), max) }));
    setSavedNotice(false);
  };

  const save = async () => {
    setIsSaving(true);
    try {
      await saveDomainMonitoringSettings(settings);
      setSavedSettings(settings);
      setSavedNotice(true);
      addLog('✅ Saved WHOIS monitoring policy.');
    } catch (error) {
      alert(`Could not save monitoring settings: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <div className="flex min-h-48 items-center justify-center"><Spinner /></div>;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4 dark:border-slate-700">
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-white">Automatic WHOIS monitoring</h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Cron wakes every 15 minutes; this policy decides whether a provider request is due.</p>
        </div>
        <label className="inline-flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={event => {
              setSettings(current => ({ ...current, enabled: event.target.checked }));
              setSavedNotice(false);
            }}
            className="h-4 w-4 rounded border-slate-300 text-brand-blue focus:ring-brand-blue"
          />
          Enabled
        </label>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">Preset</h3>
        <div className="grid grid-cols-3 gap-2 sm:w-fit">
          {(Object.keys(MONITORING_PRESETS) as PresetName[]).map(name => (
            <button
              key={name}
              type="button"
              onClick={() => {
                setSettings({ ...MONITORING_PRESETS[name], enabled: settings.enabled });
                setSavedNotice(false);
              }}
              className={`rounded-md px-3 py-2 text-xs font-semibold capitalize transition-colors ${activePreset === name ? 'bg-brand-blue text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'}`}
            >
              {name === 'saver' ? 'Quota saver' : name}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {numericFields.map(field => (
          <label key={field.key} className="min-w-0">
            <span className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">{field.label}</span>
            <span className="flex overflow-hidden rounded-md border border-slate-300 bg-white focus-within:border-brand-blue focus-within:ring-1 focus-within:ring-brand-blue dark:border-slate-700 dark:bg-slate-950">
              <input
                type="number"
                min={field.min}
                max={field.max}
                value={settings[field.key]}
                onChange={event => updateNumber(field.key, event.target.value, field.min, field.max)}
                className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm outline-none"
              />
              <span className="flex items-center border-l border-slate-200 bg-slate-50 px-2 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">{field.unit}</span>
            </span>
          </label>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 dark:border-slate-700">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Active watch: up to {activeChecksPerDay} check{activeChecksPerDay === 1 ? '' : 's'} per target/day before run caps and provider fallback limits.
        </p>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setSettings(savedSettings)} disabled={!hasChanges || isSaving} className="inline-flex items-center gap-2 rounded-md bg-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-300 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
            <RefreshIcon className="h-4 w-4" /> Revert
          </button>
          <button type="button" onClick={() => void save()} disabled={!hasChanges || isSaving} className="inline-flex items-center gap-2 rounded-md bg-brand-blue px-3 py-2 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-50">
            {isSaving ? <Spinner size="sm" color="border-white" /> : <CheckCircleIcon className="h-4 w-4" />}
            {savedNotice && !hasChanges ? 'Saved' : 'Save policy'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MonitoringSettingsPanel;
