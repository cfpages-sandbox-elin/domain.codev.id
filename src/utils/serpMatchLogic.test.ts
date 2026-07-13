import { describe, expect, it } from 'vitest';
import { findBestRankHit, normalizeTrackedDomain, registrableDomain } from './serpMatchLogic';

describe('serpMatchLogic', () => {
  it('normalizes multi-part Indonesian TLDs', () => {
    expect(registrableDomain('www.shop.example.co.id')).toBe('example.co.id');
    expect(normalizeTrackedDomain('https://Blog.Example.com/path')).toBe('example.com');
  });

  it('picks the best domain match from organic results', () => {
    const organic = [
      { position: 1, url: 'https://other.com/a', domain: 'other.com' },
      { position: 4, url: 'https://www.mine.id/page', domain: 'www.mine.id' },
      { position: 9, url: 'https://mine.id/other', domain: 'mine.id' },
    ];
    const hit = findBestRankHit(organic, 'mine.id', 'domain');
    expect(hit?.position).toBe(4);
  });

  it('matches registrable domain and optional subdomains', () => {
    const organic = [
      { position: 2, url: 'https://blog.mine.id/', domain: 'blog.mine.id' },
      { position: 5, url: 'https://unrelated.com/', domain: 'unrelated.com' },
    ];
    // registrable domain of blog.mine.id is mine.id, so domain mode matches too
    expect(findBestRankHit(organic, 'mine.id', 'domain')?.position).toBe(2);
    expect(findBestRankHit(organic, 'mine.id', 'subdomain')?.position).toBe(2);
    expect(findBestRankHit(organic, 'other.id', 'domain')).toBeNull();
  });
});

