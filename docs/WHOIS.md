# WHOIS Implementation And Provider Research

Last researched: 2026-06-03.

## Current Implementation

Current WHOIS checks are server-side through Supabase Edge Functions.

| Layer | File | Behavior |
| --- | --- | --- |
| Client call | `src/services/whoisService.ts` | Calls `supabase.functions.invoke('get-whois', { body: { domainName } })`, logs progress, and returns `unknown` on failure. |
| Authenticated lookup function | `supabase/functions/get-whois/index.ts` | Handles CORS, verifies the Supabase user from the Authorization header, validates `domainName`, calls shared logic, and returns normalized JSON. |
| Scheduled lookup function | `supabase/functions/check-domains/index.ts` | Requires `CRON_SECRET`, uses Supabase service role, selects expired/past-expiry domains, checks WHOIS, and updates status. |
| Provider waterfall | `supabase/functions/_shared/whois-logic.ts` | Tries providers in this order: `who-dat`, WhoisXMLAPI, APILayer, WhoisFreaks, WhoAPI, RapidAPI. |

Normalized return shape:

```ts
{
  status: 'available' | 'registered' | 'expired' | 'dropped' | 'unknown',
  expirationDate: string | null,
  registeredDate: string | null,
  registrar: string | null
}
```

## Current Provider Environment Variables

| Provider | Env var(s) |
| --- | --- |
| `who-dat` | `WHO_DAT_URL`, `WHO_DAT_AUTH_KEY` |
| WhoisXMLAPI | `WHOIS_API_KEY` |
| APILayer | `APILAYER_API_KEY` |
| WhoisFreaks | `WHOISFREAKS_API_KEY` |
| WhoAPI | `WHOAPI_COM_API_KEY` |
| RapidAPI marketplace API | `RAPIDAPI_KEY` |

## Current Implementation Risks

| Risk | Detail | Fix |
| --- | --- | --- |
| Provider failures are only logged | The app stores `unknown` but not which provider failed or why. | Store provider attempts in `app_domain_checks`. |
| No rate-limit accounting | Bulk add can consume API credits quickly. | Track per-provider daily counters or implement queue throttling. |
| Availability vs WHOIS varies | Some APIs have separate domain availability endpoints and WHOIS endpoints. | Prefer availability endpoint for new target checks, WHOIS endpoint for owned domain metadata. |
| `dropped` is inferred | Current code marks `dropped` only in scheduled checks when a previously expired domain becomes available. | Keep transition history so `dropped` is based on previous tracked state, not just live provider response. |

## Free-Tier Provider Research

Provider offers change, so verify before implementation. These were checked on 2026-06-03.

| Provider | Free tier found | Good fit | Notes | Source |
| --- | --- | --- | --- | --- |
| APILayer Whois API | 3,000 requests/month, free lifetime, no credit card listed | Strong hobby default if supported TLDs match your portfolio | Current code already supports APILayer. Verify endpoint path because docs show `whois/query` while current code uses `whois/check`. | https://apilayer.com/marketplace/whois-api |
| WhoisXMLAPI WHOIS API | 500 free WHOIS queries | Reliable fallback for parsed WHOIS data | Current code already supports this. Separate Domain Availability API docs mention a smaller free subscription, so avoid mixing quotas. | https://whois.whoisxmlapi.com/pricing |
| WhoisFreaks | 500 free API credits on signup | Useful fallback | Current code already supports live WHOIS. Credits may be one-time/lifetime rather than monthly. | https://whoisfreaks.com/pricing/api-plans |
| WhoisJSON | 1,000 requests/month, no credit card | Good candidate to add | One key covers WHOIS, DNS, SSL, availability, subdomains, and monitoring. Not currently implemented. | https://whoisjson.com/free-domain-api |
| IP2WHOIS | 500 WHOIS domain queries/month | Simple fallback candidate | Not currently implemented. Check response shape before adding. | https://www.ip2whois.com/developers-api |
| JsonWhois | 250 free domain WHOIS calls/month and 500 free availability calls/month listed | Useful if availability checks are more important than full WHOIS | Not currently implemented. | https://jsonwhois.io/ |
| RapidAPI WHOIS APIs | Depends on individual marketplace API | Use only as backup | RapidAPI free tiers vary per provider and add marketplace dependency. Current code supports one RapidAPI host. | https://rapidapi.com/collection/whois-api |

## Recommendation

For a hobby project on Cloudflare:

1. Keep a provider waterfall, but make providers configurable.
2. Start with APILayer + WhoisJSON + WhoisXMLAPI because the free quotas are useful and the APIs are structured.
3. Keep WhoisFreaks as a fallback if the one-time credits are enough.
4. Use provider-specific adapters that all return one normalized shape.
5. Store every check result and error in D1 so debugging does not depend on runtime logs.
6. Add a provider priority setting in code, not in the UI initially.

## Dashboard Requirement

Provider limits, implementation state, and runtime health should be visible in the app dashboard. See `docs/WHOIS_DASHBOARD.md` for the provider table, quota tracking model, and backup-provider implementation guide.

## Cloudflare Worker Shape

```ts
export interface WhoisProvider {
  id: string;
  check(domain: string, env: Env): Promise<WhoisResult>;
}

export interface WhoisResult {
  provider: string;
  status: 'available' | 'registered' | 'expired' | 'dropped' | 'unknown';
  expirationDate: string | null;
  registeredDate: string | null;
  registrar: string | null;
  rawStatus?: string;
}
```

Use `ctx.waitUntil()` for non-critical logging and background inserts, but update the main `app_domains` row only after a successful normalized result.
