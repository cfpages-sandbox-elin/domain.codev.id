import { DEFAULT_MONITORING_SETTINGS, MonitoringSettings } from '../_shared/monitoring-settings.ts';

export type DomainTag = 'mine' | 'to-snatch' | 'others';
export type DomainStatus = 'available' | 'registered' | 'expired' | 'dropped' | 'reserved' | 'unknown';

export interface Domain {
  id: number;
  user_id: string;
  domain_name: string;
  status: DomainStatus;
  tag: DomainTag;
  expiration_date: string | null;
  registered_date: string | null;
  last_checked: string | null;
}

export interface CheckDecision {
  due: boolean;
  reason: string;
  priority: number;
}

const hoursSince = (dateString: string | null, now: Date) => {
  if (!dateString) return Number.POSITIVE_INFINITY;
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  return Number.isFinite(diffMs) ? diffMs / (1000 * 60 * 60) : Number.POSITIVE_INFINITY;
};

const daysUntil = (dateString: string | null, now: Date) => {
  if (!dateString) return null;
  const date = new Date(dateString);
  const diffMs = date.getTime() - now.getTime();
  if (!Number.isFinite(diffMs)) return null;
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
};

const isAvailableLike = (status: DomainStatus) => status === 'available' || status === 'dropped';
const isAutoCheckTerminal = (status: DomainStatus) => isAvailableLike(status) || status === 'reserved';

const hasTimeComponent = (dateString: string | null) => Boolean(dateString && /T\d{2}:\d{2}/.test(dateString));

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

const estimateDropTiming = (expirationDate: string, registeredDate: string | null, settings: MonitoringSettings) => {
  const expiry = new Date(expirationDate);
  if (!Number.isFinite(expiry.getTime())) return null;

  const dropAt = addDays(expiry, settings.estimated_drop_days);
  let confidence: 'expiry-time' | 'registration-hour' | 'date-only' = hasTimeComponent(expirationDate)
    ? 'expiry-time'
    : 'date-only';

  if (confidence === 'date-only' && hasTimeComponent(registeredDate)) {
    const registeredAt = new Date(registeredDate!);
    if (Number.isFinite(registeredAt.getTime())) {
      dropAt.setUTCHours(
        registeredAt.getUTCHours(),
        registeredAt.getUTCMinutes(),
        registeredAt.getUTCSeconds(),
        registeredAt.getUTCMilliseconds(),
      );
      confidence = 'registration-hour';
    }
  }

  const windowStart = new Date(dropAt.getTime() - settings.active_window_before_hours * 60 * 60 * 1000);
  const windowEnd = new Date(dropAt.getTime() + settings.active_window_after_hours * 60 * 60 * 1000);
  return { dropAt, windowStart, windowEnd, confidence };
};

export const checkDecisionForDomain = (
  domain: Domain,
  now: Date,
  settings: MonitoringSettings = DEFAULT_MONITORING_SETTINGS,
): CheckDecision => {
  const lastCheckedHours = hoursSince(domain.last_checked, now);
  const daysUntilExpiry = daysUntil(domain.expiration_date, now);

  if (isAutoCheckTerminal(domain.status)) {
    return {
      due: false,
      reason: domain.status === 'reserved'
        ? 'reserved domain; skip automatic checks'
        : 'already marked available; manual buy/re-check is enough',
      priority: 0,
    };
  }

  if (!settings.enabled) {
    return { due: false, reason: 'automatic monitoring is paused by user settings', priority: 0 };
  }

  if (daysUntilExpiry === null) {
    const intervalHours = domain.status === 'unknown' ? 24 * 7 : 24 * 30;
    return {
      due: lastCheckedHours >= intervalHours,
      reason: domain.status === 'unknown'
        ? 'unknown expiry; retry weekly'
        : 'missing expiry; retry monthly',
      priority: domain.status === 'unknown' ? 55 : 15,
    };
  }

  if (daysUntilExpiry > 30) {
    return {
      due: false,
      reason: 'expiry is more than 30 days away',
      priority: 0,
    };
  }

  if (domain.tag === 'mine' || domain.tag === 'others') {
    const ownerLabel = domain.tag === 'mine' ? 'owned' : 'other tracked';
    if (daysUntilExpiry > 14) {
      return {
        due: lastCheckedHours >= 24 * 14,
        reason: `${ownerLabel} domain inside expiry month; check once around 30 days`,
        priority: 30,
      };
    }

    if (daysUntilExpiry > 7) {
      return {
        due: lastCheckedHours >= 24 * 7,
        reason: `${ownerLabel} domain nearing renewal window; weekly confirmation`,
        priority: 40,
      };
    }

    if (daysUntilExpiry > 3) {
      return {
        due: lastCheckedHours >= 24 * 3,
        reason: `${ownerLabel} domain close to expiry; confirm every 3 days`,
        priority: 50,
      };
    }

    return {
      due: lastCheckedHours >= 24,
      reason: daysUntilExpiry >= 0
        ? `${ownerLabel} domain in final renewal days; daily confirmation`
        : `${ownerLabel} domain expired; daily confirmation`,
      priority: 60,
    };
  }

  if (daysUntilExpiry > 14) {
    return {
      due: lastCheckedHours >= 24 * 14,
      reason: 'target domain inside expiry month; check once around 30 days',
      priority: 35,
    };
  }

  if (daysUntilExpiry > 7) {
    return {
      due: lastCheckedHours >= 24 * 7,
      reason: 'target domain two weeks from expiry; weekly confirmation',
      priority: 45,
    };
  }

  if (daysUntilExpiry > 0) {
    return {
      due: lastCheckedHours >= 24,
      reason: 'target domain in final week before expiry; daily confirmation',
      priority: 65,
    };
  }

  const daysSinceExpiry = Math.abs(daysUntilExpiry);
  const dropTiming = estimateDropTiming(domain.expiration_date, domain.registered_date, settings);
  if (dropTiming) {
    if (now >= dropTiming.windowStart && now <= dropTiming.windowEnd) {
      return {
        due: lastCheckedHours >= settings.active_interval_minutes / 60,
        reason: `target domain in active drop watch (${dropTiming.confidence}); check every ${settings.active_interval_minutes} minutes`,
        priority: 110,
      };
    }
    if (now > dropTiming.windowEnd) {
      return {
        due: lastCheckedHours >= settings.post_window_interval_hours,
        reason: `target domain past estimated window but still unavailable; check every ${settings.post_window_interval_hours} hours`,
        priority: 100,
      };
    }
  }

  if (daysSinceExpiry < settings.pre_drop_start_days) {
    return {
      due: lastCheckedHours >= settings.grace_interval_hours,
      reason: `target domain likely in grace/redemption period; check every ${settings.grace_interval_hours} hours`,
      priority: 55,
    };
  }

  return {
    due: lastCheckedHours >= settings.pre_drop_interval_hours,
    reason: `target domain approaching active drop watch; check every ${settings.pre_drop_interval_hours} hours`,
    priority: 75,
  };
};
