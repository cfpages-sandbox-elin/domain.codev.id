import { describe, expect, it } from 'vitest';
import { checkDecisionForDomain, Domain } from './scheduler';

const now = new Date('2026-06-05T00:00:00.000Z');

const domain = (overrides: Partial<Domain>): Domain => ({
  id: 1,
  user_id: 'user-1',
  domain_name: 'example.com',
  status: 'registered',
  tag: 'to-snatch',
  expiration_date: null,
  registered_date: null,
  last_checked: '2026-06-01T00:00:00.000Z',
  ...overrides,
});

describe('targeted WHOIS cron scheduler', () => {
  it('skips terminal statuses that should not spend automatic quota', () => {
    expect(checkDecisionForDomain(domain({ status: 'reserved' }), now).due).toBe(false);
    expect(checkDecisionForDomain(domain({ status: 'available' }), now).due).toBe(false);
  });

  it('checks owned domains only at a low-noise cadence inside the expiry month', () => {
    const decision = checkDecisionForDomain(domain({
      tag: 'mine',
      expiration_date: '2026-06-25T00:00:00.000Z',
      last_checked: '2026-05-20T00:00:00.000Z',
    }), now);

    expect(decision.due).toBe(true);
    expect(decision.priority).toBe(30);
  });

  it('checks targets hourly inside a precise estimated drop-hour window', () => {
    const decision = checkDecisionForDomain(domain({
      tag: 'to-snatch',
      expiration_date: '2026-04-01T00:00:00.000Z',
      registered_date: '2024-04-01T00:00:00.000Z',
      last_checked: '2026-06-04T22:00:00.000Z',
    }), now);

    expect(decision.due).toBe(true);
    expect(decision.priority).toBe(100);
  });

  it('backs off targets that are outside the precise drop-hour window', () => {
    const decision = checkDecisionForDomain(domain({
      tag: 'to-snatch',
      expiration_date: '2026-04-01T00:00:00.000Z',
      registered_date: '2024-04-01T00:00:00.000Z',
      last_checked: '2026-06-06T02:30:00.000Z',
    }), new Date('2026-06-06T20:00:00.000Z'));

    expect(decision.due).toBe(false);
    expect(decision.priority).toBe(85);
  });
});
