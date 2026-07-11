import type { SerpFetchInput, SerpFetchResult, SerpOrganicHit, SerpProviderId } from './serp-types.ts';
import { extractHostname, registrableDomain } from './serp-match.ts';

const DEFAULT_DEPTH = 100;

const toOrganic = (items: Array<Record<string, unknown>>, positionKey = 'position'): SerpOrganicHit[] => {
  const organic: SerpOrganicHit[] = [];
  for (const [index, item] of items.entries()) {
    const url = String(item.link || item.url || item.displayed_link || '').trim();
    if (!url) continue;
    const host = extractHostname(url) || '';
    const position = Number(item[positionKey] ?? item.rank ?? item.position ?? index + 1);
    organic.push({
      position: Number.isFinite(position) && position > 0 ? position : index + 1,
      url,
      domain: host ? registrableDomain(host) : host,
      title: item.title ? String(item.title) : undefined,
      snippet: item.snippet || item.description ? String(item.snippet || item.description) : undefined,
    });
  }
  return organic.sort((a, b) => a.position - b.position);
};

const glFromLocale = (locale: string) => locale.split('-')[0]?.toLowerCase() || 'id';
const hlFromLocale = (locale: string) => locale.split('-')[0]?.toLowerCase() || 'id';

const fetchJson = async (url: string, init?: RequestInit) => {
  const response = await fetch(url, init);
  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!response.ok) {
    const message = typeof data === 'object' && data && 'error' in data
      ? String((data as { error: unknown }).error)
      : `HTTP ${response.status}`;
    throw new Error(message);
  }
  return data as Record<string, unknown>;
};

type Adapter = (input: SerpFetchInput) => Promise<SerpFetchResult>;

const serper: Adapter = async (input) => {
  const depth = input.depth ?? DEFAULT_DEPTH;
  const data = await fetchJson('https://google.serper.dev/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': input.apiKey,
    },
    body: JSON.stringify({
      q: input.keyword,
      gl: glFromLocale(input.locale),
      hl: hlFromLocale(input.locale),
      num: Math.min(depth, 100),
      ...(input.location ? { location: input.location } : {}),
    }),
  });
  const organic = toOrganic(Array.isArray(data.organic) ? data.organic as Array<Record<string, unknown>> : []);
  return { provider: 'serper', organic };
};

const serpapi: Adapter = async (input) => {
  const depth = input.depth ?? DEFAULT_DEPTH;
  const params = new URLSearchParams({
    engine: 'google',
    q: input.keyword,
    api_key: input.apiKey,
    gl: glFromLocale(input.locale),
    hl: hlFromLocale(input.locale),
    num: String(Math.min(depth, 100)),
  });
  if (input.device === 'mobile') params.set('device', 'mobile');
  if (input.location) params.set('location', input.location);
  const data = await fetchJson(`https://serpapi.com/search.json?${params}`);
  const organic = toOrganic(
    Array.isArray(data.organic_results) ? data.organic_results as Array<Record<string, unknown>> : [],
  );
  return { provider: 'serpapi', organic };
};

const searchapi: Adapter = async (input) => {
  const depth = input.depth ?? DEFAULT_DEPTH;
  const params = new URLSearchParams({
    engine: 'google',
    q: input.keyword,
    api_key: input.apiKey,
    gl: glFromLocale(input.locale),
    hl: hlFromLocale(input.locale),
    num: String(Math.min(depth, 100)),
  });
  if (input.device === 'mobile') params.set('device', 'mobile');
  if (input.location) params.set('location', input.location);
  const data = await fetchJson(`https://www.searchapi.io/api/v1/search?${params}`);
  const organic = toOrganic(
    Array.isArray(data.organic_results) ? data.organic_results as Array<Record<string, unknown>> : [],
  );
  return { provider: 'searchapi', organic };
};

const valueserp: Adapter = async (input) => {
  const depth = input.depth ?? DEFAULT_DEPTH;
  const params = new URLSearchParams({
    api_key: input.apiKey,
    q: input.keyword,
    gl: glFromLocale(input.locale),
    hl: hlFromLocale(input.locale),
    num: String(Math.min(depth, 100)),
  });
  if (input.device === 'mobile') params.set('device', 'mobile');
  if (input.location) params.set('location', input.location);
  const data = await fetchJson(`https://api.valueserp.com/search?${params}`);
  const organic = toOrganic(
    Array.isArray(data.organic_results) ? data.organic_results as Array<Record<string, unknown>> : [],
  );
  return { provider: 'valueserp', organic };
};

const scaleserp: Adapter = async (input) => {
  const depth = input.depth ?? DEFAULT_DEPTH;
  const params = new URLSearchParams({
    api_key: input.apiKey,
    q: input.keyword,
    gl: glFromLocale(input.locale),
    hl: hlFromLocale(input.locale),
    num: String(Math.min(depth, 100)),
  });
  if (input.device === 'mobile') params.set('device', 'mobile');
  if (input.location) params.set('location', input.location);
  const data = await fetchJson(`https://api.scaleserp.com/search?${params}`);
  const organic = toOrganic(
    Array.isArray(data.organic_results) ? data.organic_results as Array<Record<string, unknown>> : [],
  );
  return { provider: 'scaleserp', organic };
};

const zenserp: Adapter = async (input) => {
  const depth = input.depth ?? DEFAULT_DEPTH;
  const params = new URLSearchParams({
    apikey: input.apiKey,
    q: input.keyword,
    gl: glFromLocale(input.locale),
    hl: hlFromLocale(input.locale),
    num: String(Math.min(depth, 100)),
  });
  if (input.device === 'mobile') params.set('device', 'mobile');
  if (input.location) params.set('location', input.location);
  const data = await fetchJson(`https://app.zenserp.com/api/v2/search?${params}`);
  const organic = toOrganic(
    Array.isArray(data.organic) ? data.organic as Array<Record<string, unknown>> : [],
  );
  return { provider: 'zenserp', organic };
};

const serpwow: Adapter = async (input) => {
  const depth = input.depth ?? DEFAULT_DEPTH;
  const params = new URLSearchParams({
    api_key: input.apiKey,
    q: input.keyword,
    gl: glFromLocale(input.locale),
    hl: hlFromLocale(input.locale),
    num: String(Math.min(depth, 100)),
  });
  if (input.device === 'mobile') params.set('device', 'mobile');
  if (input.location) params.set('location', input.location);
  const data = await fetchJson(`https://api.serpwow.com/live/search?${params}`);
  const organic = toOrganic(
    Array.isArray(data.organic_results) ? data.organic_results as Array<Record<string, unknown>> : [],
  );
  return { provider: 'serpwow', organic };
};

const serpstack: Adapter = async (input) => {
  const depth = input.depth ?? DEFAULT_DEPTH;
  const params = new URLSearchParams({
    access_key: input.apiKey,
    query: input.keyword,
    gl: glFromLocale(input.locale),
    hl: hlFromLocale(input.locale),
    num: String(Math.min(depth, 100)),
  });
  if (input.device === 'mobile') params.set('device', 'mobile');
  if (input.location) params.set('location', input.location);
  const data = await fetchJson(`https://api.serpstack.com/search?${params}`);
  const organic = toOrganic(
    Array.isArray(data.organic_results) ? data.organic_results as Array<Record<string, unknown>> : [],
  );
  return { provider: 'serpstack', organic };
};

const scrapingdog: Adapter = async (input) => {
  const depth = input.depth ?? DEFAULT_DEPTH;
  const params = new URLSearchParams({
    api_key: input.apiKey,
    query: input.keyword,
    results: String(Math.min(depth, 100)),
    country: glFromLocale(input.locale),
  });
  if (input.device === 'mobile') params.set('domain', 'google.com');
  const data = await fetchJson(`https://api.scrapingdog.com/google?${params}`);
  const list = Array.isArray(data.organic_results)
    ? data.organic_results
    : Array.isArray(data.organic)
      ? data.organic
      : [];
  const organic = toOrganic(list as Array<Record<string, unknown>>);
  return { provider: 'scrapingdog', organic };
};

const hasdata: Adapter = async (input) => {
  const depth = input.depth ?? DEFAULT_DEPTH;
  const params = new URLSearchParams({
    q: input.keyword,
    gl: glFromLocale(input.locale),
    hl: hlFromLocale(input.locale),
    num: String(Math.min(depth, 100)),
  });
  if (input.device === 'mobile') params.set('device', 'mobile');
  if (input.location) params.set('location', input.location);
  const data = await fetchJson(`https://api.hasdata.com/scrape/google/serp?${params}`, {
    headers: { 'x-api-key': input.apiKey },
  });
  const list = Array.isArray(data.organic)
    ? data.organic
    : Array.isArray(data.organicResults)
      ? data.organicResults
      : Array.isArray(data.organic_results)
        ? data.organic_results
        : [];
  const organic = toOrganic(list as Array<Record<string, unknown>>);
  return { provider: 'hasdata', organic };
};

export const SERP_ADAPTERS: Record<SerpProviderId, Adapter> = {
  serper,
  serpapi,
  searchapi,
  valueserp,
  scaleserp,
  zenserp,
  serpwow,
  serpstack,
  scrapingdog,
  hasdata,
};
