export interface MonitoringSettings {
  enabled: boolean;
  max_checks_per_run: number;
  grace_interval_hours: number;
  pre_drop_start_days: number;
  pre_drop_interval_hours: number;
  estimated_drop_days: number;
  active_window_before_hours: number;
  active_window_after_hours: number;
  active_interval_minutes: number;
  post_window_interval_hours: number;
}

export const DEFAULT_MONITORING_SETTINGS: MonitoringSettings = {
  enabled: true,
  max_checks_per_run: 25,
  grace_interval_hours: 168,
  pre_drop_start_days: 45,
  pre_drop_interval_hours: 24,
  estimated_drop_days: 65,
  active_window_before_hours: 36,
  active_window_after_hours: 348,
  active_interval_minutes: 60,
  post_window_interval_hours: 6,
};

const numberInRange = (value: unknown, fallback: number, min: number, max: number) => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? Math.min(Math.max(Math.round(parsed), min), max) : fallback;
};

export const normalizeMonitoringSettings = (value: Partial<MonitoringSettings> | null | undefined): MonitoringSettings => ({
  enabled: typeof value?.enabled === 'boolean' ? value.enabled : DEFAULT_MONITORING_SETTINGS.enabled,
  max_checks_per_run: numberInRange(value?.max_checks_per_run, 25, 1, 100),
  grace_interval_hours: numberInRange(value?.grace_interval_hours, 168, 1, 720),
  pre_drop_start_days: numberInRange(value?.pre_drop_start_days, 45, 1, 180),
  pre_drop_interval_hours: numberInRange(value?.pre_drop_interval_hours, 24, 1, 168),
  estimated_drop_days: numberInRange(value?.estimated_drop_days, 65, 1, 365),
  active_window_before_hours: numberInRange(value?.active_window_before_hours, 36, 0, 336),
  active_window_after_hours: numberInRange(value?.active_window_after_hours, 348, 0, 720),
  active_interval_minutes: numberInRange(value?.active_interval_minutes, 60, 15, 1440),
  post_window_interval_hours: numberInRange(value?.post_window_interval_hours, 6, 1, 168),
});
