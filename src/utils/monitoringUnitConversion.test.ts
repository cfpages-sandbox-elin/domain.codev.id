import { describe, expect, it } from 'vitest';
import { fromCanonicalTime, toCanonicalTime } from './monitoringUnitConversion';

describe('monitoring time unit conversion', () => {
  it('presents long hour values as readable days', () => {
    expect(fromCanonicalTime(168, 'hours', 'days')).toBe(7);
    expect(fromCanonicalTime(348, 'hours', 'days')).toBe(14.5);
  });

  it('round-trips minute cadence through hours without changing policy', () => {
    const hours = fromCanonicalTime(90, 'minutes', 'hours');
    expect(hours).toBe(1.5);
    expect(toCanonicalTime(hours, 'minutes', 'hours')).toBe(90);
  });

  it('supports fractional days while storing whole canonical hours', () => {
    expect(toCanonicalTime(1.5, 'hours', 'days')).toBe(36);
  });
});
