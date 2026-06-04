# WHOIS Implementation And Provider Research

Last researched: 2026-06-03.

## Current Implementation

Current WHOIS checks are server-side through Supabase Edge Functions.

| Layer | File | Behavior |
| --- | --- | --- |
| Client call | `src/services/whoisService.ts` | Calls `supabase.functions.invoke('get-whois', { body: { domainName } })`, logs progress, and returns `unknown` on failure. |
| Authenticated lookup function | `supabase/functions/get-whois/index.ts` | Handles CORS, verifies the Supabase user from the Authorization header, validates `domainName`, calls shared logic, and returns normalized JSON. |
| Scheduled lookup function | `supabase/functions/check-domains/index.ts` | Requires `CRON_SECRET`, uses Supabase service role, scans domain metadata, checks only domains due under the targeted expiry/drop schedule, and updates status. |
| Provider selection | `supabase/functions/_shared/whois-logic.ts` | Tries configured providers with runtime quota pre-skipping and in-flight balancing across `who-dat`, WhoisXMLAPI, APILayer, WhoisFreaks, WhoAPI, RapidAPI, WhoisJSON, and IP2WHOIS. |

Normalized return shape:

```ts
{
  status: 'available' | 'registered' | 'expired' | 'dropped' | 'unknown',
  expirationDate: string | null,
  registeredDate: string | null,
  registrar: string | null,
  domainStatuses?: string[],
  nameServers?: string[]
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
| WhoisJSON | `WHOISJSON_API_KEY` |
| IP2WHOIS | `IP2WHOIS_API_KEY` |

## Runtime Quota And Bulk Behavior

The current implementation uses `whois_provider_telemetry` when the Supabase migration has been applied. If the table or RPC is missing, the Edge Function logs a warning and falls back to warm-runtime telemetry only.

| Behavior | Current implementation |
| --- | --- |
| Provider balancing | Concurrent checks prefer providers with fewer in-flight requests, then fall back to provider priority. This helps bulk imports spread across configured providers instead of hammering only the first provider. |
| Missing keys | Skipped before making a request. |
| Per-minute limits | Coordinated through `claim_whois_provider_attempt(...)` using the `recent_starts` array in `whois_provider_telemetry`. WhoisJSON is capped at 20 requests/minute; other providers use conservative caps until their exact per-minute limits are confirmed. |
| Monthly free-tier estimates | Coordinated through `whois_provider_telemetry.estimated_month_used` for providers with known free monthly limits. |
| Quota headers | APILayer quota headers are read, persisted in `quota`, and exposed in the dashboard when present. If remaining day/month quota reaches zero, that provider is skipped until the next UTC day/month. |
| 429/rate-limit failures | Persist a temporary provider block for 60 seconds and try the next provider. |
| Incomplete provider results | A provider response is not considered usable just because the HTTP request succeeded. If a provider says a domain is `registered` or `expired` but does not return an expiry date, the waterfall records that provider attempt as failed and continues to the next configured provider. |
| Bulk add concurrency | Browser bulk add now uses a 6-worker pool instead of 5-domain batches with a fixed 2-second delay. Six is chosen to stay compatible with Cloudflare Workers/Pages' documented simultaneous outgoing connection limit when this flow later moves server-side. |

The current Supabase schema for provider telemetry is in `supabase/migrations/20260603222500_add_whois_provider_telemetry.sql`. The future D1 migration should port the same concept to D1 or a Durable Object if strict global coordination becomes necessary.

## Targeted Scheduled Check Policy

The cron function may run often, but it does not spend WHOIS quota on every domain. It first reads domain metadata and only calls WHOIS for rows that are due.

| Domain condition | Automatic WHOIS behavior |
| --- | --- |
| Any domain with a known expiry more than 30 days away | Skip. The date is already known, so checking is wasteful. |
| `mine`, 30-15 days before expiry | Check only if it has been at least 14 days since the last check. |
| `mine`, 14-8 days before expiry | Check only if it has been at least 7 days since the last check. |
| `mine`, 7-4 days before expiry | Check only if it has been at least 3 days since the last check. |
| `mine`, final 3 days or expired | Check at most daily. The app should emphasize renewal, not drop chasing. |
| `others`, within the expiry month | Use the same low-noise confirmation schedule as `mine`, but treat it as client/third-party monitoring rather than the user's own renewal queue. |
| `to-snatch`, 30-15 days before expiry | Check only if it has been at least 14 days since the last check. |
| `to-snatch`, 14-8 days before expiry | Check only if it has been at least 7 days since the last check. |
| `to-snatch`, final 7 days before expiry | Check at most daily. |
| `to-snatch`, 0-44 days after expiry | Check at most daily; likely grace/redemption period. |
| `to-snatch`, 45-57 days after expiry | Check at most twice daily; approaching drop window. |
| `to-snatch`, 58-75 days after expiry | Check at most every 3 hours; likely drop window. |
| `to-snatch`, past 75 days after expiry but still not available | Check at most daily. |
| Already `available` or `dropped` | Skip automatic checks. User can buy or manually re-check. |
| Missing expiry | Retry weekly if `unknown`, otherwise monthly. |

The cron run is capped by `WHOIS_CRON_MAX_CHECKS`, default `50`, and processes due domains with concurrency `6`.

## Current Implementation Risks

| Risk | Detail | Fix |
| --- | --- | --- |
| Provider failures are only logged | The app stores `unknown` but not which provider failed or why. | Store provider attempts in `app_domain_checks`. |
| Telemetry migration must be applied | Persistent provider pre-skipping only works after `whois_provider_telemetry` and `claim_whois_provider_attempt(...)` exist in Supabase. | Apply the SQL migration in Supabase SQL Editor or through `supabase db push` with the DB password. |
| Availability vs WHOIS varies | Some APIs have separate domain availability endpoints and WHOIS endpoints. | Prefer availability endpoint for new target checks, WHOIS endpoint for owned domain metadata. |
| `dropped` is inferred | Current code marks `dropped` only in scheduled checks when a previously expired domain becomes available. | Keep transition history so `dropped` is based on previous tracked state, not just live provider response. |

## Free-Tier Provider Research

Provider offers change, so verify before implementation. These were checked on 2026-06-03.

| Provider | Free tier found | Good fit | Notes | Source |
| --- | --- | --- | --- | --- |
| APILayer Whois API | 3,000 requests/month, free lifetime, no credit card listed | Strong hobby default if supported TLDs match your portfolio | Current code already supports APILayer. Verify endpoint path because docs show `whois/query` while current code uses `whois/check`. | https://apilayer.com/marketplace/whois-api |
| WhoisXMLAPI WHOIS API | 500 free WHOIS queries | Reliable fallback for parsed WHOIS data | Current code already supports this. Separate Domain Availability API docs mention a smaller free subscription, so avoid mixing quotas. | https://whois.whoisxmlapi.com/pricing |
| WhoisFreaks | 500 free API credits on signup | Useful fallback | Current code already supports live WHOIS. Credits may be one-time/lifetime rather than monthly. | https://whoisfreaks.com/pricing/api-plans |
| WhoisJSON | 1,000 requests/month, no credit card | Added backup candidate | One key covers WHOIS, DNS, SSL, availability, subdomains, and monitoring. Adapter added; needs live response validation. | https://whoisjson.com/free-domain-api |
| IP2WHOIS | 500 WHOIS domain queries/month | Added backup candidate | Adapter added; needs live response validation. | https://www.ip2whois.com/developers-api |
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

For Supabase Dashboard setup steps, including deploying `get-whois-providers` and adding `WHOISJSON_API_KEY` / `IP2WHOIS_API_KEY` through supabase.com, see the "Supabase UI Setup" section in `docs/WHOIS_DASHBOARD.md`.

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
