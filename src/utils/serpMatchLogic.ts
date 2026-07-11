/** Client-side copy of SERP domain matching for tests and UI helpers. */

const stripWww = (host: string) => host.replace(/^www\./i, '').toLowerCase();

export const extractHostname = (url: string): string | null => {
  try {
    return stripWww(new URL(url).hostname);
  } catch {
    return null;
  }
};

export const registrableDomain = (hostname: string): string => {
  const host = stripWww(hostname);
  const parts = host.split('.').filter(Boolean);
  if (parts.length <= 2) return host;
  const multiPartTlds = new Set([
    'co.id', 'or.id', 'go.id', 'ac.id', 'sch.id', 'web.id', 'my.id', 'biz.id',
    'co.uk', 'org.uk', 'ac.uk', 'gov.uk',
    'com.au', 'net.au', 'org.au',
    'co.jp', 'ne.jp', 'or.jp',
    'com.br', 'com.sg', 'com.my',
  ]);
  const lastTwo = `${parts[parts.length - 2]}.${parts[parts.length - 1]}`;
  if (multiPartTlds.has(lastTwo) && parts.length >= 3) {
    return `${parts[parts.length - 3]}.${lastTwo}`;
  }
  return lastTwo;
};

export const normalizeTrackedDomain = (domainName: string): string =>
  registrableDomain(domainName.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0]);

export type RankMatchMode = 'domain' | 'subdomain' | 'exact_url' | 'prefix';

export type SerpOrganicHit = {
  position: number;
  url: string;
  domain: string;
  title?: string;
};

export const findBestRankHit = (
  organic: SerpOrganicHit[],
  domainName: string,
  matchMode: RankMatchMode = 'domain',
  targetUrl?: string | null,
): SerpOrganicHit | null => {
  const tracked = normalizeTrackedDomain(domainName);
  let best: SerpOrganicHit | null = null;

  for (const hit of organic) {
    const hitHost = hit.domain ? stripWww(hit.domain) : extractHostname(hit.url);
    if (!hitHost && matchMode !== 'exact_url' && matchMode !== 'prefix') continue;

    let matches = false;
    if (matchMode === 'domain') {
      matches = Boolean(hitHost && registrableDomain(hitHost) === tracked);
    } else if (matchMode === 'subdomain') {
      matches = Boolean(hitHost && (hitHost === tracked || hitHost.endsWith(`.${tracked}`)));
    } else if (matchMode === 'exact_url') {
      if (!targetUrl) continue;
      matches = hit.url.replace(/\/$/, '') === targetUrl.replace(/\/$/, '');
    } else if (matchMode === 'prefix') {
      if (!targetUrl) continue;
      matches = hit.url.startsWith(targetUrl);
    }

    if (!matches) continue;
    if (!best || hit.position < best.position) best = hit;
  }

  return best;
};
