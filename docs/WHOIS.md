# WHOIS Implementation And Provider Research

Last researched: 2026-06-06.

## Current Implementation

Current WHOIS checks are server-side through Supabase Edge Functions.

| Layer | File | Behavior |
| --- | --- | --- |
| Client call | `src/services/whoisService.ts` | Calls `supabase.functions.invoke('get-whois', { body: { domainName } })`, logs progress, and returns `unknown` on failure. |
| Authenticated lookup function | `supabase/functions/get-whois/index.ts` | Handles CORS, verifies the Supabase user from the Authorization header, validates `domainName`, calls shared logic, and returns normalized JSON. |
| Scheduled lookup function | `supabase/functions/check-domains/index.ts` | Requires `CRON_SECRET`, uses Supabase service role, scans domain metadata, checks only domains due under the targeted expiry/drop schedule, and updates status. |
| Provider selection | `supabase/functions/_shared/whois-logic.ts` | Tries configured providers with runtime quota pre-skipping and in-flight balancing across `who-dat`, WhoisXMLAPI, APILayer, WhoisFreaks, WhoAPI, WhoisJSON, IP2WHOIS, direct IANA RDAP, RDAP.org, OTI Labs, Domainduck, RDAP API, RapidAPI Domains API, and legacy RapidAPI Domain WHOIS Lookup. |

Normalized return shape:

```ts
{
  status: 'available' | 'registered' | 'expired' | 'dropped' | 'reserved' | 'unknown',
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
| RapidAPI marketplace APIs | `RAPIDAPI_KEY` |
| WhoisJSON | `WHOISJSON_API_KEY` |
| IP2WHOIS | `IP2WHOIS_API_KEY` |
| Direct IANA RDAP | No key. Uses `https://data.iana.org/rdap/dns.json` bootstrap. |
| RDAP.org | No key. Uses `https://rdap.org/domain/{domain}`. |
| OTI Labs | Stored per user in `whois_provider_credentials` as provider id `oti-labs`, Supabase secret `OTI_LABS_API_KEY` / legacy `VITE_OTI_LABS_API_KEY`, or shared RapidAPI secret `RAPIDAPI_KEY`. |
| Domainduck | Stored per user in `whois_provider_credentials` as provider id `domainduck`, or Supabase secret `DOMAINDUCK_API_KEY` / legacy `VITE_DOMAINDUCK_API_KEY`. |
| RDAP API | Stored per user in `whois_provider_credentials` as provider id `rdap-api`, or Supabase secret `RDAP_API_KEY` / legacy `VITE_RDAP_API_KEY`. |

User-entered provider keys are stored in Supabase table `whois_provider_credentials`. The browser can insert/update/delete the current user's keys, but there is intentionally no browser-readable `SELECT` policy for raw key values. Edge Functions read the keys with service-role access and return only configured/missing status to the dashboard. If both a user-stored key and Supabase secret exist, the user-stored key wins for that user's checks.

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
| Incomplete provider results | A provider response is not considered usable just because the HTTP request succeeded. If a provider says a domain is `registered` or `expired` but does not return an expiry date, the waterfall records that provider attempt as failed and continues to the next configured provider. Missing name servers alone do not make otherwise complete WHOIS data unusable. |
| Reserved domains | Provider/RDAP statuses, remarks, notices, and common text fields are scanned for conservative reserved-domain signals. A `reserved` domain is shown in the app, skipped by automatic refresh, and not treated as buyable. |
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
| `to-snatch`, 0-44 days after expiry | Check at most weekly; likely grace/redemption period. |
| `to-snatch`, 45-57 days after expiry | Check at most daily; approaching drop window. |
| `to-snatch`, 58-75 days after expiry with precise expiry/registration hour | Check hourly only inside the estimated 24-hour drop window, otherwise daily. |
| `to-snatch`, 58-75 days after expiry without precise hour | Check at most every 3 hours; likely drop date but no exact hour. |
| `to-snatch`, past 75 days after expiry but still not available | Check at most weekly. |
| Already `available`, `dropped`, or `reserved` | Skip automatic checks. User can buy available/dropped domains or manually re-check if needed; reserved domains are not expected to become buyable. |
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

Provider offers change, so verify before implementation. These were checked on 2026-06-04.

| Provider | Free tier found | Good fit | Notes | Source |
| --- | --- | --- | --- | --- |
| APILayer Whois API | 3,000 requests/month, free lifetime, no credit card listed | Strong hobby default if supported TLDs match your portfolio | Current code already supports APILayer. Verify endpoint path because docs show `whois/query` while current code uses `whois/check`. | https://apilayer.com/marketplace/whois-api |
| WhoisXMLAPI WHOIS API | 500 free WHOIS queries | Reliable fallback for parsed WHOIS data | Current code already supports this. Separate Domain Availability API docs mention a smaller free subscription, so avoid mixing quotas. | https://whois.whoisxmlapi.com/pricing |
| WhoisFreaks | 500 free API credits on signup | Useful fallback | Current code already supports live WHOIS. Credits may be one-time/lifetime rather than monthly. | https://whoisfreaks.com/pricing/api-plans |
| WhoisJSON | 1,000 requests/month, no credit card | Added backup candidate | One key covers WHOIS, DNS, SSL, availability, subdomains, and monitoring. Adapter added; needs live response validation. | https://whoisjson.com/free-domain-api |
| IP2WHOIS | 500 WHOIS domain queries/month | Added backup candidate | Adapter added; needs live response validation. | https://www.ip2whois.com/developers-api |
| JsonWhois | 250 free domain WHOIS calls/month and 500 free availability calls/month listed | Useful if availability checks are more important than full WHOIS | Not currently implemented. | https://jsonwhois.io/ |
| RapidAPI WHOIS APIs | Depends on individual marketplace API; several free Basic plans were found in the 2026-06-06 pass | Use only as backup | RapidAPI free tiers vary per provider and add marketplace dependency. Current code supports RapidAPI Domains API as a late 500/month hard-limit fallback plus the older generic RapidAPI Domain WHOIS Lookup host behind it. See `docs/RAPIDAPI_WHOIS_PROVIDERS.md` for the current candidate list and free-tier table. | https://rapidapi.com/collection/whois-api |
| Direct RDAP via IANA bootstrap | No API key; public registry RDAP services | Strong next implementation because it removes vendor dependency | RDAP gives structured JSON and is the modern replacement for WHOIS, but registry rate limits and fields vary. Cache aggressively and treat 404/429 carefully. | https://www.icann.org/rdap/ and https://www.iana.org/help/rdap-requirements |
| RDAP.org bootstrap | No API key; public bootstrap endpoint | Useful prototype/fallback before implementing full IANA bootstrap client | Single endpoint redirects to authoritative RDAP. It documents a 10 requests / 10 seconds Cloudflare limit, so this should not be used for large bulk checks. | https://about.rdap.org/ |
| RDAP API | 7-day free trial; paid plans start at 30,000 requests/month | Good commercial RDAP fallback if free providers are noisy | Normalized JSON, cached responses, bulk domain lookups, and 1,200+ TLD coverage. Not free long-term. | https://rdapapi.io/pricing |
| OTI Labs WHOIS API | 1,000 free requests/month, no credit card | Good candidate because it is RDAP-first with port-43 fallback | Uses a fallback chain across RDAP.org, IANA RDAP bootstrap, hardcoded RDAP servers, and WHOIS. Hosted on RapidAPI for keys. | https://oti-labs.com/whois-api |
| Domainduck | 2,500 free requests, no credit card, 500/hour | Good candidate for availability plus WHOIS | Supports availability and WHOIS data. Free plan omits premium marketplace pricing. | https://api.domainduck.io/ |
| Domiquo | 1,000 checks/month, no credit card listed in search result | Availability-focused candidate | RDAP-based availability API. Better for "can I buy this?" than full ownership metadata. Needs live docs/account validation before implementation. | https://domiquo.com/ |
| WHOIS.LS | Free API, no usage limits claimed | Experimental no-key fallback | Returns raw and JSON responses. Because it is a free proxy, use after official RDAP and cache results; validate reliability before trusting availability. | https://whois.ls/api |
| Whoxy | Free research package can include 250,000 WHOIS / history / reverse lookups | Not a normal hobby default | Free access is for qualifying non-commercial security/research organizations, not ordinary hobby usage. | https://www.whoxy.com/free-whois-api/ |
| Domainr / Fastly Domain Research API | Free/lower-volume path documented through API access; original Domainr API is deprecated | Availability-only candidate | Useful for domain search/status, not full WHOIS metadata. Current docs say the original Domainr API moved under Fastly and older docs are deprecated. | https://domainr.com/docs/api |
| Hexillion Whois API | Limited free web tools; API account needed for automation | Lower priority | Mature WHOIS parser with JSON/XML output, but free automated quota is not clearly advertised. | https://hexillion.com/support/reference/whois-api |

## Provider Expansion Shortlist

The project already has 8 implemented providers. To get beyond 10 without adding weak providers blindly, add these in this order:

| Priority | Provider | Why |
| --- | --- | --- |
| 1 | Direct RDAP via IANA bootstrap | No API key, structured data, official protocol path. Best quota saver if cached. |
| 2 | RDAP.org bootstrap | Fast way to validate RDAP parsing before maintaining the full bootstrap cache. |
| 3 | OTI Labs | Free monthly quota and RDAP + WHOIS fallback chain. |
| 4 | Domainduck | Useful free quota and availability + WHOIS combination. |
| 5 | JsonWhois | Small but clear free WHOIS/availability quota. |
| 6 | WHOIS.LS | No-key fallback, but should be low priority until reliability is tested. |
| 7 | RDAP API | Good paid/trial fallback if free providers are exhausted. |
| 8 | Domainr/Fastly | Use only for availability/status, not expiry/name-server metadata. |

## Recommendation

For a hobby project on Cloudflare:

1. Keep a provider waterfall, but make providers configurable.
2. Add direct RDAP support before adding more paid/free-key vendors. RDAP is the official structured replacement path and avoids one more vendor account.
3. Keep APILayer + WhoisJSON + WhoisXMLAPI because the free quotas are useful and the APIs are structured.
4. Keep WhoisFreaks as a fallback if the one-time credits are enough.
5. Add OTI Labs, Domainduck, JsonWhois, and WHOIS.LS as optional backups after the provider registry supports per-provider toggles and test calls.
6. Use provider-specific adapters that all return one normalized shape.
7. Store every check result and error in D1/Supabase so debugging does not depend on runtime logs.
8. Add a provider priority setting in code, not in the UI initially.

## Dashboard Requirement

Provider limits, implementation state, and runtime health should be visible in the app dashboard. See `docs/WHOIS_DASHBOARD.md` for the provider table, quota tracking model, and backup-provider implementation guide.

For Supabase Dashboard setup steps, including deploying `get-whois-providers` and adding `WHOISJSON_API_KEY` / `IP2WHOIS_API_KEY` through supabase.com, see the "Supabase UI Setup" section in `docs/WHOIS_DASHBOARD.md`.

For the newer RapidAPI marketplace research pass, including the 20 user-supplied provider URLs and their parsed free-tier status, see `docs/RAPIDAPI_WHOIS_PROVIDERS.md`.

## Cloudflare Worker Shape

```ts
export interface WhoisProvider {
  id: string;
  check(domain: string, env: Env): Promise<WhoisResult>;
}

export interface WhoisResult {
  provider: string;
  status: 'available' | 'registered' | 'expired' | 'dropped' | 'reserved' | 'unknown';
  expirationDate: string | null;
  registeredDate: string | null;
  registrar: string | null;
  rawStatus?: string;
}
```

Use `ctx.waitUntil()` for non-critical logging and background inserts, but update the main `app_domains` row only after a successful normalized result.
