import { describe, expect, it } from 'vitest';
import { Domain } from '../../types';
import { getFilterMatch } from './domainListLogic';

const domain = (overrides: Partial<Domain>): Domain => ({
  id: 1,
  user_id: 'user-1',
  domain_name: 'example.com',
  tag: 'mine',
  status: 'registered',
  expiration_date: null,
  registered_date: null,
  registrar: 'Example Registrar',
  domain_statuses: ['ok'],
  name_servers: ['ns1.example.com', 'ns2.example.com'],
  created_at: '2026-01-01T00:00:00.000Z',
  last_checked: '2026-06-25T00:00:00.000Z',
  ...overrides,
});

describe('domain list expiry filters', () => {
  const now = new Date('2026-06-26T12:00:00.000Z');

  it('keeps an owned domain in Mine while also matching Expiring when expiry is today', () => {
    const expiringToday = domain({
      expiration_date: now.toISOString(),
    });

    expect(getFilterMatch(expiringToday, 'mine', now)).toBe(true);
    expect(getFilterMatch(expiringToday, 'expiring', now)).toBe(true);
    expect(getFilterMatch(expiringToday, 'expired', now)).toBe(false);
  });

  it('matches Expired from the expiry date even before saved status changes', () => {
    const expiredByDate = domain({
      status: 'registered',
      expiration_date: '2026-06-24T00:00:00.000Z',
    });

    expect(getFilterMatch(expiredByDate, 'mine', now)).toBe(true);
    expect(getFilterMatch(expiredByDate, 'expiring', now)).toBe(false);
    expect(getFilterMatch(expiredByDate, 'expired', now)).toBe(true);
  });
});
