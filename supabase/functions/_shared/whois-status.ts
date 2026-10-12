export type DomainStatus = 'available' | 'registered' | 'expired' | 'dropped' | 'reserved' | 'unknown';
export type DomainLifecyclePhase = 'active' | 'grace' | 'redemption' | 'pending-delete' | 'dropped' | 'available' | 'reserved' | 'unknown';

const textContainsReservedSignal = (value: unknown) => {
  if (typeof value !== 'string') return false;
  const normalized = value.toLowerCase();
  return /\breserved\b/.test(normalized)
    || /\breserved\s+name\b/.test(normalized)
    || /\bgovernment\s+reserved\b/.test(normalized)
    || /\bnot\s+available\s+for\s+registration\b/.test(normalized)
    || /\bblocked\s+from\s+registration\b/.test(normalized);
};

const collectTextSignals = (value: unknown, depth = 0): string[] => {
  if (depth > 3 || value === null || value === undefined) return [];
  if (typeof value === 'string') return [value];
  if (typeof value === 'number' || typeof value === 'boolean') return [String(value)];
  if (Array.isArray(value)) return value.flatMap(item => collectTextSignals(item, depth + 1));
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .filter(([key]) => /status|state|reason|remark|notice|description|title|message|error/i.test(key))
      .flatMap(([, item]) => collectTextSignals(item, depth + 1));
  }
  return [];
};

const hasReservedSignal = (...values: unknown[]) => collectTextSignals(values).some(textContainsReservedSignal);

export const detectEppLifecyclePhase = (evidence: unknown[]): 'pending-delete' | 'redemption' | 'grace' | null => {
  const textSignals = collectTextSignals(evidence).map(t => t.toLowerCase());
  if (textSignals.some(s => s.includes('pendingdelete') || s.includes('pending_delete') || s.includes('pending delete'))) {
    return 'pending-delete';
  }
  if (textSignals.some(s => s.includes('redemptionperiod') || s.includes('redemption_period') || s.includes('redemption period') || s.includes('restoringpostredemptionperiod'))) {
    return 'redemption';
  }
  if (textSignals.some(s => s.includes('autorenewperiod') || s.includes('auto_renew_period') || s.includes('auto-renew period') || s.includes('clienthold') || s.includes('serverhold'))) {
    return 'grace';
  }
  return null;
};

export const inferDomainStatus = (isAvailable: boolean, expiryDateStr: string | null | undefined, ...evidence: unknown[]): DomainStatus => {
  if (hasReservedSignal(evidence)) return 'reserved';
  if (isAvailable) return 'available';
  const eppPhase = detectEppLifecyclePhase(evidence);
  if (eppPhase) return 'expired';
  return expiryDateStr && new Date(expiryDateStr) < new Date() ? 'expired' : 'registered';
};

export const inferLifecycleStage = (
  status: DomainStatus,
  expiryDateStr: string | null | undefined,
  ...evidence: unknown[]
): DomainLifecyclePhase => {
  if (status === 'reserved' || hasReservedSignal(evidence)) return 'reserved';
  if (status === 'available') return 'available';
  if (status === 'dropped') return 'dropped';
  if (status === 'unknown') return 'unknown';

  const eppPhase = detectEppLifecyclePhase(evidence);
  if (eppPhase) return eppPhase;

  if (expiryDateStr && new Date(expiryDateStr).getTime() < Date.now()) {
    const daysSince = Math.floor((Date.now() - new Date(expiryDateStr).getTime()) / (1000 * 60 * 60 * 24));
    if (daysSince <= 45) return 'grace';
    if (daysSince <= 75) return 'redemption';
    return 'pending-delete';
  }

  return 'active';
};

