import { DomainRow } from './types.ts';
import { daysUntil, isAvailableLike } from './domain-utils.ts';

const hasTimeComponent = (dateString: string | null) => Boolean(dateString && /T\d{2}:\d{2}/.test(dateString));

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

export const estimateDropTiming = (domain: DomainRow) => {
  if (!domain.expiration_date) return null;
  const expiry = new Date(domain.expiration_date);
  if (!Number.isFinite(expiry.getTime())) return null;

  const dropAt = addDays(expiry, 65);
  let confidence: 'expiry-time' | 'registration-hour' | 'date-only' = hasTimeComponent(domain.expiration_date)
    ? 'expiry-time'
    : 'date-only';

  if (confidence === 'date-only' && hasTimeComponent(domain.registered_date)) {
    const registeredAt = new Date(domain.registered_date);
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

  return {
    estimatedDropAt: dropAt.toISOString(),
    windowStart: new Date(dropAt.getTime() - 12 * 60 * 60 * 1000).toISOString(),
    windowEnd: new Date(dropAt.getTime() + 12 * 60 * 60 * 1000).toISOString(),
    confidence,
  };
};

export const buildDropAlert = (domain: DomainRow) => {
  const days = daysUntil(domain.expiration_date);
  const dropTiming = estimateDropTiming(domain);
  const now = Date.now();
  const inDropWindow = Boolean(dropTiming
    && now >= new Date(dropTiming.windowStart).getTime()
    && now <= new Date(dropTiming.windowEnd).getTime());

  if (domain.tag !== 'to-snatch') return null;

  if (isAvailableLike(domain.status)) {
    return {
      id: `domain-${domain.id}-available`,
      event: 'domain.dropped',
      domainName: domain.domain_name,
      tag: domain.tag,
      status: domain.status,
      severity: 'available',
      expirationDate: domain.expiration_date,
      daysUntilExpiry: days,
      dropTiming,
      message: `${domain.domain_name} is marked available. Re-check before buying.`,
    };
  }

  if (domain.status === 'reserved') {
    return {
      id: `domain-${domain.id}-reserved`,
      event: 'domain.reserved',
      domainName: domain.domain_name,
      tag: domain.tag,
      status: domain.status,
      severity: 'reserved',
      expirationDate: domain.expiration_date,
      daysUntilExpiry: days,
      dropTiming,
      message: `${domain.domain_name} is reserved and not expected to become publicly available.`,
    };
  }

  if (days === null || days > 0 || days < -75) return null;

  return {
    id: `domain-${domain.id}-drop-watch-${domain.expiration_date || 'unknown'}`,
    event: inDropWindow ? 'domain.dropping-now' : 'domain.drop-watch',
    domainName: domain.domain_name,
    tag: domain.tag,
    status: domain.status,
    severity: inDropWindow ? 'drop-window-now' : 'watch-drop-window',
    expirationDate: domain.expiration_date,
    daysUntilExpiry: days,
    dropTiming,
    message: inDropWindow
      ? `${domain.domain_name} is inside the estimated drop-hour window. Check registrar availability now.`
      : `${domain.domain_name} expired ${Math.abs(days)} day(s) ago. Estimated drop timing is being watched.`,
  };
};
