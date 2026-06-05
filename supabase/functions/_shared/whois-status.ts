export type DomainStatus = 'available' | 'registered' | 'expired' | 'dropped' | 'reserved' | 'unknown';

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

export const inferDomainStatus = (isAvailable: boolean, expiryDateStr: string | null | undefined, ...evidence: unknown[]): DomainStatus => {
  if (hasReservedSignal(evidence)) return 'reserved';
  if (isAvailable) return 'available';
  return expiryDateStr && new Date(expiryDateStr) < new Date() ? 'expired' : 'registered';
};
