# SERP Rank Tracking — MVP Plan

Last updated: 2026-07-13 WIB  
Status: **MVP implemented** (apply migration + deploy Edge Functions + paste at least one SERP API key)

This is the durable product + provider plan for multi-domain keyword rank tracking.  
Related docs:

- `docs/PERFORMANCE_AND_RANK_TRACKING_PLAN.md` — hover lag audit + high-level integration
- `docs/OPTIMIZATION.md` — UI performance pass tracker
- `docs/WHOIS_DASHBOARD.md` — pattern to mirror for provider keys / telemetry UI
- `docs/SUPABASE.md` — deploy/secrets rules

---

## Product goal

Track rankings for keywords that apply to **multiple owned (or competitor) domains at once**.

```text
One keyword config  →  one SERP fetch  →  store JSON (R2 or DB blob)  →  derive N domain positions
```

### Why keyword-first

| Naive | Target design |
| --- | --- |
| SERP call per domain × keyword | **One SERP call per keyword config** |
| N copies of SERP JSON | **One snapshot per check** |
| Incomparable timestamps | **Same snapshot for all linked domains** |

User example: sites A, B, C all target “filtrasi air” → attach all three to one keyword → one daily check → positions 3 / 11 / not-in-top-100 from the same JSON.

---

## Non-goals (v1)

- Full SEO suite (backlinks, audits, AI Overviews deep analytics)
- SERP screenshots
- Unlimited on-demand browser refreshes
- Auto-tracking every domain without explicit keyword links
- Putting heavy rank UI into every domain row

---

## Information architecture

Per `AGENTS.md`: cross-cutting operational features get their own view.

| Surface | Role |
| --- | --- |
| **Ranks** nav item (lazy route) | Keyword list, multi-domain attach, latest position matrix, check history |
| Settings → **SERP Providers** tab | Enter third-party API keys, free-tier labels, status, rotate/order |
| Domain row | Optional later badge only; **not** v1 |
| Cron / Edge Function `check-ranks` | Scheduled + manual enqueue |
| Object storage | Raw/normalized SERP JSON (R2 preferred; Supabase Storage or `jsonb` fallback for MVP) |

---

## Data model

### Tables

```text
rank_keywords
  id uuid pk
  user_id uuid not null
  keyword text not null
  keyword_key text not null          -- lowercased unique key
  engine text not null default 'google'
  locale text not null default 'id'  -- gl/hl pack
  device text not null default 'desktop'
  location text null
  enabled boolean not null default true
  check_interval_hours int not null default 24
  last_checked_at timestamptz null
  next_check_at timestamptz null
  created_at / updated_at
  UNIQUE (user_id, keyword_key, engine, locale, device, location)

rank_keyword_domains
  keyword_id uuid → rank_keywords
  domain_id int → domains
  user_id uuid not null
  match_mode text default 'domain'   -- domain | subdomain | exact_url | prefix
  target_url text null
  PRIMARY KEY (keyword_id, domain_id)

rank_checks
  id uuid pk
  keyword_id uuid not null
  user_id uuid not null
  status text                        -- queued | running | succeeded | failed
  provider text null
  requested_at timestamptz
  completed_at timestamptz null
  storage_key text null              -- R2/Storage path
  serp_json jsonb null               -- MVP fallback when blob store unset
  result_count int null
  error_message text null

rank_positions
  id bigserial/uuid
  check_id uuid not null
  keyword_id uuid not null
  domain_id int not null
  user_id uuid not null
  position int null                  -- null = not found in depth
  rank_url text null
  rank_title text null
  found boolean not null default false
  created_at timestamptz
  UNIQUE (check_id, domain_id)
  INDEX (user_id, domain_id, keyword_id, created_at desc)
  INDEX (keyword_id, created_at desc)

serp_provider_credentials
  id uuid pk
  user_id uuid not null
  provider_id text not null
  api_key text not null
  UNIQUE (user_id, provider_id)
  -- RLS: insert/update/delete by owner; NO select of raw keys to browser
  -- Edge Functions read with service role

serp_provider_telemetry (optional v1, recommended)
  provider_id text pk or (user_id, provider_id)
  month_key text
  estimated_month_used int
  blocked_until timestamptz null
  block_reason text null
  last_used_at / last_error
```

### Match modes

| Mode | Rule |
| --- | --- |
| `domain` (default) | registrable domain of result URL equals tracked domain (ignore www) |
| `subdomain` | host is domain or `*.domain` |
| `prefix` | URL starts with `target_url` |
| `exact_url` | exact URL match |

Best (lowest) position wins when multiple hits match.

### Storage layout (R2 / Storage)

```text
{user_id}/{keyword_id}/{check_id}.json
```

Normalized JSON shape:

```json
{
  "version": 1,
  "keyword": "filtrasi air",
  "engine": "google",
  "locale": "id",
  "device": "desktop",
  "checkedAt": "2026-07-10T03:00:00.000Z",
  "provider": "serper",
  "organic": [
    { "position": 1, "url": "https://...", "domain": "example.com", "title": "...", "snippet": "..." }
  ]
}
```

**MVP storage decision:** prefer R2 when configured; otherwise store normalized `organic` in `rank_checks.serp_json` so the feature works without Cloudflare wiring. Abstract behind `SerpSnapshotStore.put/get`.

---

## Provider research (~10 free-tier SERP APIs)

Research date: 2026-07-10. Free tiers change often — treat limits as **targets for rotation**, not guarantees. Prefer providers with simple REST + API key so users can paste keys in Settings.

| # | Provider id | Label | Free tier (reported) | Auth style | Endpoint pattern | Fit for rotation |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `serper` | Serper | **~2,500 free credits** (often cited as most generous) | `X-API-KEY` | `POST https://google.serper.dev/search` body `{ q, gl, hl, num }` | **Primary** — best free volume |
| 2 | `serpapi` | SerpAPI | **~250 searches/mo** free plan | `api_key` query | `GET https://serpapi.com/search.json` | Mature multi-engine docs |
| 3 | `searchapi` | SearchAPI | **~100 free / mo** | `api_key` query | `GET https://www.searchapi.io/api/v1/search` | Multi-engine, clean JSON |
| 4 | `valueserp` | ValueSERP | **~100 free / mo** | `api_key` query | `GET https://api.valueserp.com/search` | Google SERP JSON |
| 5 | `scaleserp` | ScaleSERP | free credits / free forever listings (varies) | `api_key` query | `GET https://api.scaleserp.com/search` | Similar API family to ValueSERP |
| 6 | `zenserp` | ZenSERP | **~50 free / mo** | `apikey` query | `GET https://app.zenserp.com/api/v2/search` | Simple Google |
| 7 | `serpwow` | SerpWow | **~100 free credits** | `api_key` query | `GET https://api.serpwow.com/live/search` | Live SERP |
| 8 | `serpstack` | Serpstack | **~100 free / mo** | `access_key` query | `GET https://api.serpstack.com/search` | Lightweight |
| 9 | `scrapingdog` | Scrapingdog | free trial/credits (~100–1000 reported) | `api_key` query | `GET https://api.scrapingdog.com/google` | Fast Google SERP |
| 10 | `hasdata` | HasData | **~100 free / mo** | `x-api-key` header | Google SERP scrape endpoint | LLM-friendly JSON |

### Honorable mentions (implement later if needed)

| Provider | Note |
| --- | --- |
| DataForSEO | ~$1 free credit; bulk/async oriented; more complex auth |
| ScraperAPI | trial credits; credit-based Google endpoint |
| Bright Data SERP | trial / deposit match; enterprise-oriented |
| Google Custom Search JSON API | 100/day but CSE-index constrained — **not** a general SERP rank source |

### Rotation / free-tier respect rules

1. **User-supplied keys only for MVP** (Settings form). Optional project env secrets as later fallback.
2. **Waterfall order** by remaining free budget and priority (Serper first when configured).
3. **Skip** provider if:
   - no key for user
   - telemetry says blocked (429 / quota)
   - estimated monthly free limit reached
4. **Hard caps:** max keywords per user, max checks/day per user, rate-limit “Check now”.
5. **One fetch per keyword config** — never N fetches for N domains on the same keyword.
6. **Depth default:** top **100** organics (enough multi-site competition, manageable JSON size).
7. **Cadence default:** 24h; optional 12h for priority keywords under tighter caps.
8. Persist provider attempt list on each `rank_checks` row (like WHOIS attempts).

### Adapter interface (shared Edge module)

```ts
type SerpFetchInput = {
  keyword: string;
  locale: string;   // e.g. id
  device: 'desktop' | 'mobile';
  location?: string | null;
  depth?: number;   // default 100
  apiKey: string;
};

type SerpOrganicHit = {
  position: number;
  url: string;
  domain: string;
  title?: string;
  snippet?: string;
};

type SerpFetchResult = {
  provider: string;
  organic: SerpOrganicHit[];
  raw?: unknown; // optional; strip before long-term store if huge
};
```

Each adapter normalizes vendor JSON → `SerpOrganicHit[]`. Orchestrator:

1. Load user credentials + telemetry  
2. Order enabled providers  
3. Call until success or exhausted  
4. Write snapshot  
5. Derive positions for all linked domains  

---

## Backend surface

| Function / path | Auth | Role |
| --- | --- | --- |
| `get-serp-providers` | User JWT | Registry + configured? + free-tier labels + telemetry (no raw keys) |
| `check-ranks` | `CRON_SECRET` and/or user JWT for single-keyword | Run due keywords or one forced keyword |
| Browser CRUD | Supabase RLS on rank tables | Keywords + domain links + read positions/history |
| Optional later | `external-api` scopes `ranks:read`, `ranks:check` | Hermes |

### Algorithm for one keyword check

1. Load keyword + linked domains  
2. Insert `rank_checks` (`running`)  
3. SERP waterfall → normalized organic list  
4. Store snapshot (R2 key and/or `serp_json`)  
5. For each linked domain, match organic hits → insert `rank_positions`  
6. Update keyword `last_checked_at` / `next_check_at`  
7. Mark check `succeeded` or `failed`  

---

## Frontend surface

### Settings tab: SERP Providers

Mirror `WhoisProviderPanel` patterns:

- Accordion of 10 providers  
- Free-tier label  
- Configured / missing-key state  
- Write-only API key input (save/remove)  
- Refresh status  

### Ranks page

1. Create keyword (text, locale, device)  
2. Multi-select domains (default filter `mine`; allow `others` for competitors)  
3. Matrix: keyword × domains → latest position / “—” / “100+”  
4. Keyword detail: history sparkline/table + open last SERP snapshot  
5. “Check now” button (rate-limited)  

### App wiring

- View: `'ranks'`  
- Lazy chunk like Categories/Schedule  
- Header icon + intent prefetch  
- Settings tab: `'serp'` alongside whois / monitoring / auto-mine  

---

## Defaults (v1)

| Setting | Default |
| --- | --- |
| Engine | `google` only |
| Locale | `id` |
| Device | `desktop` |
| Depth | 100 |
| Interval | 24h |
| Match mode | `domain` |
| Keyword uniqueness | `(user, keyword_key, engine, locale, device, location)` |
| Attachable tags | `mine` + `others` (competitors) |

---

## Implementation checklist

### Schema / backend

- [x] Migration: `rank_keywords`, `rank_keyword_domains`, `rank_checks`, `rank_positions`, `serp_provider_credentials`, telemetry (`20260712090000_add_rank_tracking.sql`)
- [x] RLS policies (owner-only; no browser SELECT on raw API keys)
- [x] Shared modules: `serp-types`, `serp-registry`, `serp-adapters` (10), `serp-logic`, `serp-match` (JSON stored in `rank_checks.serp_json`; R2 key column reserved)
- [x] Edge Function `get-serp-providers`
- [x] Edge Function `check-ranks` (cron + manual)
- [x] `supabase/config.toml` (`check-ranks` verify_jwt false)
- [x] Deploy notes in `docs/SUPABASE.md`

### Frontend

- [x] Types in `src/types.ts`
- [x] `src/services/rankService.ts` + credential helpers in `supabaseService`
- [x] `SerpProviderPanel` + Settings → SERP Providers tab
- [x] `RanksPage` lazy route + Header nav
- [ ] Docs page entry / in-app doc optional

### Ops

- [ ] User applies migration on Supabase
- [ ] User pastes at least one free-tier API key (Serper recommended first)
- [ ] Deploy `get-serp-providers` and `check-ranks` with `--use-api`
- [ ] Optional: schedule cron for `check-ranks` like `check-domains`

### Verify

- [x] `pnpm run lint`
- [x] `pnpm exec tsc --noEmit`
- [x] `pnpm run test:regression`
- [x] `pnpm run build` (dist cleaned after)
- [ ] Manual: create keyword → attach 2+ domains → check → positions from same snapshot  

---

## Cost / abuse guards

| Guard | Value (suggested) |
| --- | --- |
| Max keywords / user | 100 (configurable later) |
| Max domains / keyword | 50 |
| Max manual checks / hour / user | 10 |
| Max cron checks / run | 20 |
| Skip if no provider key configured | yes |
| Deduplicate identical keyword configs | unique constraint |

---

## Open decisions (defaults applied if unanswered)

| Question | Default for MVP |
| --- | --- |
| SERP provider set | All 10 adapters; user enables by pasting keys |
| Google + id + desktop only? | Yes for engine/locale/device defaults |
| Competitors (`others`)? | Yes, attachable |
| R2 now? | Abstract store; `serp_json` fallback first |
| Performance before ranks UI? | Yes — finish list/tooltip pass first so Ranks page does not compound lag |

---

## Progress log

| Date/Time (WIB) | Status | Note |
| --- | --- | --- |
| 2026-07-13 | MVP implemented | Migration, 10 SERP adapters + rotation, Edge Functions, Settings keys UI, Ranks page, keyword multi-domain attach, check-now. Snapshot in `serp_json` (R2-ready `storage_key`). |
| 2026-07-10 | Plan written | Full MVP model, 10-provider research, checklist. |
| 2026-07-10 | WIP code may exist | Reconciled into completed performance + rank MVP pass. |
