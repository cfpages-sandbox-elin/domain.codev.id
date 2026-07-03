import { describe, expect, it } from 'vitest';
import { checkDecisionForDomain, Domain } from './scheduler';
import { DEFAULT_MONITORING_SETTINGS } from '../_shared/monitoring-settings';

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

  it('uses the balanced hourly cadence inside the active drop window', () => {
    const decision = checkDecisionForDomain(domain({
      tag: 'to-snatch',
      expiration_date: '2026-04-01T00:00:00.000Z',
      registered_date: '2024-04-01T00:00:00.000Z',
      last_checked: '2026-06-04T22:30:00.000Z',
    }), now);

    expect(decision.due).toBe(true);
    expect(decision.priority).toBe(110);
  });

  it('keeps checking targets after the estimated drop date instead of backing off weekly', () => {
    const decision = checkDecisionForDomain(domain({
      tag: 'to-snatch',
      expiration_date: '2026-04-01T00:00:00.000Z',
      registered_date: '2024-04-01T00:00:00.000Z',
      last_checked: '2026-06-20T12:30:00.000Z',
    }), new Date('2026-06-20T20:00:00.000Z'));

    expect(decision.due).toBe(true);
    expect(decision.priority).toBe(100);
  });

  it('supports aggressive 15-minute active polling and pausing', () => {
    const target = domain({
      tag: 'to-snatch',
      expiration_date: '2026-04-01T00:00:00.000Z',
      last_checked: '2026-06-04T23:40:00.000Z',
    });
    const aggressive = checkDecisionForDomain(target, now, {
      ...DEFAULT_MONITORING_SETTINGS,
      active_interval_minutes: 15,
    });
    const paused = checkDecisionForDomain(target, now, {
      ...DEFAULT_MONITORING_SETTINGS,
      enabled: false,
    });

    expect(aggressive.due).toBe(true);
    expect(aggressive.reason).toContain('15 minutes');
    expect(paused.due).toBe(false);
    expect(paused.reason).toContain('paused');
  });
});
