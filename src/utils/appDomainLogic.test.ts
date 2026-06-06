import { describe, expect, it } from 'vitest';
import { getDropLifecycleEstimate } from './appDomainLogic';

describe('getDropLifecycleEstimate', () => {
  const expiry = '2026-01-01T00:00:00.000Z';

  it('classifies the estimated post-expiry lifecycle phases', () => {
    expect(getDropLifecycleEstimate(expiry, new Date('2026-01-10T00:00:00.000Z'))?.phase).toBe('grace');
    expect(getDropLifecycleEstimate(expiry, new Date('2026-02-10T00:00:00.000Z'))?.phase).toBe('redemption');
    expect(getDropLifecycleEstimate(expiry, new Date('2026-03-03T00:00:00.000Z'))?.phase).toBe('drop-window');
    expect(getDropLifecycleEstimate(expiry, new Date('2026-03-08T00:00:00.000Z'))?.phase).toBe('drop-expected');
  });

  it('returns null for invalid expiry dates', () => {
    expect(getDropLifecycleEstimate('not-a-date')).toBeNull();
  });
});
