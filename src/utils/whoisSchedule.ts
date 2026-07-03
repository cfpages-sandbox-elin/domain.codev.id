import { Domain, DomainMonitoringSettingsInput } from '../types';
import { DEFAULT_MONITORING_SETTINGS } from './monitoringSettings';

const HOUR_MS = 1000 * 60 * 60;
const DAY_MS = HOUR_MS * 24;

export interface WhoisSchedule {
  nextCheckAt: Date | null;
  reason: string;
  cadence: string;
  priority: number;
  isDue: boolean;
}

const addHours = (date: Date, hours: number) => new Date(date.getTime() + hours * HOUR_MS);
const addDays = (date: Date, days: number) => new Date(date.getTime() + days * DAY_MS);

const parseDate = (value: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
};

const daysUntil = (dateString: string | null, now: Date) => {
  const date = parseDate(dateString);
  if (!date) return null;
  return Math.ceil((date.getTime() - now.getTime()) / DAY_MS);
};

const nextByInterval = (lastChecked: string | null, now: Date, intervalHours: number) => {
  const lastCheckedAt = parseDate(lastChecked);
  if (!lastCheckedAt) return now;
  const next = addHours(lastCheckedAt, intervalHours);
  return next <= now ? now : next;
};

const hasTimeComponent = (dateString: string | null) => Boolean(dateString && /T\d{2}:\d{2}/.test(dateString));

const estimateDropTiming = (expirationDate: string, registeredDate: string | null, settings: DomainMonitoringSettingsInput) => {
  const expiry = parseDate(expirationDate);
  if (!expiry) return null;

  const dropAt = addDays(expiry, settings.estimated_drop_days);
  let confidence: 'expiry-time' | 'registration-hour' | 'date-only' = hasTimeComponent(expirationDate)
    ? 'expiry-time'
    : 'date-only';

  if (confidence === 'date-only' && hasTimeComponent(registeredDate)) {
    const registeredAt = parseDate(registeredDate);
    if (registeredAt) {
      dropAt.setUTCHours(
        registeredAt.getUTCHours(),
        registeredAt.getUTCMinutes(),
        registeredAt.getUTCSeconds(),
        registeredAt.getUTCMilliseconds(),
      );
      confidence = 'registration-hour';
    }
  }

  return {
    dropAt,
    windowStart: addHours(dropAt, -settings.active_window_before_hours),
    windowEnd: addHours(dropAt, settings.active_window_after_hours),
    confidence,
  };
};

const schedule = (
  domain: Domain,
  now: Date,
  intervalHours: number,
  reason: string,
  cadence: string,
  priority: number,
): WhoisSchedule => {
  const nextCheckAt = nextByInterval(domain.last_checked, now, intervalHours);
  return {
    nextCheckAt,
    reason,
    cadence,
    priority,
    isDue: nextCheckAt <= now,
  };
};

export const getWhoisSchedule = (
  domain: Domain,
  now = new Date(),
  settings: DomainMonitoringSettingsInput = DEFAULT_MONITORING_SETTINGS,
): WhoisSchedule => {
  if (domain.status === 'reserved') {
    return {
      nextCheckAt: null,
      reason: 'Reserved domain; automatic checks are skipped.',
      cadence: 'Skipped',
      priority: 0,
      isDue: false,
    };
  }

  if (domain.status === 'available' || domain.status === 'dropped') {
    return {
      nextCheckAt: null,
      reason: 'Already marked available; use manual re-check before buying.',
      cadence: 'Manual',
      priority: 0,
      isDue: false,
    };
  }

  if (!settings.enabled) {
    return {
      nextCheckAt: null,
      reason: 'Automatic monitoring is paused in settings.',
      cadence: 'Paused',
      priority: 0,
      isDue: false,
    };
  }

  const daysUntilExpiry = daysUntil(domain.expiration_date, now);

  if (daysUntilExpiry === null) {
    return domain.status === 'unknown'
      ? schedule(domain, now, 24 * 7, 'Unknown expiry; retry weekly.', 'Weekly', 55)
      : schedule(domain, now, 24 * 30, 'Missing expiry; retry monthly.', 'Monthly', 15);
  }

  if (daysUntilExpiry > 30) {
    const expiryAt = parseDate(domain.expiration_date);
    return {
      nextCheckAt: expiryAt ? addDays(expiryAt, -30) : null,
      reason: 'Expiry is more than 30 days away.',
      cadence: 'Starts 30 days before expiry',
      priority: 0,
      isDue: false,
    };
  }

  if (domain.tag === 'mine' || domain.tag === 'others') {
    const ownerLabel = domain.tag === 'mine' ? 'Owned' : 'Other tracked';
    if (daysUntilExpiry > 14) {
      return schedule(domain, now, 24 * 14, `${ownerLabel} domain inside expiry month.`, 'Every 14 days', 30);
    }
    if (daysUntilExpiry > 7) {
      return schedule(domain, now, 24 * 7, `${ownerLabel} domain nearing renewal window.`, 'Weekly', 40);
    }
    if (daysUntilExpiry > 3) {
      return schedule(domain, now, 24 * 3, `${ownerLabel} domain close to expiry.`, 'Every 3 days', 50);
    }
    return schedule(domain, now, 24, `${ownerLabel} domain in final renewal/expired days.`, 'Daily', 60);
  }

  if (daysUntilExpiry > 14) {
    return schedule(domain, now, 24 * 14, 'Target domain inside expiry month.', 'Every 14 days', 35);
  }
  if (daysUntilExpiry > 7) {
    return schedule(domain, now, 24 * 7, 'Target domain two weeks from expiry.', 'Weekly', 45);
  }
  if (daysUntilExpiry > 0) {
    return schedule(domain, now, 24, 'Target domain in final week before expiry.', 'Daily', 65);
  }

  const daysSinceExpiry = Math.abs(daysUntilExpiry);
  const dropTiming = domain.expiration_date ? estimateDropTiming(domain.expiration_date, domain.registered_date, settings) : null;
  if (dropTiming && now >= dropTiming.windowStart && now <= dropTiming.windowEnd) {
    return schedule(domain, now, settings.active_interval_minutes / 60, 'Target domain in active drop watch until availability is detected.', `Every ${settings.active_interval_minutes} minutes`, 110);
  }
  if (dropTiming && now > dropTiming.windowEnd) {
    return schedule(domain, now, settings.post_window_interval_hours, 'Target domain past estimated drop window but still unavailable.', `Every ${settings.post_window_interval_hours} hours`, 100);
  }

  if (daysSinceExpiry < settings.pre_drop_start_days) {
    return schedule(domain, now, settings.grace_interval_hours, 'Target domain likely in grace/redemption period.', `Every ${settings.grace_interval_hours} hours`, 55);
  }

  return schedule(domain, now, settings.pre_drop_interval_hours, 'Target domain approaching active drop watch.', `Every ${settings.pre_drop_interval_hours} hours`, 75);
};
