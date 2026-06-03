# Cloudflare D1 Database Architecture

Last researched: 2026-06-03.

## Direction

Use Cloudflare Workers or Pages Functions as the backend, Cloudflare D1 as the relational database, Better Auth for authentication, and Workers Cron Triggers/Queues for scheduled WHOIS checks.

Cloudflare D1 is SQLite-compatible and serverless. Current Cloudflare docs list D1 Free limits including 10 databases, 500 MB max database size, 5 GB max storage per account, 50 read-query subrequests per Worker invocation, and no hard row count beyond storage limits. D1 pricing/free-tier material also lists 5 million rows read per day and 100,000 rows written per day on the free tier. Sources: Cloudflare D1 limits and pricing pages.

Sources:

- https://developers.cloudflare.com/d1/platform/limits/
- https://developers.cloudflare.com/d1/
- https://www.cloudflare.com/pricing/

## Current Implementation To Replace

| Current piece | Current file | Replacement |
| --- | --- | --- |
| Supabase Auth Google OAuth | `src/services/supabaseService.ts`, `src/components/Auth.tsx` | Better Auth server route and Better Auth React client |
| Supabase database CRUD | `src/services/supabaseService.ts` | Worker API routes using D1 prepared statements |
| Supabase Edge Function `get-whois` | `supabase/functions/get-whois/index.ts` | Worker route, for example `POST /api/whois/check` |
| Supabase Edge Function `check-domains` | `supabase/functions/check-domains/index.ts` | Cloudflare Cron Trigger plus queue/batched D1 updates |
| Supabase RLS | SQL policies in README | Server-side authorization on every Worker route |

## Better Auth Notes

Better Auth is framework-agnostic TypeScript auth. Official docs say it supports email/password, social providers, client-side `useSession`, server-side `auth.api.getSession`, and Cloudflare Workers route handling via `auth.handler(request)`. For Cloudflare Workers, docs note adding `nodejs_compat` or `nodejs_als` compatibility flags for AsyncLocalStorage support. Better Auth supports D1 via Kysely-compatible relational database support; programmatic migrations with `getMigrations` work with the built-in Kysely adapter for SQLite/D1.

Sources:

- https://better-auth.com/docs/installation
- https://better-auth.com/docs/basic-usage
- https://better-auth.com/docs/adapters/other-relational-databases
- https://better-auth.com/docs/concepts/database

Recommended approach:

1. Let Better Auth generate/manage auth schema first.
2. Keep app-specific domain tables separate and prefixed, for example `app_domains`.
3. Do all authorization in Worker routes by reading the Better Auth session and filtering by `user_id`.
4. Use `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, Google OAuth client secrets, and WHOIS provider keys as Cloudflare Worker secrets.

## Proposed Schema

Use `TEXT` IDs for compatibility with Better Auth and Cloudflare Workers. Use ISO-8601 strings for timestamps. D1 stores them as text cleanly and SQLite date functions can still compare normalized timestamps.

```sql
-- Auth tables:
-- Generate with Better Auth. Do not hand-maintain unless the generated SQL is checked in.
-- Expected core concepts: user, session, account, verification.

CREATE TABLE IF NOT EXISTS app_domains (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  domain_name TEXT NOT NULL COLLATE NOCASE,
  normalized_domain TEXT NOT NULL COLLATE NOCASE,
  tld TEXT NOT NULL,
  tag TEXT NOT NULL CHECK (tag IN ('mine', 'to-snatch')),
  status TEXT NOT NULL CHECK (status IN ('available', 'registered', 'expired', 'dropped', 'unknown')),
  registrar TEXT,
  registered_at TEXT,
  expires_at TEXT,
  last_checked_at TEXT,
  next_check_at TEXT,
  check_interval_hours INTEGER NOT NULL DEFAULT 24,
  priority INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at TEXT,
  UNIQUE (user_id, normalized_domain)
);

CREATE INDEX IF NOT EXISTS idx_app_domains_user_created
  ON app_domains (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_app_domains_user_expires
  ON app_domains (user_id, expires_at);

CREATE INDEX IF NOT EXISTS idx_app_domains_due_checks
  ON app_domains (next_check_at, status, priority);

CREATE INDEX IF NOT EXISTS idx_app_domains_user_tag_status
  ON app_domains (user_id, tag, status);

CREATE TABLE IF NOT EXISTS app_domain_checks (
  id TEXT PRIMARY KEY,
  domain_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  normalized_domain TEXT NOT NULL COLLATE NOCASE,
  provider TEXT,
  status TEXT NOT NULL CHECK (status IN ('available', 'registered', 'expired', 'dropped', 'unknown')),
  registrar TEXT,
  registered_at TEXT,
  expires_at TEXT,
  raw_status TEXT,
  error_code TEXT,
  error_message TEXT,
  checked_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  latency_ms INTEGER,
  FOREIGN KEY (domain_id) REFERENCES app_domains(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_app_domain_checks_domain_checked
  ON app_domain_checks (domain_id, checked_at DESC);

CREATE TABLE IF NOT EXISTS app_import_jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('paste', 'csv', 'json')),
  default_tag TEXT NOT NULL CHECK (default_tag IN ('mine', 'to-snatch')),
  total_count INTEGER NOT NULL DEFAULT 0,
  processed_count INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('queued', 'processing', 'complete', 'failed', 'cancelled')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_app_import_jobs_user_created
  ON app_import_jobs (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS app_import_items (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  domain_name TEXT NOT NULL,
  normalized_domain TEXT NOT NULL COLLATE NOCASE,
  tag TEXT CHECK (tag IN ('mine', 'to-snatch')),
  status TEXT NOT NULL CHECK (status IN ('queued', 'processing', 'added', 'duplicate', 'invalid', 'failed')),
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  processed_at TEXT,
  FOREIGN KEY (job_id) REFERENCES app_import_jobs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_app_import_items_job_status
  ON app_import_items (job_id, status);

CREATE TABLE IF NOT EXISTS app_notification_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  domain_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('expires_90', 'expires_30', 'expires_7', 'expired', 'dropped', 'check_failed')),
  title TEXT NOT NULL,
  body TEXT,
  seen_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (domain_id) REFERENCES app_domains(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_app_notifications_user_seen_created
  ON app_notification_events (user_id, seen_at, created_at DESC);

CREATE TABLE IF NOT EXISTS app_user_settings (
  user_id TEXT PRIMARY KEY,
  expiry_notice_days TEXT NOT NULL DEFAULT '[90,30,7]',
  default_domain_tag TEXT NOT NULL DEFAULT 'mine' CHECK (default_domain_tag IN ('mine', 'to-snatch')),
  compact_mode INTEGER NOT NULL DEFAULT 0,
  theme TEXT NOT NULL DEFAULT 'system' CHECK (theme IN ('system', 'light', 'dark')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
```

## Why This Shape

| Decision | Reason |
| --- | --- |
| `app_domains` as main table | Supports the dashboard without joining check history. |
| `normalized_domain` | Prevents duplicate casing variants and gives reliable lookup key. |
| `app_domain_checks` | Keeps audit history and provider error visibility without bloating the current domain row. |
| `next_check_at` | Enables efficient cron queries instead of scanning all domains. |
| Import job tables | Bulk add should become a resumable server-side workflow instead of a browser loop. |
| Notification events table | Makes alerts persistent and dismissible across devices. |
| No provider keys table | Secrets belong in Cloudflare Worker secrets, not D1. |

## API Contract Sketch

| Route | Method | Behavior |
| --- | --- | --- |
| `/api/auth/*` | GET/POST | Better Auth handler. |
| `/api/domains` | GET | Paginated, filtered domain list for current session user. |
| `/api/domains` | POST | Add one domain, optionally enqueue/check immediately. |
| `/api/domains/bulk` | POST | Create import job and enqueue items. |
| `/api/domains/:id` | PATCH | Update tag, notes, priority, or check interval. |
| `/api/domains/:id` | DELETE | Soft delete or hard delete. |
| `/api/domains/:id/recheck` | POST | Queue or run a WHOIS check for one domain. |
| `/api/notifications` | GET/PATCH | Read and mark notification events seen. |
| `/api/export` | GET | Export CSV/JSON from D1. |

## Cron / Queue Design

1. Cron trigger runs every few hours or daily.
2. Select due domains with:

```sql
SELECT id, user_id, normalized_domain, status, tag
FROM app_domains
WHERE deleted_at IS NULL
  AND (next_check_at IS NULL OR next_check_at <= ?)
ORDER BY priority DESC, next_check_at ASC
LIMIT 100;
```

3. Process in batches with provider rate limits.
4. Insert one `app_domain_checks` row per attempt/result.
5. Update `app_domains` with latest status and calculated `next_check_at`.
6. Insert `app_notification_events` for expiry/drop transitions.

## Migration Path From Supabase

1. Export Supabase `domains` rows to CSV/JSON.
2. Implement Better Auth first and confirm user IDs.
3. Create D1 schema and app API routes.
4. Build a one-time import script that maps Supabase `user_id` to Better Auth user email/account.
5. Replace `src/services/supabaseService.ts` with an API client.
6. Replace Supabase function calls in `src/services/whoisService.ts` with Worker API calls.
7. Remove Supabase dependencies and deployment docs after parity is confirmed.

## Open Design Choice

For a single-user hobby tracker, you can simplify: keep Better Auth, `app_domains`, `app_domain_checks`, and `app_user_settings`; skip import job and notification tables until you need persistent job progress and cross-device notifications.
