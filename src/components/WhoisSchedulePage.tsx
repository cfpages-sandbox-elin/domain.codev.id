import { useEffect, useMemo, useState } from 'react';
import { Domain, DomainMonitoringSettingsInput } from '../types';
import { getWhoisSchedule } from '../utils/whoisSchedule';
import { getDaysUntilExpiry } from './domain-list/domainListLogic';
import { DEFAULT_MONITORING_SETTINGS } from '../utils/monitoringSettings';
import { getDomainMonitoringSettings } from '../services/supabaseService';
import { RefreshIcon } from './icons';

interface WhoisSchedulePageProps {
  dateRefreshTick: number;
  domains: Domain[];
  onRecheck?: (id: number) => Promise<void>;
  isProcessing?: boolean;
}

const formatDateTime = (date: Date) => date.toLocaleString('en-GB', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

const WhoisSchedulePage = ({ dateRefreshTick, domains, onRecheck, isProcessing = false }: WhoisSchedulePageProps) => {
  const [clockTick, setClockTick] = useState(dateRefreshTick);
  const [recheckingId, setRecheckingId] = useState<number | null>(null);
  const [monitoringSettings, setMonitoringSettings] = useState<DomainMonitoringSettingsInput>(DEFAULT_MONITORING_SETTINGS);

  const handleRecheck = async (id: number) => {
    if (!onRecheck || isProcessing || recheckingId !== null) return;
    setRecheckingId(id);
    try {
      await onRecheck(id);
    } finally {
      setRecheckingId(null);
    }
  };
  useEffect(() => {
    let cancelled = false;
    void getDomainMonitoringSettings().then(settings => {
      if (!cancelled && settings) setMonitoringSettings(settings);
    });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    setClockTick(Date.now());
    const intervalId = window.setInterval(() => setClockTick(Date.now()), 60 * 1000);
    return () => window.clearInterval(intervalId);
  }, [dateRefreshTick]);
  const now = useMemo(() => new Date(clockTick), [clockTick]);
  const buckets = useMemo(() => {
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);
    const next3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const next7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const scheduled = domains
      .map(domain => ({ domain, schedule: getWhoisSchedule(domain, now, monitoringSettings) }))
      .filter(item => item.schedule.nextCheckAt)
      .sort((a, b) => {
        if (a.schedule.isDue !== b.schedule.isDue) return a.schedule.isDue ? -1 : 1;
        return a.schedule.nextCheckAt!.getTime() - b.schedule.nextCheckAt!.getTime()
          || b.schedule.priority - a.schedule.priority
          || a.domain.domain_name.localeCompare(b.domain.domain_name);
      });
    return [
      { label: 'Due today', items: scheduled.filter(item => item.schedule.isDue || item.schedule.nextCheckAt! <= endOfToday), tone: 'red' },
      { label: 'Next 3 days', items: scheduled.filter(item => item.schedule.nextCheckAt! > endOfToday && item.schedule.nextCheckAt! <= next3Days), tone: 'amber' },
      { label: 'Next 7 days', items: scheduled.filter(item => item.schedule.nextCheckAt! > next3Days && item.schedule.nextCheckAt! <= next7Days), tone: 'blue' },
      { label: 'Later', items: scheduled.filter(item => item.schedule.nextCheckAt! > next7Days), tone: 'slate' },
    ] as const;
  }, [domains, monitoringSettings, now]);

  const scheduledCount = buckets.reduce((total, bucket) => total + bucket.items.length, 0);
  const toneClasses = {
    red: 'border-red-200 bg-red-50 dark:border-red-900/70 dark:bg-red-950/30',
    amber: 'border-amber-200 bg-amber-50 dark:border-amber-900/70 dark:bg-amber-950/30',
    blue: 'border-blue-200 bg-blue-50 dark:border-blue-900/70 dark:bg-blue-950/30',
    slate: 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-950/40',
  };

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">WHOIS Update Schedule</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Automatic monitoring cadence based on expiry and drop-window priority.</p>
        </div>
        <div className="text-sm font-semibold text-slate-600 dark:text-slate-300">{scheduledCount} scheduled · {domains.length - scheduledCount} terminal/skipped</div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {buckets.map(bucket => (
          <section key={bucket.label} className={`rounded-lg border p-3 sm:p-4 ${toneClasses[bucket.tone]}`}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold text-slate-900 dark:text-white">{bucket.label}</h2>
              <span className="rounded-full bg-white/70 px-2 py-0.5 text-xs font-semibold text-slate-700 dark:bg-slate-900/70 dark:text-slate-200">{bucket.items.length}</span>
            </div>
            {bucket.items.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">No scheduled checks.</p>
            ) : (
              <ul className="space-y-2">
                {bucket.items.map(({ domain, schedule }) => {
                  const daysLeft = getDaysUntilExpiry(domain, now);
                  return (
                    <li key={domain.id} className="rounded-md bg-white/75 p-2.5 text-sm dark:bg-slate-900/60">
                      <div className="flex min-w-0 items-center justify-between gap-3">
                        <span className="truncate font-semibold text-slate-900 dark:text-white">{domain.domain_name}</span>
                        <div className="flex items-center gap-1.5 flex-none">
                          <span className="text-xs text-slate-500 dark:text-slate-400">{schedule.isDue ? 'Due now' : formatDateTime(schedule.nextCheckAt!)}</span>
                          {onRecheck && (
                            <button
                              type="button"
                              onClick={() => handleRecheck(domain.id)}
                              disabled={recheckingId === domain.id || isProcessing}
                              className="inline-flex h-6 w-6 items-center justify-center rounded text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-800 disabled:opacity-50 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                              aria-label={`Re-check ${domain.domain_name}`}
                              title="Re-check WHOIS now"
                            >
                              <RefreshIcon className={`h-3.5 w-3.5 ${recheckingId === domain.id ? 'animate-spin' : ''}`} />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                        <span>{schedule.cadence}</span>
                        <span>{domain.tag}</span>
                        {daysLeft !== null && <span>{daysLeft < 0 ? `${Math.abs(daysLeft)}d expired` : `${daysLeft}d left`}</span>}
                      </div>
                      <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{schedule.reason}</p>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        ))}
      </div>
    </div>
  );
};

export default WhoisSchedulePage;
