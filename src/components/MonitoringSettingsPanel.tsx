import { useEffect, useMemo, useState } from 'react';
import { DomainMonitoringSettingsInput } from '../types';
import { getDomainMonitoringSettings, saveDomainMonitoringSettings } from '../services/supabaseService';
import { DEFAULT_MONITORING_SETTINGS, MONITORING_PRESETS } from '../utils/monitoringSettings';
import { fromCanonicalTime, MonitoringTimeUnit, toCanonicalTime } from '../utils/monitoringUnitConversion';
import { CheckCircleIcon, InfoIcon, RefreshIcon } from './icons';
import Spinner from './Spinner';
import Tooltip from './Tooltip';

type PresetName = keyof typeof MONITORING_PRESETS;

const numericFields: Array<{
  key: Exclude<keyof DomainMonitoringSettingsInput, 'enabled'>;
  label: string;
  description: string;
  canonicalUnit: MonitoringTimeUnit | null;
  defaultDisplayUnit: MonitoringTimeUnit | 'domains';
  min: number;
  max: number;
}> = [
  { key: 'max_checks_per_run', label: 'Maximum checks per run', description: 'Maximum domains this user may send to WHOIS during one 15-minute cron run. Lower values protect quota and rotate the oldest due domains first; higher values clear large due queues faster.', canonicalUnit: null, defaultDisplayUnit: 'domains', min: 1, max: 100 },
  { key: 'grace_interval_hours', label: 'Grace/redemption cadence', description: 'How often to check a target after expiry but before pre-drop watch begins. Registrants often still have renewal rights here, so frequent checks usually spend quota without finding availability.', canonicalUnit: 'hours', defaultDisplayUnit: 'days', min: 1, max: 720 },
  { key: 'pre_drop_start_days', label: 'Start pre-drop watch after expiry', description: 'How long after expiry the tracker switches from the low-frequency grace cadence to the closer pre-drop cadence. Set this earlier for registries with shorter deletion lifecycles.', canonicalUnit: 'days', defaultDisplayUnit: 'days', min: 1, max: 180 },
  { key: 'pre_drop_interval_hours', label: 'Pre-drop cadence', description: 'Check frequency after pre-drop watch starts but before the intensive active window. This is the bridge between grace monitoring and expected release time.', canonicalUnit: 'hours', defaultDisplayUnit: 'days', min: 1, max: 168 },
  { key: 'estimated_drop_days', label: 'Estimated drop after expiry', description: 'Fallback release estimate measured from the expiration timestamp. The generic default is 65 days, but registry and TLD policies differ, so adjust it when you know the registry lifecycle.', canonicalUnit: 'days', defaultDisplayUnit: 'days', min: 1, max: 365 },
  { key: 'active_window_before_hours', label: 'Active window before estimate', description: 'How early intensive polling begins before the estimated drop time. A wider window reduces timing risk but increases provider usage.', canonicalUnit: 'hours', defaultDisplayUnit: 'days', min: 0, max: 336 },
  { key: 'active_window_after_hours', label: 'Active window after estimate', description: 'How long intensive polling continues after the estimate. Keep this wide when registry timing is uncertain; reduce it when quota is more important.', canonicalUnit: 'hours', defaultDisplayUnit: 'days', min: 0, max: 720 },
  { key: 'active_interval_minutes', label: 'Active polling cadence', description: 'WHOIS check interval inside the active drop window. This directly controls detection latency and quota: 15 minutes allows up to 96 checks per target/day, while 1 hour allows up to 24.', canonicalUnit: 'minutes', defaultDisplayUnit: 'hours', min: 15, max: 1440 },
  { key: 'post_window_interval_hours', label: 'Post-window cadence', description: 'How often monitoring continues after the active window when the domain is still unavailable. Monitoring never stops automatically, but this slower cadence limits long-tail quota usage.', canonicalUnit: 'hours', defaultDisplayUnit: 'hours', min: 1, max: 168 },
];

const initialDisplayUnits = Object.fromEntries(
  numericFields.map(field => [field.key, field.defaultDisplayUnit]),
) as Record<Exclude<keyof DomainMonitoringSettingsInput, 'enabled'>, MonitoringTimeUnit | 'domains'>;

const MonitoringSettingsPanel = ({ addLog }: { addLog: (message: string) => void }) => {
  const [settings, setSettings] = useState<DomainMonitoringSettingsInput>(DEFAULT_MONITORING_SETTINGS);
  const [savedSettings, setSavedSettings] = useState<DomainMonitoringSettingsInput>(DEFAULT_MONITORING_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [displayUnits, setDisplayUnits] = useState(initialDisplayUnits);

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

  const updateNumber = (field: typeof numericFields[number], value: string) => {
    const parsed = Number.parseFloat(value);
    if (!Number.isFinite(parsed)) return;
    const displayUnit = displayUnits[field.key];
    const canonicalValue = field.canonicalUnit && displayUnit !== 'domains'
      ? toCanonicalTime(parsed, field.canonicalUnit, displayUnit)
      : Math.round(parsed);
    setSettings(current => ({ ...current, [field.key]: Math.min(Math.max(canonicalValue, field.min), field.max) }));
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
        {numericFields.map(field => {
          const displayUnit = displayUnits[field.key];
          const displayValue = field.canonicalUnit && displayUnit !== 'domains'
            ? fromCanonicalTime(settings[field.key], field.canonicalUnit, displayUnit)
            : settings[field.key];
          return (
          <div key={field.key} className="min-w-0">
            <span className="mb-1 flex min-h-5 items-center gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
              <label htmlFor={`monitoring-${field.key}`}>{field.label}</label>
              <Tooltip content={field.description} placement="top">
                <button type="button" className="inline-flex h-5 w-5 flex-none items-center justify-center rounded-full text-slate-400 hover:bg-slate-200 hover:text-brand-blue dark:hover:bg-slate-800" aria-label={`Explain ${field.label}`}>
                  <InfoIcon className="h-3.5 w-3.5" />
                </button>
              </Tooltip>
            </span>
            <span className="flex overflow-hidden rounded-md border border-slate-300 bg-white focus-within:border-brand-blue focus-within:ring-1 focus-within:ring-brand-blue dark:border-slate-700 dark:bg-slate-950">
              <input
                id={`monitoring-${field.key}`}
                type="number"
                min="0"
                step={displayUnit === 'minutes' || displayUnit === 'domains' ? '1' : '0.25'}
                value={displayValue}
                onChange={event => updateNumber(field, event.target.value)}
                className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm outline-none"
              />
              {field.canonicalUnit ? (
                <select
                  value={displayUnit}
                  onChange={event => setDisplayUnits(current => ({ ...current, [field.key]: event.target.value as MonitoringTimeUnit }))}
                  className="border-l border-slate-200 bg-slate-50 px-2 text-xs text-slate-600 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                  aria-label={`Unit for ${field.label}`}
                >
                  <option value="minutes">minutes</option>
                  <option value="hours">hours</option>
                  <option value="days">days</option>
                </select>
              ) : (
                <span className="flex items-center border-l border-slate-200 bg-slate-50 px-2 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">domains</span>
              )}
            </span>
          </div>
        );})}
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
