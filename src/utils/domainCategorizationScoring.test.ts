import { describe, expect, it } from 'vitest';
import { getMembership, getMembershipScore, makePairKey } from './domainCategorizationScoring';

describe('domain category scoring', () => {
  const knownBases = new Set(['cast', 'firm', 'lawfirm', 'precast', 'firma', 'aman', 'laman', 'taman', 'bunga', 'tabunganhajiumroh']);

  it('keeps meaningful prefix compounds in the shorter category', () => {
    const reason = getMembership('cast', 'precast', knownBases);

    expect(reason).toBe('contains');
    expect(getMembershipScore('cast', 'precast', 'contains')).toBeGreaterThanOrEqual(0.78);
  });

  it('allows minor trailing one-letter variants', () => {
    expect(getMembership('firm', 'firma', knownBases)).toBe('contains');
  });

  it('blocks leading one-letter leftovers from becoming similarity matches', () => {
    expect(getMembership('aman', 'laman', knownBases)).toBeNull();
    expect(getMembership('aman', 'taman', knownBases)).toBeNull();
  });

  it('blocks short words embedded inside a longer unrelated word', () => {
    expect(getMembership('bunga', 'tabunganhajiumroh', knownBases)).toBeNull();
  });

  it('uses symmetric cache keys for similarity scores', () => {
    expect(makePairKey('steel', 'stel')).toBe(makePairKey('stel', 'steel'));
  });
});
