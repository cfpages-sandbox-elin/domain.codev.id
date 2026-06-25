import { describe, expect, it } from 'vitest';
import { Domain } from '../types';
import { getWhoisSchedule } from './whoisSchedule';

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
  last_checked: null,
  ...overrides,
});

describe('WHOIS schedule visibility', () => {
  const now = new Date('2026-06-26T12:00:00.000Z');

  it('schedules owned domains in final renewal days daily', () => {
    const schedule = getWhoisSchedule(domain({
      expiration_date: '2026-06-26T23:59:00.000Z',
      last_checked: '2026-06-25T11:00:00.000Z',
    }), now);

    expect(schedule.cadence).toBe('Daily');
    expect(schedule.isDue).toBe(true);
    expect(schedule.reason).toContain('final renewal');
  });

  it('skips already available domains from automatic schedule buckets', () => {
    const schedule = getWhoisSchedule(domain({
      status: 'available',
      tag: 'to-snatch',
      expiration_date: null,
    }), now);

    expect(schedule.nextCheckAt).toBeNull();
    expect(schedule.cadence).toBe('Manual');
  });
});
