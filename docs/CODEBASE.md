# Codebase Map

Last audited: 2026-06-04 WIB.

## Overview

This project is a Vite + React + TypeScript domain tracker. The current app uses Supabase for Google OAuth, domain persistence, and Edge Functions. WHOIS checks are proxied through Supabase functions so API keys stay server-side. The future target is Cloudflare D1 plus Better Auth.

## Runtime Flow

1. `src/index.tsx` mounts React into `#root`, wraps the app with `ErrorBoundary` and `CompactModeProvider`, and imports Tailwind CSS.
2. `src/App.tsx` initializes Supabase, reads the current auth session, subscribes to auth state, fetches domains after login, and renders either auth, dashboard, docs, loading, or config error views.
3. User domain actions call `src/services/supabaseService.ts` for CRUD/integration-token management and `src/services/whoisService.ts` for WHOIS.
4. `whoisService.ts` invokes Supabase Edge Function `get-whois`.
5. `supabase/functions/get-whois/index.ts` authenticates the Supabase user, creates a service-role client for telemetry, and calls shared provider logic in `supabase/functions/_shared/whois-logic.ts`.
6. `supabase/functions/_shared/whois-logic.ts` loads persistent provider telemetry when available, skips exhausted/rate-limited providers, balances in-flight provider use, and returns normalized WHOIS data.
7. `supabase/functions/check-domains/index.ts` is intended for scheduled checks. It uses a cron secret, service role key, metadata-first targeted scheduling, capped concurrency, shared WHOIS logic, and persisted provider telemetry to update only domains that are due.
8. External clients such as Hermes, n8n, scripts, or future apps call `supabase/functions/external-api/index.ts` with scoped bearer tokens stored as hashes in `integration_clients`.

## Current Stack

| Layer | Current implementation |
| --- | --- |
| Frontend | Vite, React 18, TypeScript |
| Styling | Tailwind CSS, class-based dark mode |
| Auth | Supabase Auth with Google OAuth |
| Database | Supabase Postgres tables assumed as `domains`, `whois_provider_telemetry`, `integration_clients`, `integration_events`, `notification_channels`, and `notification_deliveries` |
| Backend/API | Supabase Edge Functions |
| WHOIS providers | `who-dat`, WhoisXMLAPI, APILayer, WhoisFreaks, WhoAPI, RapidAPI, WhoisJSON, IP2WHOIS with quota-aware fallback |
| Docs rendering | Markdown content bundled into TypeScript and rendered with `marked` |

## Files

| File | Purpose / logic |
| --- | --- |
| `.env.local` | Local environment file. Contents were not documented here to avoid exposing secrets. Current app expects `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. |
| `.gitattributes` | Git attributes configuration. |
| `.gitignore` | Ignore rules for dependencies, builds, and local artifacts. |
| `AGENTS.md` | Agent guidance for future work in this repository. |
| `deployment.md` | Cloudflare Pages deployment guide, but still centered on Supabase backend functions after frontend deployment. |
| `index.html` | Vite HTML entry. Contains inline favicon, root div, and `/src/index.tsx` script. |
| `metadata.json` | App metadata: name, description, and requested frame permissions. |
| `package.json` | pnpm-managed scripts and dependencies. Scripts: `dev`, `build`, `lint`, `preview`. Main dependencies: React, Supabase JS, marked, and lucide-react. Declares `packageManager: pnpm@10.34.1`. |
| `pnpm-lock.yaml` | pnpm lockfile. Replaces `package-lock.json` so installs can use pnpm's shared package store instead of duplicating full npm installs per project. |
| `pnpm-workspace.yaml` | pnpm install policy. Allows build scripts for `esbuild` and `supabase` so Vite builds and the local Supabase CLI work under pnpm. |
| `postcss.config.js` | PostCSS config with Tailwind and Autoprefixer. |
| `prd.md` | Product requirements and implementation status for the domain tracker. Still names Supabase as the backend. |
| `README.md` | Setup, feature, database, Supabase Edge Function, provider, and deployment instructions. |
| `tailwind.config.js` | Tailwind content globs, class dark mode, brand colors, and a slow spin animation. |
| `tsconfig.json` | Strict frontend TypeScript config; includes only `src`. |
| `tsconfig.node.json` | TypeScript config for Vite/Tailwind/PostCSS config files. |
| `vite.config.ts` | Vite React plugin config with `base: '/'`. |
| `supabase/config.toml` | Minimal Supabase project config. Stores the project ref and marks `check-domains` and `external-api` as `verify_jwt = false` because they perform their own `CRON_SECRET`/integration-token authorization. Enables `supabase@latest functions deploy --use-api` without local Docker. |

## Frontend Source

| File | Purpose / logic |
| --- | --- |
| `src/index.tsx` | React startup. Handles missing root element and renders a styled fatal startup error if mounting fails. |
| `src/index.css` | Tailwind base/components/utilities imports. |
| `src/env.d.ts` | Types Vite env vars for Supabase URL/anon key and `import.meta.glob` for markdown docs. |
| `src/types.ts` | Core domain, domain tag (`mine`, `to-snatch`, `others`), WHOIS result, quota, provider attempt, provider status, and integration client/scope types. |
| `src/utils/domainCategorization.ts` | Client-side domain categorization utility. Extracts registrable base/TLD, handles common Indonesian second-level TLDs such as `.co.id`, ignores TLD for grouping, scores consonant/vowel/full-string/phonetic similarity, requires stronger evidence for short-word similarity, allows careful prefix/suffix containment for compounds such as `kontraktorkaca` belonging to `kontraktor` and `kaca`, and returns primary plus overlapping category metadata while avoiding broad false-positive substring groups. |
| `src/App.tsx` | Main state machine. Handles session, domain list, transient WHOIS detail cache, provider dashboard state, notifications, logs, modals, integration settings modal state, unified Add Domains modal state with initial single/bulk tab selection, passes the current domain list into the add modal for duplicate awareness, capture-phase Add Domains shortcuts (`Ctrl+N` plus `Alt+N` fallback), optimistic single and bulk pending rows, immediate bulk modal close after valid items are accepted, 6-worker bulk processing, automatic dashboard repair for incomplete WHOIS rows with 6-worker concurrency, Auto Mine name-server rule application through existing Supabase tag updates, add/remove/toggle/recheck/export flows, and estimated drop timeline modal. Add-domain keeps a final duplicate safety guard, saves usable WHOIS results normally, stores failed/unusable WHOIS outcomes as `unknown` rows with retry advice instead of dropping the user-entered domain, does not interrupt the user with an alert for saved WHOIS-failed rows, forces available/dropped results to `to-snatch`, cycles row tags through `mine -> to-snatch -> others`, and notifies on near-expiry `mine` and `others` rows. Sets explicit light/dark app backgrounds and a darker dark-mode dashboard panel for stronger row contrast. |
| `src/hooks/useDarkMode.ts` | Reads/stores theme in `localStorage`, applies/removes `dark` class on `<html>`, returns `[theme, toggleTheme]`. |
| `src/contexts/CompactModeContext.tsx` | Provides compact mode state, persists it in `localStorage`, and toggles a `compact` class on `<html>`. |
| `src/services/supabaseService.ts` | Creates Supabase client, exposes config error, wraps auth (`getSession`, Google sign-in, sign-out), domain CRUD functions, and integration client token-list/create/revoke helpers. Defines Supabase-ish database types manually. |
| `src/services/whoisService.ts` | Client-side WHOIS proxy wrapper. Calls `get-whois`, fetches `get-whois-providers`, normalizes failures to `unknown`, and logs provider usage. |

## Components

| File | Purpose / logic |
| --- | --- |
| `src/components/AutoMinePanel.tsx` | Local Auto Mine rules panel. Stores enabled name-server combination rules in `localStorage`, requires at least two unique name servers per rule, normalizes server names, matches only non-available domains whose stored `name_servers` contain every server in a rule, auto-applies matches by asking `App` to update matching rows to `mine`, provides manual apply, enable/disable, remove, and matched-domain preview controls. |
| `src/components/Auth.tsx` | Login screen with Google sign-in button calling Supabase OAuth. |
| `src/components/BulkAddModal.tsx` | Unified Add Domains modal. Contains tabs for single-domain and bulk entry, accepts an initial tab and existing domain list from `App`, focuses the active input on open, uses Tab/Shift+Tab to switch tabs, shows shortcut tooltips, normalizes typed URLs/domains, suggests existing matching domains while typing, blocks exact duplicate single-domain adds before submit, separates bulk entry into either Paste List or Upload File mode so both are not shown at once, supports paste shortcuts (`Ctrl+Enter` as Mine, `Ctrl+Shift+Enter` as To Snatch), validates/normalizes pasted/file domains, skips invalid/repeated/already-tracked bulk entries, clears pasted bulk text only after a valid bulk submission is accepted, adds Mine/To Snatch/Others icon tag choices, parses `others` from CSV/JSON imports, and hands valid entries to `App` for optimistic WHOIS-before-save processing. |
| `src/components/CompactModeToggle.tsx` | Icon button toggling compact/standard view through context, using shared tooltip behavior. |
| `src/components/ConfigErrorScreen.tsx` | Displays missing/invalid Supabase config errors. |
| `src/components/DocsPage.tsx` | Renders bundled docs using `marked` with a custom Tailwind HTML renderer and sidebar doc navigation. Uses `dangerouslySetInnerHTML`. |
| `src/components/DomainItem.tsx` | Domain row. Shows stronger Mine/To Snatch/Others row backgrounds, mutes registered `to-snatch` rows because they are mostly expiry-watch data until they near drop timing, adds a leading intent icon before the domain name, status overrides for available/expired/unknown, category and TLD chips beneath the domain name, incomplete/failed WHOIS rows as muted with a top overlay label, automatic/manual/pending WHOIS processing overlay state, clickable whois.com domain links, normalized long dates for registered/owned rows, replaces useless available-domain expiry `N/A` with registrar select plus icon-only buy action, persisted WHOIS details in tooltip, simple colored tag action icons, recheck/delete actions, cycles tag action through Mine/To Snatch/Others, and prevents available domains from being toggled to Mine/Others in the UI. |
| `src/components/DomainList.tsx` | List controls and rendering. Supports localStorage-persisted icon-labeled status filters including `Others`, per-filter count chips that respect active category/TLD/registered-target visibility context, category filter, TLD filter, category-name overrides, hide/show registered target rows, and sort choice. Builds client-side category metadata from stricter base-name similarity and containment, shows compact editable category controls, renders same-primary-category rows inside shared bordered row groups, shows overlap labels/chips without duplicating rows, supports category/TLD sort options, keeps Expiring Soon as the next 90 days sorted by nearest expiry, provides re-check menu for all visible or missing-data domains, forwards automatic/pending WHOIS row-state, provides unified Add Domains entry point, export menus, empty states, To Snatch filtering for available domains, and maps domains to `DomainItem` with category/TLD metadata. |
| `src/components/ErrorBoundary.tsx` | React class error boundary showing a recoverable error screen with refresh button. |
| `src/components/Header.tsx` | Sticky icon-first header. Shows app logo/title, docs icon, account icon with email tooltip, notifications dropdown, compact/dark toggles, and icon-only logout with tooltip. |
| `src/components/icons.tsx` | Lucide React icon wrapper. Re-exports quality-assured Lucide icons under the app's existing icon component names so component imports stay stable. |
| `src/components/IntegrationSettingsModal.tsx` | Integration API token manager. Shows the external API base URL, generates `dcv_live_...` tokens in-browser, stores SHA-256 token hashes through `supabaseService`, lets users choose scopes, shows the raw token once, provides icon-only copy buttons that switch from copy icon to check icon after success, provides a copyable Hermes setup prompt containing the API URL/token and Mine/To Snatch/Others tag rules, lists active/revoked clients, and revokes tokens. |
| `src/components/Modal.tsx` | Portal modal with Escape/backdrop close, title, close button, and scrollable body. |
| `src/components/ModeToggle.tsx` | Dark/light toggle button using `useDarkMode`. |
| `src/components/Spinner.tsx` | Tailwind spinner with size/color props. |
| `src/components/StatusLog.tsx` | Floating collapsible status log. Infers icon/color from emoji markers in log strings. |
| `src/components/Tooltip.tsx` | Shared instant tooltip. Renders through `document.body` via portal with fixed positioning, top-level z-index, viewport-aware horizontal/vertical clamping, and automatic top flip when bottom space is limited. |
| `src/components/WhoisProviderPanel.tsx` | Default-collapsed dashboard provider accordion. Shows summary first, then known providers, active/missing-key/not-implemented state, priority, static free-limit labels, live daily/monthly quota when exposed or persisted by telemetry, quota-source support, secret-key names, and notes/errors when expanded. |

## Supabase Functions

| File | Purpose / logic |
| --- | --- |
| `supabase/functions/_shared/whois-logic.ts` | Shared server-side WHOIS provider selection. Reads provider keys from Deno env, supports legacy `VITE_` secret names, loads/persists provider telemetry, pre-skips exhausted providers, balances in-flight calls, maps provider responses to normalized WHOIS data plus registry statuses/name servers, rejects incomplete provider responses such as registered/expired domains without expiry dates so the waterfall continues, and returns `unknown` after all providers fail or return unusable data. |
| `supabase/functions/get-whois/index.ts` | Authenticated edge function for real-time lookups. Handles CORS, validates Supabase user from Authorization header, creates a service-role telemetry client, validates `domainName`, calls shared WHOIS logic, and returns JSON. |
| `supabase/functions/get-whois-providers/index.ts` | Authenticated edge function for WHOIS dashboard. Uses service-role telemetry access and returns provider registry/runtime status without exposing secret values. |
| `supabase/functions/check-domains/index.ts` | Cron edge function. Requires `Authorization: Bearer CRON_SECRET`, uses service role Supabase client, scans domain metadata, skips domains far from expiry, applies low-noise owner/client schedules for `mine`/`others` and drop-watch schedules for `to-snatch`, caps checks with `WHOIS_CRON_MAX_CHECKS`, processes due checks with concurrency 6, writes persisted WHOIS detail fields, keeps user tags unchanged on suspicious available results, and upserts updates. |
| `supabase/functions/external-api/index.ts` | Scoped external REST API for Hermes/n8n/scripts/future apps. Authenticates `integration_clients` bearer tokens by SHA-256 hash, enforces scopes, supports `GET/POST /api/v1/domains`, `POST /api/v1/domains/recheck`, `GET /api/v1/alerts/due`, accepts `mine`/`to-snatch`/`others` tags, includes `others` filters and client-domain expiry alerts, records idempotency/audit events, reuses shared WHOIS logic, and never exposes Supabase service-role keys. |

## Supabase Migrations

| File | Purpose / logic |
| --- | --- |
| `supabase/migrations/20260603191500_add_whois_detail_columns.sql` | Adds `domain_statuses text[]` and `name_servers text[]` to `domains` for persisted tooltip details. |
| `supabase/migrations/20260603222500_add_whois_provider_telemetry.sql` | Adds `whois_provider_telemetry` plus `claim_whois_provider_attempt(...)` for cross-instance provider quota/rate-limit coordination. |
| `supabase/migrations/20260604090000_add_external_integrations.sql` | Adds integration client token hashes, integration events, notification channels, notification deliveries, indexes, RLS, and comments for the external API/webhook plan. |
| `supabase/migrations/20260604170000_add_others_domain_tag.sql` | Adds `others` to the Supabase `domain_tag_type` enum for client/third-party owned domains being monitored. |

## Documentation Files

| File | Purpose / logic |
| --- | --- |
| `src/docs/all-docs.ts` | Build-time docs loader. Uses `import.meta.glob` to bundle markdown files from `/docs`. |
| `docs/apilayer.md` | Local APILayer WHOIS API integration summary. |
| `docs/rapidapi.md` | Local RapidAPI WHOIS API integration summary. |
| `docs/troubleshoot.md` | Local troubleshooting guide, especially `marked` renderer typing and Supabase type issues. |
| `docs/who-dat.md` | Local self-hosted `who-dat` provider notes. |
| `docs/whoapi.md` | Local WhoAPI integration summary. |
| `docs/whoisfreaks.md` | Local WhoisFreaks integration summary. |
| `docs/whoisxmlapi.md` | Local WhoisXMLAPI integration summary. |
| `docs/CODEBASE.md` | This codebase map. |
| `docs/DB.md` | Proposed Cloudflare D1 database architecture. |
| `docs/CLOUDFLARE_WHOIS_PROVIDER_PLAN.md` | Plan for a Cloudflare Workers/D1/R2/KV mini WHOIS/RDAP provider inspired by `who-dat`, including weaknesses to improve, API shape, caching, telemetry, and implementation phases. |
| `docs/INTEGRATIONS.md` | Progress tracker and plan for a versioned external REST/webhook integration layer so Hermes Agent, WhatsApp, n8n, scripts, and future apps can add domains, trigger WHOIS checks, and receive expiry alerts securely. |
| `docs/MIGRATION.md` | Supabase vs Better Auth + D1 decision guide and current auth-last migration recommendation. |
| `docs/SUGGESTION.md` | Proactive suggestion log. |
| `docs/UI.md` | UI/UX audit and improvement plan. |
| `docs/WHOIS.md` | Current WHOIS implementation study, quota behavior, and expanded provider research covering the 8 implemented providers plus more than 10 RDAP/WHOIS backup candidates. |
| `docs/WHOIS_DASHBOARD.md` | Requirements and implementation guide for provider quota/status dashboard, current provider implementation status, and expanded backup-provider registry. |
| `docs/AUTH.md` | Current Supabase Auth notes and Better Auth migration guide. |

## Notable Implementation Gaps

| Area | Observation |
| --- | --- |
| Backend direction | Current code is deeply wired to Supabase. Migrating to Cloudflare D1 requires replacing auth, database service calls, edge functions, cron, and env names. |
| External integrations | Core scoped-token `/api/v1` external API and token UI exist. Webhook registration, durable notification queue writes, and notification dispatcher are still pending. |
| Bulk import | Bulk add exists and uses a 6-worker client pool. Future D1/Workers version should submit a bulk job and process server-side with persistent job status. |
| Provider telemetry | Remote Supabase has `whois_provider_telemetry` and `claim_whois_provider_attempt(...)` applied. Persistent quota coordination is active, with runtime fallback still available if telemetry access fails. |
| Security | `get-whois` CORS allows `*`; production should restrict origins. |
| Duplicates/artifacts | Empty root scaffold files and import-map entries were removed. |
