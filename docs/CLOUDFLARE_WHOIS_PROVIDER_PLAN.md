# Cloudflare Mini WHOIS Provider Plan

Last updated: 2026-06-04 WIB

This document plans a Cloudflare-native WHOIS/RDAP provider that can act as a `who-dat` alternative for this project while staying friendly to Cloudflare free-tier services.

## Goal

Build a small provider hosted on Cloudflare Workers that returns normalized domain registration data for this app:

- availability / registration status
- expiry date
- registration date
- registrar
- registry status values
- name servers
- provider attempts and retry guidance

The provider should be good enough for a hobby domain tracker and should prioritize quota saving, retryability, and predictable data over broad commercial WHOIS coverage.

## Why Not Deploy `who-dat` Directly To Cloudflare

`who-dat` is a good reference, but it is not a drop-in Cloudflare Worker app.

| Finding | Impact |
| --- | --- |
| `who-dat` is a Go HTTP service. | Cloudflare Workers run JavaScript/TypeScript and WebAssembly, but a normal Go HTTP server is not a direct deploy target. |
| `who-dat` depends on `github.com/likexian/whois` and `github.com/likexian/whois-parser`. | That stack expects normal Go networking and parsing behavior. Porting it to Workers would be a rewrite, not a deployment. |
| Legacy WHOIS uses raw TCP port 43. | Workers support outbound TCP through `cloudflare:sockets`, but that API is specific to the Workers runtime and must be used from Worker code. |
| `who-dat` official deployment paths are Vercel, Docker, binary, or source build. | These are better for upstream `who-dat`; Cloudflare requires a purpose-built provider. |

Conclusion: build a Worker-native mini provider instead of trying to force upstream `who-dat` into Workers.

## What To Learn From `who-dat`

`who-dat` has the right high-level shape:

1. Accept a domain query through HTTP.
2. Query RDAP where available.
3. Fall back to legacy WHOIS where needed.
4. Normalize inconsistent provider output into one stable JSON shape.
5. Support single-domain and bulk-domain lookup.
6. Optionally protect the service with an auth key.

We should keep those ideas, but change the implementation to match Cloudflare:

- use `fetch()` for RDAP and DNS-over-HTTPS
- use `cloudflare:sockets` only for legacy WHOIS fallback
- cache IANA bootstrap data and successful domain results
- persist telemetry in D1
- expose a stable response shape matching this app's `WhoisData`

## Weaknesses To Improve

| Weakness in generic `who-dat` style | Improvement for this project |
| --- | --- |
| Broad general-purpose service may spend work on fields this app does not need. | Only normalize fields needed by the domain tracker. |
| A syntactically successful provider response may still be incomplete. | Treat registered/expired domains without expiry as unusable, then continue fallback. |
| Public/self-hosted API can be called by anyone if no auth is set. | Require `CF_WHOIS_AUTH_KEY` by default. |
| Legacy WHOIS parsing is hard and inconsistent. | Prefer RDAP and registrar/registry-specific structured fields; use WHOIS only for TLDs lacking usable RDAP. |
| Repeated checks can waste quota or trigger registry rate limits. | Use KV/D1 cache and targeted retry policy. |
| Multi-domain lookup can hammer one registry endpoint. | Apply per-host concurrency and backoff. |
| Public provider health is opaque. | Return provider attempt metadata and persist telemetry for dashboard display. |

## Cloudflare Services

| Service | Role | Free-tier fit |
| --- | --- | --- |
| Workers | HTTP API and scheduled checks. | Good for small request volume. |
| D1 | Provider telemetry, failed checks, retry scheduling, optional cached normalized results. | Good fit for relational state and dashboard visibility. |
| KV | IANA RDAP bootstrap cache and short-lived domain result cache. | Good fit for low-write, high-read cache. |
| Cron Triggers | Refresh bootstrap and retry failed/near-expiry domains. | Good fit, low frequency. |
| Secrets | Auth key and config. | Required. |
| `cloudflare:sockets` | Legacy WHOIS fallback over TCP port 43. | Use sparingly; each socket counts as an open connection. |

## Proposed API

Base Worker URL:

```txt
https://whois.domain-codev.workers.dev
```

Authentication:

```txt
Authorization: Bearer CF_WHOIS_AUTH_KEY
```

### `GET /v1/whois/:domain`

Returns normalized WHOIS/RDAP data.

Example response:

```json
{
  "domainName": "example.com",
  "status": "registered",
  "expirationDate": "2026-01-13T00:00:00Z",
  "registeredDate": "1995-08-14T00:00:00Z",
  "registrar": "Example Registrar",
  "domainStatuses": ["clientTransferProhibited"],
  "nameServers": ["a.iana-servers.net", "b.iana-servers.net"],
  "source": "rdap",
  "provider": "cloudflare-mini-whois",
  "attempts": [
    {
      "source": "rdap",
      "status": "success",
      "endpoint": "https://rdap.verisign.com/com/v1/domain/example.com"
    }
  ],
  "cache": {
    "hit": false,
    "ttlSeconds": 86400
  }
}
```

### `POST /v1/whois/bulk`

Input:

```json
{
  "domains": ["example.com", "example.net"]
}
```

Output:

```json
{
  "results": [
    { "domainName": "example.com", "status": "registered" },
    { "domainName": "example.net", "status": "registered" }
  ],
  "skipped": []
}
```

Bulk endpoint should cap input, for example 25 domains per request, and process with conservative per-host concurrency.

### `GET /v1/status`

Returns provider health, cache state, and recent retry blocks.

## Normalized Status Rules

| Input signal | Normalized status |
| --- | --- |
| RDAP 404 / known not-found response | `available` |
| RDAP object exists with future expiry | `registered` |
| RDAP object exists with expiry in the past | `expired` |
| WHOIS text contains known availability marker | `available` |
| WHOIS text contains domain object but no expiry | `unknown` unless a fallback returns expiry |
| All sources fail | `unknown` with retry advice |

Important rule: do not return `registered` without an expiry date unless the response explicitly marks the field as unavailable and all fallbacks have failed. In that case return `unknown`, not `registered`.

## Resolution Pipeline

1. Validate and normalize domain.
2. Check short-lived domain cache.
3. Resolve RDAP endpoint:
   - load `https://data.iana.org/rdap/dns.json` from KV
   - if cache missing/stale, fetch and refresh
   - choose endpoint by TLD
4. Query RDAP endpoint:
   - `GET {base}/domain/{domain}`
   - follow redirects
   - parse structured JSON
5. If RDAP fails or incomplete:
   - try known TLD-specific fallback rules
   - use legacy WHOIS over `cloudflare:sockets` only when needed
6. Normalize data.
7. Validate result completeness.
8. Persist telemetry.
9. Cache usable results.
10. Return normalized response.

## RDAP Parsing Plan

Fields to extract:

| App field | RDAP source |
| --- | --- |
| `expirationDate` | event where `eventAction` is `expiration` |
| `registeredDate` | event where `eventAction` is `registration` |
| `registrar` | entity with registrar role, or remarks/notices fallback |
| `domainStatuses` | top-level `status` array |
| `nameServers` | `nameservers[].ldhName` |

RDAP dates should be normalized to ISO strings. Name servers should be lowercased and trailing dots removed.

## Legacy WHOIS Fallback Plan

Use TCP only when:

- RDAP bootstrap has no endpoint for the TLD
- RDAP returns an unsupported error
- RDAP returns object data but no expiry date
- app needs availability for a TLD where RDAP is unreliable

Implementation strategy:

1. Maintain a small TLD map:
   - `.com`, `.net`: `whois.verisign-grs.com`
   - `.org`: `whois.pir.org`
   - `.id`, `.co.id`: research and configure carefully before enabling
2. Connect with `cloudflare:sockets`.
3. Write query plus CRLF.
4. Read response with timeout and max byte limit.
5. Parse with conservative regexes:
   - expiry date labels: `Registry Expiry Date`, `Expiration Date`, `Expiry Date`, `expires`
   - creation date labels: `Creation Date`, `Created On`, `Registered On`
   - registrar labels: `Registrar`, `Sponsoring Registrar`
   - status labels: `Domain Status`, `Status`
   - name server labels: `Name Server`, `Nserver`
6. Detect known availability markers per TLD.

Do not try to parse every possible WHOIS format initially. Start with TLDs this project actually tracks.

## Indonesian TLD Notes

This app tracks `.id` and `.co.id` domains, so Indonesia-specific handling matters.

Plan:

1. Research current authoritative RDAP/WHOIS source for `.id`.
2. Add `.id` and `.co.id` to an explicit fallback config.
3. Validate with known domains:
   - one registered `.id`
   - one registered `.co.id`
   - one available `.id`
   - one available `.co.id`
4. Only enable availability decisions when the not-found marker is confirmed.

Until this is validated, `.id` and `.co.id` should be allowed to return `unknown` instead of making unsafe `available` claims.

## Cache Strategy

| Data | Store | TTL |
| --- | --- | --- |
| IANA RDAP bootstrap | KV | 7 days |
| Successful registered domain result | KV or D1 | until 30 days before expiry, max 30 days |
| Available target domain result | KV | 6-24 hours |
| Failed/rate-limited result | D1 | retry-after based |
| TLD fallback config | code first, D1 later | deploy-controlled |

For this project, D1 is better for anything the dashboard should inspect. KV is better for bootstrap and fast cache reads.

## D1 Tables

```sql
create table cf_whois_provider_checks (
  id integer primary key autoincrement,
  domain_name text not null,
  status text not null,
  source text not null,
  endpoint text,
  error_message text,
  retry_after text,
  created_at text not null default current_timestamp
);

create table cf_whois_domain_cache (
  domain_name text primary key,
  status text not null,
  expiration_date text,
  registered_date text,
  registrar text,
  domain_statuses text,
  name_servers text,
  source text not null,
  expires_at text not null,
  updated_at text not null default current_timestamp
);

create table cf_whois_tld_config (
  suffix text primary key,
  rdap_enabled integer not null default 1,
  whois_enabled integer not null default 0,
  whois_server text,
  availability_patterns text,
  notes text,
  updated_at text not null default current_timestamp
);
```

Store arrays as JSON text in D1 initially.

## Worker Module Structure

```txt
src/
  index.ts
  auth.ts
  domain.ts
  cache.ts
  rdap/
    bootstrap.ts
    client.ts
    normalize.ts
  whois/
    sockets.ts
    parser.ts
    tld-config.ts
  telemetry.ts
  response.ts
```

## Integration With Current App

Current Supabase Edge Function provider registry should add a new provider before paid/free API providers:

```txt
cloudflare-mini-whois
```

Secrets:

```txt
CF_WHOIS_URL=https://whois.domain-codev.workers.dev
CF_WHOIS_AUTH_KEY=...
```

Provider order:

1. `cloudflare-mini-whois`
2. `who-dat` if self-hosted
3. WhoisXMLAPI
4. APILayer
5. WhoisFreaks
6. WhoisJSON
7. IP2WHOIS

The current server-side waterfall already supports provider attempts, incomplete-result rejection, quota-aware skipping, and fallback. This mini provider should return enough attempt metadata to fit that existing dashboard.

## Free-Tier Safeguards

- Require auth key.
- Limit bulk lookup size.
- Limit per-request concurrency.
- Cache aggressively.
- Add per-domain cooldown after failures.
- Respect `Retry-After`.
- Avoid WHOIS TCP fallback for domains far from expiry.
- Do not auto-retry monthly-quota failures until the next month.
- Add request timeout and max response size.
- Prefer targeted checks from the app's existing schedule logic.

## Implementation Phases

### Phase 1 - RDAP-Only MVP

Deliver:

- Worker with `GET /v1/whois/:domain`
- auth key
- IANA `dns.json` bootstrap fetch and KV cache
- RDAP lookup
- normalized response
- D1 telemetry
- integration into Supabase `whois-logic.ts`

Scope:

- no legacy WHOIS yet
- no bulk endpoint yet
- return `unknown` for TLDs without RDAP

Success criteria:

- `.com`, `.net`, `.org`, `.page`, `.dev` registered domains return expiry date.
- Available RDAP 404 responses normalize to `available` only when the RDAP source clearly indicates not found.

### Phase 2 - Bulk And Cache

Deliver:

- `POST /v1/whois/bulk`
- domain cache
- per-host concurrency
- retry-after handling
- provider status endpoint

Success criteria:

- 25-domain batch works without overloading one RDAP host.
- repeated dashboard refresh uses cache.

### Phase 3 - Legacy WHOIS Fallback

Deliver:

- `cloudflare:sockets` TCP client
- TLD config map
- parser for common fields
- availability marker support
- strict incomplete-result rejection

Success criteria:

- WHOIS fallback fills expiry date when RDAP fails.
- parser does not mark domains available unless a TLD-specific not-found marker is configured.

### Phase 4 - `.id` / `.co.id` Hardening

Deliver:

- researched `.id` / `.co.id` source config
- validated test fixtures
- fallback enabled only after fixtures pass

Success criteria:

- known registered `.id` and `.co.id` domains return `registered` and expiry date.
- known available `.id` and `.co.id` domains return `available`.
- ambiguous responses return `unknown`, not false `available`.

### Phase 5 - Dashboard Integration

Deliver:

- show Cloudflare mini provider in provider dashboard
- show cache hit rate
- show recent failures and retry advice
- show whether RDAP, WHOIS, or cache served each result

Success criteria:

- user can understand whether failure is rate-limit, monthly exhaustion, missing TLD support, or parser gap.

## Testing Plan

Create fixtures for:

- registered `.com`
- available `.com`
- registered `.page`
- registered `.id`
- registered `.co.id`
- available `.id`
- available `.co.id`
- RDAP 404
- RDAP no expiry
- WHOIS no expiry
- WHOIS rate limit
- unknown TLD

Tests:

- domain normalization
- bootstrap endpoint selection
- RDAP event extraction
- nameserver normalization
- WHOIS parser field extraction
- availability marker matching
- incomplete-result rejection
- retry advice generation

## Risks

| Risk | Mitigation |
| --- | --- |
| RDAP and WHOIS can disagree. | Prefer expiry-bearing structured result; record source and attempts. |
| `.id` data may be hard to parse or unavailable. | Keep `.id` fallback disabled until validated. |
| Cloudflare Worker TCP behavior may differ by registry server. | Use RDAP-first and make WHOIS fallback optional per TLD. |
| Registry rate limits by Cloudflare egress IP. | Cache, cooldown, respect retry-after, keep concurrency low. |
| False available result is expensive. | Never mark available without RDAP not-found or explicit TLD-specific WHOIS availability marker. |

## Recommendation

Build the Cloudflare mini provider, but start RDAP-only. It will not fully replace `who-dat` on day one, but it gives us a Cloudflare-native foundation that matches this app's exact needs.

The first real implementation should be:

1. RDAP-only Worker
2. D1 telemetry
3. KV bootstrap cache
4. Supabase provider adapter
5. dashboard visibility

After that, add legacy WHOIS fallback only for TLDs where the app actually needs it.
