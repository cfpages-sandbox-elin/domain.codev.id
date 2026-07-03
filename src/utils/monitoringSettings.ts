import { DomainMonitoringSettingsInput } from '../types';

export const DEFAULT_MONITORING_SETTINGS: DomainMonitoringSettingsInput = {
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

export const MONITORING_PRESETS = {
  saver: {
    ...DEFAULT_MONITORING_SETTINGS,
    max_checks_per_run: 10,
    grace_interval_hours: 336,
    pre_drop_interval_hours: 48,
    active_interval_minutes: 180,
    post_window_interval_hours: 24,
  },
  balanced: DEFAULT_MONITORING_SETTINGS,
  aggressive: {
    ...DEFAULT_MONITORING_SETTINGS,
    max_checks_per_run: 50,
    grace_interval_hours: 24,
    pre_drop_interval_hours: 6,
    active_interval_minutes: 15,
    post_window_interval_hours: 1,
  },
} satisfies Record<string, DomainMonitoringSettingsInput>;
