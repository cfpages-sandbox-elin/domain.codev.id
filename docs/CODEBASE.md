# Codebase Map

Last audited: 2026-06-05 WIB.

## Overview

This project is a Vite + React + TypeScript domain tracker. The current app uses Supabase for Google OAuth, domain persistence, and Edge Functions. WHOIS checks are proxied through Supabase functions so API keys stay server-side. The future target is Cloudflare D1 plus Better Auth.

## Runtime Flow

1. `src/index.tsx` mounts React into `#root`, wraps the app with `ErrorBoundary` and `CompactModeProvider`, and imports Tailwind CSS.
2. `src/App.tsx` initializes Supabase, reads the current auth session, subscribes to auth state, fetches domains after login, and renders either auth, dashboard, categories, settings, docs, loading, or config error views. Secondary views and heavy modals are lazy-loaded so the initial dashboard bundle stays below Vite's 500 kB warning threshold.
3. User domain actions call `src/services/supabaseService.ts` for CRUD/integration-token management and `src/services/whoisService.ts` for WHOIS.
4. `whoisService.ts` invokes Supabase Edge Function `get-whois`.
5. `supabase/functions/get-whois/index.ts` authenticates the Supabase user, creates a service-role client for telemetry, and calls shared provider logic in `supabase/functions/_shared/whois-logic.ts`.
6. `supabase/functions/_shared/whois-logic.ts` loads persistent provider telemetry when available, skips exhausted/rate-limited providers, balances in-flight provider use, and returns normalized WHOIS data.
7. `supabase/functions/check-domains/index.ts` is intended for scheduled checks. It uses a cron secret, service role key, metadata-first targeted scheduling, capped concurrency, shared WHOIS logic, and persisted provider telemetry to update only domains that are due, skipping reserved domains and checking target domains aggressively only in the estimated drop-hour window.
8. External clients such as Hermes, n8n, scripts, or future apps call `supabase/functions/external-api/index.ts` with scoped bearer tokens stored as hashes in `integration_clients`.

## Current Stack

| Layer | Current implementation |
| --- | --- |
| Frontend | Vite, React 18, TypeScript |
| Styling | Tailwind CSS, class-based dark mode |
| Auth | Supabase Auth with Google OAuth |
| Database | Supabase Postgres tables assumed as `domains`, `whois_provider_telemetry`, `integration_clients`, `integration_events`, `notification_channels`, and `notification_deliveries` |
| Backend/API | Supabase Edge Functions |
| WHOIS providers | `who-dat`, WhoisXMLAPI, APILayer, WhoisFreaks, WhoAPI, RapidAPI, WhoisJSON, IP2WHOIS, direct IANA RDAP, RDAP.org, OTI Labs, Domainduck, and RDAP API with quota-aware fallback |
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
| `vite.config.ts` | Vite React plugin config with `base: '/'`. Manual chunk configuration is not currently needed because route/modal-level lazy loading keeps production JS chunks below the Vite warning threshold. |
| `supabase/config.toml` | Minimal Supabase project config. Stores the project ref and marks `check-domains` and `external-api` as `verify_jwt = false` because they perform their own `CRON_SECRET`/integration-token authorization. Enables `supabase@latest functions deploy --use-api` without local Docker. |

## Frontend Source

| File | Purpose / logic |
| --- | --- |
| `src/index.tsx` | React startup. Handles missing root element and renders a styled fatal startup error if mounting fails. |
| `src/index.css` | Tailwind base/components/utilities imports. |
| `src/env.d.ts` | Types Vite env vars for Supabase URL/anon key and `import.meta.glob` for markdown docs. |
| `src/types.ts` | Core domain, domain status (`available`, `registered`, `expired`, `dropped`, `reserved`, `unknown`), domain tag (`mine`, `to-snatch`, `others`), WHOIS result, quota, provider attempt, provider status, provider credential input, Auto Mine rule, category manual override, category word group, user app settings, and integration client/scope types. |
| `src/utils/domainCategorization.ts` | Client-side domain categorization utility. Extracts registrable base/TLD, handles common Indonesian second-level TLDs such as `.co.id`, ignores TLD for grouping, scores consonant/vowel/full-string/phonetic similarity, requires stronger evidence for short-word similarity, requires short containment matches to leave a meaningful segment so `kacafilm = kaca + film`, `precast = pre + cast`, `lawfirm = law + firm`, and trailing one-letter variants such as `firm/firma` can match while leading one-letter leftovers such as `laman/taman` do not match `aman`, blocks pure one-leading-letter suffix matches such as `laman/taman` unless the leading letters are phonetic equivalents, uses directional containment so compounds like `kontraktorkolam` can belong to `kontraktor` and `kolam` but `kontraktor` is not pulled into the `kontraktorkolam` category, caches directional membership and symmetric score work, skips 3-letter anchors for performance/noise control, returns primary plus overlapping category metadata while avoiding broad false-positive substring groups, applies persisted word-group categories such as `steel/besi/baja`, gives word groups primary-category priority, and applies persisted manual include/exclude category overrides without changing the deterministic auto heuristic. |
| `src/utils/userSettingsStorage.ts` | Shared local fallback/cache helpers for user app settings. Sanitizes category name override maps, category manual include/exclude overrides, category word groups, and Auto Mine name-server rules, normalizes/splits name servers and category words, and reads/writes the legacy localStorage keys used before Supabase settings sync. |
| `src/App.tsx` | Main state machine. Handles session, domain list, synced user app settings with localStorage fallback/cache, transient WHOIS detail cache, provider dashboard state, notifications, logs, modals, integration settings modal state, unified Add Domains modal state with initial single/bulk tab selection, view routing for dashboard/categories/settings/docs, settings tab state for WHOIS Providers vs Auto Mine, passes the current domain list into the add modal for duplicate awareness, capture-phase Add Domains shortcuts (`Ctrl+N` plus `Alt+N` fallback), optimistic single and bulk pending rows, immediate bulk modal close after valid items are accepted, 6-worker bulk processing, automatic dashboard repair for incomplete WHOIS rows with 6-worker concurrency, Auto Mine name-server rule application through existing Supabase tag updates, category name/member/word-group setting sync, add/remove/direct-tag/toggle/recheck/export flows, and estimated drop timeline modal. Lazy-loads docs, categories, settings panels, Add Domains, and Integration API chunks through `React.lazy`/`Suspense` so the first dashboard bundle does not carry docs markdown, `marked`, or rarely used screens. Keeps a `domainsRef` so row action callbacks stay stable for memoized rows. Add-domain keeps a final duplicate safety guard, saves usable WHOIS results normally, treats checked domains without name servers as complete when expiry/registrar/status evidence exists, stores failed/unusable WHOIS outcomes as `unknown` rows with retry advice instead of dropping the user-entered domain, does not interrupt the user with an alert for saved WHOIS-failed rows, forces available/dropped results to `to-snatch`, skips `reserved` rows from automatic repair, supports direct row tag switching plus legacy cycle behavior, and notifies on near-expiry or expired `mine` and near-expiry `others` rows. Sets explicit light/dark app backgrounds and a darker dark-mode dashboard panel for stronger row contrast. |
| `src/hooks/useDarkMode.ts` | Reads/stores theme in `localStorage`, applies/removes `dark` class on `<html>`, returns `[theme, toggleTheme]`. |
| `src/contexts/CompactModeContext.tsx` | Provides compact mode state, persists it in `localStorage`, and toggles a `compact` class on `<html>`. |
| `src/services/supabaseService.ts` | Creates Supabase client, exposes config error, wraps auth (`getSession`, Google sign-in, sign-out), domain CRUD functions, integration client token-list/create/revoke helpers, write/delete helpers for user-entered WHOIS provider credentials, and get/save helpers for synced user app settings. Defines Supabase-ish database types manually. |
| `src/services/whoisService.ts` | Client-side WHOIS proxy wrapper. Calls `get-whois`, fetches `get-whois-providers`, normalizes failures to `unknown`, and logs provider usage. |

## Components

| File | Purpose / logic |
| --- | --- |
| `src/components/AutoMinePanel.tsx` | Auto Mine rules panel. Edits app-level synced name-server combination rules, requires at least two unique name servers per rule, normalizes server names, matches only non-available/non-reserved domains whose stored `name_servers` contain every server in a rule, auto-applies matches by asking `App` to update matching rows to `mine`, provides manual apply, enable/disable, remove, and matched-domain preview controls. |
| `src/components/Auth.tsx` | Login screen with Google sign-in button calling Supabase OAuth. |
| `src/components/BulkAddModal.tsx` | Unified Add Domains modal. Contains tabs for single-domain and bulk entry, accepts an initial tab and existing domain list from `App`, focuses the active input on open, uses Tab/Shift+Tab to switch tabs, shows shortcut tooltips, normalizes typed URLs/domains, suggests existing matching domains while typing, blocks exact duplicate single-domain adds before submit, separates bulk entry into either Paste List or Upload File mode so both are not shown at once, supports paste shortcuts (`Ctrl+Enter` as Mine, `Ctrl+Shift+Enter` as To Snatch), validates/normalizes pasted/file domains, skips invalid/repeated/already-tracked bulk entries, clears pasted bulk text only after a valid bulk submission is accepted, adds Mine/To Snatch/Others icon tag choices, parses `others` from CSV/JSON imports, and hands valid entries to `App` for optimistic WHOIS-before-save processing. |
| `src/components/CompactModeToggle.tsx` | Icon button toggling compact/standard view through context, using shared tooltip behavior. |
| `src/components/ConfigErrorScreen.tsx` | Displays missing/invalid Supabase config errors. |
| `src/components/CategoriesPage.tsx` | Dedicated categories view opened from the navbar. Uses the shared auto categorizer plus persisted word groups and manual overrides, shows all category groups and overlaps outside the main dashboard, supports creating/toggling/removing word groups such as `steel, besi, baja`, editing synced category names, manually adding domains into a category, excluding wrong auto members, resetting category membership overrides, and listing domain chips per category with manually added or word-group chips highlighted. |
| `src/components/DocsPage.tsx` | Renders bundled docs using `marked` with a custom Tailwind HTML renderer and sidebar doc navigation. Uses `dangerouslySetInnerHTML`. |
| `src/components/DomainItem.tsx` | Memoized domain row. Shows stronger Mine/To Snatch/Others row backgrounds, mutes registered `to-snatch` rows because they are mostly expiry-watch data until they near drop timing, adds a leading intent icon before the domain name, status overrides for available/expired/reserved/unknown, category and TLD chips beneath the domain name, incomplete/failed WHOIS rows as muted with a top overlay label but does not require name servers for completeness, automatic/manual/pending WHOIS processing overlay state, clickable whois.com domain links, normalized long dates for registered/owned rows, replaces useless available-domain expiry `N/A` with registrar select plus icon-only buy action, shows reserved domains as not buyable, memoized persisted WHOIS details in tooltip, fixed-width direct tag switcher that reveals the other two tag targets on hover/focus, recheck/delete actions, legacy tag cycle on current-icon click, and prevents available domains from being toggled to Mine/Others in the UI. |
| `src/components/DomainList.tsx` | List controls and rendering. Supports localStorage-persisted centered icon-labeled status filters including `Others` and an auto-hidden `Missing Data` chip, per-filter count chips computed in one pass with active category/TLD/registered-target visibility context, category filter, TLD filter, synced category-name/member/word-group settings from `App`, hide/show registered target rows, and sort choice. Builds client-side category metadata from stricter base-name similarity and containment plus persisted word groups and manual category corrections, renders same-primary-category rows inside shared bordered row groups without a dashboard category overview box, orders overlapping categories as connected clusters, shows overlap labels/chips without duplicating rows, supports category/TLD sort options, keeps Expiring Soon as the next 90 days sorted by nearest expiry, incrementally renders large result sets starting at 180 domains and loading 120 more via bottom sentinel/manual button, provides re-check menu for all visible or missing-data domains with a floating bottom progress bar showing the current processed domain, treats missing name servers as optional detail instead of missing data, forwards automatic/pending WHOIS row-state, provides unified Add Domains entry point, export menus, empty states, To Snatch filtering for available domains, and maps domains to `DomainItem` with category/TLD metadata. |
| `src/components/ErrorBoundary.tsx` | React class error boundary showing a recoverable error screen with refresh button. |
| `src/components/Header.tsx` | Sticky icon-first header. Shows app logo/title, docs, categories, integration API, settings, account icon with email tooltip, notifications dropdown, compact/dark toggles, and icon-only logout with tooltip. |
| `src/components/icons.tsx` | Lucide React icon wrapper. Re-exports quality-assured Lucide icons under the app's existing icon component names so component imports stay stable. |
| `src/components/IntegrationSettingsModal.tsx` | Integration API token manager. Shows the external API base URL, generates `dcv_live_...` tokens in-browser, stores SHA-256 token hashes through `supabaseService`, lets users choose scopes, shows the raw token once, provides icon-only copy buttons that switch from copy icon to check icon after success, provides a copyable Hermes setup prompt containing the API URL/token and Mine/To Snatch/Others tag rules, lists active/revoked clients, and revokes tokens. |
| `src/components/Modal.tsx` | Portal modal with Escape/backdrop close, title, close button, and scrollable body. |
| `src/components/ModeToggle.tsx` | Dark/light toggle button using `useDarkMode`. |
| `src/components/Spinner.tsx` | Tailwind spinner with size/color props. |
| `src/components/StatusLog.tsx` | Floating collapsible status log. Infers icon/color from emoji markers in log strings. |
| `src/components/Tooltip.tsx` | Shared instant tooltip. Renders through `document.body` via portal with fixed positioning, top-level z-index, viewport-aware horizontal/vertical clamping, and automatic top flip when bottom space is limited. Coordinates one active tooltip globally and closes on mouse leave, blur, Escape, page hide, and tab/window inactivity so hover details do not remain stuck after switching tabs. |
| `src/components/WhoisProviderPanel.tsx` | WHOIS provider accordion used in Settings. Shows summary first, then known providers, active/missing-key/not-implemented state, priority, static free-limit labels, live daily/monthly quota when exposed or persisted by telemetry, quota-source support, secret-key names, notes/errors, and write-only per-user key inputs for OTI Labs, Domainduck, and RDAP API when expanded. Supports `defaultExpanded` for the Settings tab. |

## Supabase Functions

| File | Purpose / logic |
| --- | --- |
| `supabase/functions/_shared/whois-logic.ts` | Shared server-side WHOIS provider selection. Reads provider keys from Deno env and user-scoped `whois_provider_credentials`, supports legacy `VITE_` secret names, lets user-stored keys override project-wide Supabase secrets for OTI Labs/Domainduck/RDAP API, implements direct IANA RDAP, RDAP.org, OTI Labs, Domainduck, and RDAP API adapters, loads/persists provider telemetry, pre-skips exhausted providers, balances in-flight calls, maps provider responses to normalized WHOIS data plus registry statuses/name servers, detects conservative reserved-domain signals from provider/RDAP statuses and text fields, rejects incomplete provider responses such as registered/expired domains without expiry dates so the waterfall continues, and returns `unknown` after all providers fail or return unusable data. |
| `supabase/functions/get-whois/index.ts` | Authenticated edge function for real-time lookups. Handles CORS, validates Supabase user from Authorization header, creates a service-role telemetry/credential client, validates `domainName`, calls shared WHOIS logic with the current `user_id`, and returns JSON. |
| `supabase/functions/get-whois-providers/index.ts` | Authenticated edge function for WHOIS dashboard. Uses service-role telemetry/credential access and returns provider registry/runtime status without exposing secret values. |
| `supabase/functions/check-domains/index.ts` | Cron edge function. Requires `Authorization: Bearer CRON_SECRET`, uses service role Supabase client, scans domain metadata including `user_id`, skips reserved/available/dropped domains and domains far from expiry, applies low-noise owner/client schedules for `mine`/`others`, checks target domains weekly during likely grace/redemption, daily near drop approach, and hourly only inside a precise estimated drop-hour window when expiry/registration timestamps allow it, caps checks with `WHOIS_CRON_MAX_CHECKS`, processes due checks with concurrency 6 using owner-specific provider keys, writes persisted WHOIS detail fields, keeps user tags unchanged on suspicious available results, and upserts updates. |
| `supabase/functions/external-api/index.ts` | Scoped external REST API for Hermes/n8n/scripts/future apps. Authenticates `integration_clients` bearer tokens by SHA-256 hash, enforces scopes, supports `GET/POST /api/v1/domains`, `POST /api/v1/domains/recheck`, `GET /api/v1/alerts/due`, `GET /api/v1/alerts/drop/{domainName}` for exact target-domain drop alerts, accepts `mine`/`to-snatch`/`others` tags, includes `others` filters, owned expired alerts, target drop-window alerts with estimated timing metadata, records idempotency/audit events, reuses shared WHOIS logic with the integration owner `user_id`, and never exposes Supabase service-role keys. |

## Supabase Migrations

| File | Purpose / logic |
| --- | --- |
| `supabase/migrations/20260603191500_add_whois_detail_columns.sql` | Adds `domain_statuses text[]` and `name_servers text[]` to `domains` for persisted tooltip details. |
| `supabase/migrations/20260603222500_add_whois_provider_telemetry.sql` | Adds `whois_provider_telemetry` plus `claim_whois_provider_attempt(...)` for cross-instance provider quota/rate-limit coordination. |
| `supabase/migrations/20260604090000_add_external_integrations.sql` | Adds integration client token hashes, integration events, notification channels, notification deliveries, indexes, RLS, and comments for the external API/webhook plan. |
| `supabase/migrations/20260604170000_add_others_domain_tag.sql` | Adds `others` to the Supabase `domain_tag_type` enum for client/third-party owned domains being monitored. |
| `supabase/migrations/20260604213000_add_whois_provider_credentials.sql` | Adds `whois_provider_credentials` for user-entered optional provider API keys. RLS allows insert/update/delete by owner but intentionally has no browser-readable select policy for raw key values. |
| `supabase/migrations/20260604224500_add_app_user_settings.sql` | Adds `app_user_settings` for user-scoped category name overrides, category manual include/exclude overrides, category word groups, and Auto Mine name-server rules, with JSON shape checks and owner-only RLS. |
| `supabase/migrations/20260604233000_add_category_manual_overrides.sql` | Adds `category_manual_overrides` to already-migrated `app_user_settings` tables and enforces object-shaped JSON for persisted manual category membership corrections. |
| `supabase/migrations/20260604234500_add_category_word_groups.sql` | Adds `category_word_groups` to `app_user_settings` and enforces array-shaped JSON for persisted synonym/word-group category rules. |
| `supabase/migrations/20260605090000_add_reserved_domain_status.sql` | Adds `reserved` to `domain_status_type` so government/registry-reserved domains can be listed without being treated as buyable or due for automatic rechecks. |

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
| `docs/OPTIMIZATION.md` | UI performance audit, optimization plan, and progress tracker for keeping the dashboard responsive with hundreds of domains. |
| `docs/OPTMIZATION.md` | Bundle-size optimization tracker created under the user-requested filename. Records the lazy route/modal chunk plan and build-size result for removing Vite's 500 kB JS warning. |
| `docs/SUGGESTION.md` | Proactive suggestion log. |
| `docs/UI.md` | UI/UX audit and improvement plan. |
| `docs/WHOIS.md` | Current WHOIS implementation study, quota behavior, and expanded provider research covering the 8 implemented providers plus more than 10 RDAP/WHOIS backup candidates. |
| `docs/WHOIS_CHECKING_REFINEMENT.md` | Progress tracker and decision record for optional name-server completeness, reserved domains, precise drop-window scheduling, and exact-domain drop alert API. |
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
