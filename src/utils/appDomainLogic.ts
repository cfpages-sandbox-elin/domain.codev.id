import { Domain, WhoisData } from '../types';

export const formatLongDate = (date: Date) => date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(date.getDate() + days);
  return next;
};

export type DropLifecyclePhase = 'pre-expiry' | 'grace' | 'redemption' | 'drop-window' | 'drop-expected';

export interface DropLifecycleEstimate {
  phase: DropLifecyclePhase;
  phaseLabel: string;
  expiryDate: Date;
  gracePeriodEnd: Date;
  redemptionPeriodEnd: Date;
  dropDate: Date;
}

export const getDropLifecycleEstimate = (expirationDate: string, now = new Date()): DropLifecycleEstimate | null => {
  const expiryDate = new Date(expirationDate);
  if (Number.isNaN(expiryDate.getTime())) return null;

  const gracePeriodEnd = addDays(expiryDate, 30);
  const redemptionPeriodEnd = addDays(gracePeriodEnd, 30);
  const dropDate = addDays(redemptionPeriodEnd, 5);
  const nowTime = now.getTime();

  if (nowTime < expiryDate.getTime()) {
    return {
      phase: 'pre-expiry',
      phaseLabel: 'Before expiry',
      expiryDate,
      gracePeriodEnd,
      redemptionPeriodEnd,
      dropDate,
    };
  }

  if (nowTime <= gracePeriodEnd.getTime()) {
    return {
      phase: 'grace',
      phaseLabel: 'Grace period',
      expiryDate,
      gracePeriodEnd,
      redemptionPeriodEnd,
      dropDate,
    };
  }

  if (nowTime <= redemptionPeriodEnd.getTime()) {
    return {
      phase: 'redemption',
      phaseLabel: 'Redemption',
      expiryDate,
      gracePeriodEnd,
      redemptionPeriodEnd,
      dropDate,
    };
  }

  if (nowTime <= dropDate.getTime()) {
    return {
      phase: 'drop-window',
      phaseLabel: 'Drop window',
      expiryDate,
      gracePeriodEnd,
      redemptionPeriodEnd,
      dropDate,
    };
  }

  return {
    phase: 'drop-expected',
    phaseLabel: 'Drop expected',
    expiryDate,
    gracePeriodEnd,
    redemptionPeriodEnd,
    dropDate,
  };
};

export const getWhoisFailureReason = (whoisData: WhoisData): string | null => {
  if ((whoisData.status === 'registered' || whoisData.status === 'expired') && !whoisData.expirationDate) {
    return 'WHOIS provider confirmed the domain is registered, but did not return an expiry date.';
  }

  return null;
};

export const getWhoisFailureAdvice = (whoisData: WhoisData): string => {
  const attemptMessages = (whoisData.providerAttempts || [])
    .map(attempt => attempt.errorMessage || '')
    .join(' ')
    .toLowerCase();

  if (/month|monthly|free-tier/.test(attemptMessages)) {
    return 'The provider quota looks monthly-limited, so try again after the provider quota resets next month. The dashboard will keep it visible for future re-check.';
  }

  if (/day|daily/.test(attemptMessages)) {
    return 'The provider quota looks daily-limited, so try again tomorrow or after the provider daily reset.';
  }

  if (/429|too many requests|rate[\s-]?limit|per-minute|retry after|temporarily blocked/.test(attemptMessages)) {
    return 'This looks rate-limited, so try re-checking again in another minute.';
  }

  if (/missing required environment|key not provided|missing-key/.test(attemptMessages)) {
    return 'Some backup providers are not configured, so check the WHOIS provider dashboard before retrying.';
  }

  return 'Try re-checking later; the domain stays in your list so you do not need to enter it again.';
};

export const isDomainMissingWhoisData = (domain: Domain) => {
  if (!domain.last_checked || domain.status === 'unknown') return true;
  if (domain.status === 'available' || domain.status === 'dropped' || domain.status === 'reserved') return false;
  if (domain.status === 'registered' || domain.status === 'expired' || domain.tag === 'mine') {
    return !domain.expiration_date
      || !domain.registrar
      || !domain.domain_statuses
      || domain.domain_statuses.length === 0;
  }
  return false;
};

export const getDomainNotificationMessage = (domain: Domain) => {
  if (domain.tag === 'mine' && domain.expiration_date) {
    const now = new Date();
    const expiry = new Date(domain.expiration_date);
    const daysUntilExpiry = (expiry.getTime() - now.getTime()) / (1000 * 3600 * 24);
    if (daysUntilExpiry <= 0) {
      return `Your domain ${domain.domain_name} is expired. Renew it immediately if it is still recoverable.`;
    }
    if (daysUntilExpiry <= 7) {
      return `Your domain ${domain.domain_name} is expiring in ${Math.ceil(daysUntilExpiry)} days!`;
    }
  }

  if (domain.tag === 'others' && domain.expiration_date) {
    const now = new Date();
    const expiry = new Date(domain.expiration_date);
    const daysUntilExpiry = (expiry.getTime() - now.getTime()) / (1000 * 3600 * 24);
    if (daysUntilExpiry > 0 && daysUntilExpiry <= 7) {
      return `Client/other domain ${domain.domain_name} is expiring in ${Math.ceil(daysUntilExpiry)} days.`;
    }
  }

  if (domain.status === 'dropped' && domain.tag === 'to-snatch') {
    return `The domain ${domain.domain_name} has dropped and is now available to register!`;
  }

  return null;
};

export const buildDropTimelineHtml = (expirationDate: string) => {
  const estimate = getDropLifecycleEstimate(expirationDate);
  if (!estimate) return '<p class="text-slate-600 dark:text-slate-400">No valid expiry date is available for this domain.</p>';

  return `
      <p class="mb-4 text-slate-600 dark:text-slate-400"><b>Note:</b> This is an estimation based on typical domain registrar policies for .com, .net, etc. Actual dates may vary.</p>
      <ul class="space-y-3">
        <li class="flex items-start"><span class="bg-yellow-100 text-yellow-800 text-xs font-semibold mr-3 px-2.5 py-1 rounded-full dark:bg-yellow-900 dark:text-yellow-300">Expired</span><div><p class="font-semibold text-slate-800 dark:text-slate-200">Domain expired: ${formatLongDate(estimate.expiryDate)}</p><p class="text-sm text-slate-500 dark:text-slate-400">The domain is no longer active.</p></div></li>
        <li class="flex items-start"><span class="bg-orange-100 text-orange-800 text-xs font-semibold mr-3 px-2.5 py-1 rounded-full dark:bg-orange-900 dark:text-orange-300">Grace Period</span><div><p class="font-semibold text-slate-800 dark:text-slate-200">Ends around: ${formatLongDate(estimate.gracePeriodEnd)}</p><p class="text-sm text-slate-500 dark:text-slate-400">Original owner can usually renew at normal price.</p></div></li>
        <li class="flex items-start"><span class="bg-red-100 text-red-800 text-xs font-semibold mr-3 px-2.5 py-1 rounded-full dark:bg-red-900 dark:text-red-300">Redemption</span><div><p class="font-semibold text-slate-800 dark:text-slate-200">Ends around: ${formatLongDate(estimate.redemptionPeriodEnd)}</p><p class="text-sm text-slate-500 dark:text-slate-400">Owner can recover domain for a high fee.</p></div></li>
        <li class="flex items-start"><span class="bg-green-100 text-green-800 text-xs font-semibold mr-3 px-2.5 py-1 rounded-full dark:bg-green-900 dark:text-green-300">Drops</span><div><p class="font-semibold text-slate-800 dark:text-slate-200">Becomes available around: ${formatLongDate(estimate.dropDate)}</p><p class="text-sm text-slate-500 dark:text-slate-400">The domain may be released for public registration.</p></div></li>
      </ul>`;
};

export const buildDomainExport = (domains: Domain[], format: 'json' | 'csv') => {
  if (format === 'json') {
    return {
      content: JSON.stringify(domains, null, 2),
      mimeType: 'application/json',
      filename: 'domain_codev_export.json',
    };
  }

  const header = 'id,user_id,domain_name,tag,status,expiration_date,registered_date,registrar,created_at,last_checked\n';
  const rows = domains.map(d =>
    [d.id, d.user_id, d.domain_name, d.tag, d.status, d.expiration_date, d.registered_date, `"${d.registrar || ''}"`, d.created_at, d.last_checked].join(',')
  ).join('\n');

  return {
    content: header + rows,
    mimeType: 'text/csv',
    filename: 'domain_codev_export.csv',
  };
};
