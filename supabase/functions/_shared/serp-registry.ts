import type { SerpProviderId, SerpProviderRegistryEntry } from './serp-types.ts';

export const SERP_PROVIDER_REGISTRY: SerpProviderRegistryEntry[] = [
  {
    id: 'serper',
    label: 'Serper',
    priority: 10,
    freeTierLabel: '~2,500 free credits (most generous)',
    monthlyFreeEstimate: 2500,
    notes: 'Google-focused JSON API. Best free volume for rotation.',
    signupUrl: 'https://serper.dev',
  },
  {
    id: 'serpapi',
    label: 'SerpAPI',
    priority: 20,
    freeTierLabel: '~250 searches/month free',
    monthlyFreeEstimate: 250,
    notes: 'Mature multi-engine docs; free plan is modest.',
    signupUrl: 'https://serpapi.com',
  },
  {
    id: 'searchapi',
    label: 'SearchAPI',
    priority: 30,
    freeTierLabel: '~100 free/month',
    monthlyFreeEstimate: 100,
    notes: 'Clean multi-engine JSON.',
    signupUrl: 'https://www.searchapi.io',
  },
  {
    id: 'valueserp',
    label: 'ValueSERP',
    priority: 40,
    freeTierLabel: '~100 free/month',
    monthlyFreeEstimate: 100,
    notes: 'Google SERP JSON API.',
    signupUrl: 'https://www.valueserp.com',
  },
  {
    id: 'scaleserp',
    label: 'ScaleSERP',
    priority: 50,
    freeTierLabel: 'Free credits (varies)',
    monthlyFreeEstimate: 50,
    notes: 'Similar family to ValueSERP.',
    signupUrl: 'https://scaleserp.com',
  },
  {
    id: 'zenserp',
    label: 'ZenSERP',
    priority: 60,
    freeTierLabel: '~50 free/month',
    monthlyFreeEstimate: 50,
    notes: 'Simple Google SERP.',
    signupUrl: 'https://zenserp.com',
  },
  {
    id: 'serpwow',
    label: 'SerpWow',
    priority: 70,
    freeTierLabel: '~100 free credits',
    monthlyFreeEstimate: 100,
    notes: 'Live SERP endpoint.',
    signupUrl: 'https://serpwow.com',
  },
  {
    id: 'serpstack',
    label: 'Serpstack',
    priority: 80,
    freeTierLabel: '~100 free/month',
    monthlyFreeEstimate: 100,
    notes: 'Lightweight Google SERP.',
    signupUrl: 'https://serpstack.com',
  },
  {
    id: 'scrapingdog',
    label: 'Scrapingdog',
    priority: 90,
    freeTierLabel: 'Free trial/credits (~100–1000)',
    monthlyFreeEstimate: 100,
    notes: 'Fast Google SERP scraper.',
    signupUrl: 'https://www.scrapingdog.com',
  },
  {
    id: 'hasdata',
    label: 'HasData',
    priority: 100,
    freeTierLabel: '~100 free/month',
    monthlyFreeEstimate: 100,
    notes: 'LLM-friendly Google SERP JSON.',
    signupUrl: 'https://hasdata.com',
  },
];

export const SERP_PROVIDER_IDS = SERP_PROVIDER_REGISTRY.map(entry => entry.id) as SerpProviderId[];

export const getSerpProviderEntry = (id: string): SerpProviderRegistryEntry | undefined =>
  SERP_PROVIDER_REGISTRY.find(entry => entry.id === id);
