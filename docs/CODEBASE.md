# Codebase Map

Last audited: 2026-07-03 WIB.

## Overview

This project is a Vite + React + TypeScript domain tracker. The current app uses Supabase for Google OAuth, domain persistence, and Edge Functions. WHOIS checks are proxied through Supabase functions so API keys stay server-side. The future target is Cloudflare D1 plus Better Auth.

## Runtime Flow

1. `src/index.tsx` mounts React into `#root`, wraps the app with `ErrorBoundary` and `CompactModeProvider`, and imports Tailwind CSS.
2. `src/App.tsx` initializes Supabase, reads/subscribes to auth session state, delegates cached domain/provider state to hooks, and renders either auth, dashboard, categories, settings, docs, loading, or config error views. Settings, secondary views, and heavy modals are lazy-loaded so the initial dashboard bundle stays below Vite's 500 kB warning threshold.
3. User domain actions call `src/services/supabaseService.ts` for CRUD/integration-token management and `src/services/whoisService.ts` for WHOIS.
4. `whoisService.ts` invokes Supabase Edge Function `get-whois`.
5. `supabase/functions/get-whois/index.ts` authenticates the Supabase user, creates a service-role client for telemetry, and calls shared provider logic in `supabase/functions/_shared/whois-logic.ts`.
6. `supabase/functions/_shared/whois-logic.ts` coordinates shared WHOIS modules for provider registry, runtime/persistent telemetry, provider adapters, RDAP/WHOIS normalization, exhausted-provider skipping, in-flight balancing, and normalized WHOIS responses.
7. `supabase/functions/check-domains/index.ts` is intended for 15-minute scheduled checks. It uses a cron secret, service role key, metadata-first targeted scheduling, capped concurrency, shared WHOIS logic, and persisted provider telemetry. Target domains remain monitored until availability is detected; confirmed drops enqueue and dispatch durable Hermes/webhook notifications with retry.
8. External clients such as Hermes, n8n, scripts, or future apps call `supabase/functions/external-api/index.ts` with scoped bearer tokens stored as hashes in `integration_clients`.

## Current Stack

| Layer | Current implementation |
| --- | --- |
| Frontend | Vite, React 18, TypeScript |
| Styling | Tailwind CSS, class-based dark mode |
| Auth | Supabase Auth with Google OAuth |
| Database | Supabase Postgres tables assumed as `domains`, `whois_provider_telemetry`, `integration_clients`, `integration_events`, `notification_channels`, and `notification_deliveries` |
| Backend/API | Supabase Edge Functions |
| WHOIS providers | `who-dat`, WhoisXMLAPI, APILayer, WhoisFreaks, WhoAPI, WhoisJSON, IP2WHOIS, direct IANA RDAP, RDAP.org, OTI Labs, Domainduck, RDAP API, RapidAPI Domains API, and legacy RapidAPI Domain WHOIS Lookup with quota-aware fallback |
| Docs rendering | Markdown content bundled into TypeScript and rendered with `marked` |

## Files

| File | Purpose / logic |
| --- | --- |
| `.env.local` | Local environment file. Contents were not documented here to avoid exposing secrets. Current app expects `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. |
| `.eslintrc.cjs` | ESLint configuration for the existing `pnpm run lint` script. Covers React/TypeScript source and Supabase Edge Function TypeScript, keeps React hooks rules active, ignores build/dependency output, and allows existing provider/Edge Function `any` and `@ts-ignore` patterns until those modules are typed more deeply. |
| `.gitattributes` | Git attributes configuration. |
| `.gitignore` | Ignore rules for dependencies, builds, and local artifacts. |
| `AGENTS.md` | Agent guidance for future work in this repository. |
| `deployment.md` | Cloudflare Pages deployment guide, but still centered on Supabase backend functions after frontend deployment. |
| `index.html` | Vite HTML entry. Contains inline favicon, root div, and `/src/index.tsx` script. |
| `metadata.json` | App metadata: name, description, and requested frame permissions. |
| `package.json` | pnpm-managed scripts and dependencies. Scripts: `dev`, `build`, `lint`, `test:regression`, `preview`. Main dependencies: React, Supabase JS, marked, and lucide-react. Dev tooling includes TypeScript, ESLint, Vite, and Vitest for lightweight pure-logic regression tests. Declares `packageManager: pnpm@10.34.1`. |
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
| `src/index.css` | Tailwind imports plus the global CSS-only cursor policy for enabled/disabled interactive controls. |
| `src/env.d.ts` | Types Vite env vars for Supabase URL/anon key and `import.meta.glob` for markdown docs. |
| `src/types.ts` | Core domain, domain status (`available`, `registered`, `expired`, `dropped`, `reserved`, `unknown`), domain tag (`mine`, `to-snatch`, `others`), WHOIS result, quota, provider attempt, provider status, provider credential input, Auto Mine rule, category manual override, category word group, user app settings, and integration client/scope types. |
| `src/utils/domainCategorization.ts` | Client-side domain categorization coordinator. Extracts registrable base/TLD, handles Indonesian second-level TLDs, builds category membership with cached directional membership and symmetric score work from `domainCategorizationScoring.ts`, returns primary plus overlapping category metadata, applies persisted word-group categories, gives word groups primary-category priority, and applies persisted manual include/exclude category overrides without changing the deterministic auto heuristic. |
| `src/utils/domainCategorizationScoring.ts` | Pure category scoring and membership rules. Handles consonant/vowel/full-string/phonetic similarity, meaningful short containment such as `precast = pre + cast` and `lawfirm = law + firm`, trailing one-letter variants such as `firm/firma`, blocks leading one-letter leftovers such as `laman/taman` matching `aman`, blocks short embedded-word false positives such as `bunga` inside `tabunganhajiumroh`, and exposes membership scores used by `domainCategorization.ts`. |
| `src/utils/domainCategorizationScoring.test.ts` | Vitest regression tests for category membership/scoring rules that are easy to break during refactors, including false-positive containment cases. |
| `src/utils/userSettingsStorage.ts` | Shared local fallback/cache helpers for user app settings. Sanitizes category name override maps, category manual include/exclude overrides, category word groups, and Auto Mine name-server rules, normalizes/splits name servers and category words, and reads/writes the legacy localStorage keys used before Supabase settings sync. |
| `src/utils/appDataCache.ts` | User-scoped browser cache for domain snapshots and session-scoped WHOIS provider dashboard status. Lets the UI paint cached data immediately after refresh while Supabase revalidates in the background. |
| `src/utils/appDomainLogic.ts` | Pure app-level domain helpers for `App.tsx`: WHOIS failure reason/advice, missing-WHOIS predicate, expiry/drop notification message selection, reusable expired-domain lifecycle estimates for grace/redemption/drop timing, estimated drop timeline HTML, and JSON/CSV export serialization. |
| `src/utils/appDomainLogic.test.ts` | Vitest regression tests for expired-domain lifecycle phase boundaries and invalid expiry handling. |
| `src/utils/whoisSchedule.ts` | Frontend schedule projection using the signed-in user's pause, target-phase, drop-window, active-cadence, and post-window settings. |
| `src/utils/monitoringSettings.ts` | Frontend balanced defaults and quota-saver/aggressive monitoring presets shared by settings UI and schedule projection. |
| `src/utils/monitoringUnitConversion.ts` | Loss-controlled minutes/hours/days display conversion for Monitoring settings while preserving canonical integer backend values. |
| `src/utils/monitoringUnitConversion.test.ts` | Regression tests for readable day conversion and fractional hour/day round trips. |
| `src/utils/whoisSchedule.test.ts` | Vitest regression tests for schedule visibility, including owned-domain final renewal daily cadence and available-domain schedule skipping. |
| `src/App.tsx` | Main app shell. Handles Supabase session bootstrap, auth state reset, notifications, modal state, mobile-constrained toast placement, small WHOIS-complete toast notifications after background checks, integration settings modal state, unified Add Domains modal state with initial single/bulk tab selection, Add Domains chunk prefetch on idle/intent plus an immediate loading modal fallback, route chunk prefetch on idle/nav intent, instant route switches for already-loaded lazy chunks, instant route transition fallback before still-cold heavy dashboard/categories/docs/settings mounts, view routing for dashboard/categories/settings/docs, settings tab state for WHOIS Providers vs Auto Mine, dashboard row category remove/create-word-group callbacks, capture-phase Add Domains shortcuts (`Ctrl+N` plus `Alt+N` fallback), export downloads, daily/focus date-refresh ticks for stale expiry labels, responsive main spacing/FAB placement, and lazy-loading for docs, categories, settings, Add Domains, and Integration API chunks. Delegates status log state to `useStatusLog.ts`, synced user settings to `useSyncedUserSettings.ts`, provider dashboard state to `useWhoisProviders.ts`, domain list/actions/WHOIS repair to `useDomainActions.ts`, reusable notification/drop/export decisions to `appDomainLogic.ts`, and dashboard/settings rendering to `components/app/*`. |
| `src/hooks/useDarkMode.ts` | Reads/stores theme in `localStorage`, applies/removes `dark` class on `<html>`, returns `[theme, toggleTheme]`. |
| `src/hooks/useOutsideDismiss.ts` | Shared pointer-outside and Escape dismissal behavior for expandable panels, popovers, and controlled details elements. |
| `src/hooks/useDomainActions.ts` | Owns domain list state, session-keyed initial-fetch readiness, Supabase fetch/cache, five-minute and focus/visibility server refreshes for cron updates, transient WHOIS details, optimistic pending rows, bulk actions, tags, rechecks, and automatic missing-WHOIS repair. A newly authenticated user remains in loading state until cache hydration or the first server request completes. |
| `src/hooks/useStatusLog.ts` | Small status-log state hook. Prepends timestamped log entries and keeps the latest 100 messages. |
| `src/hooks/useSyncedUserSettings.ts` | Owns user app settings state. Reads local fallback/cache, fetches synced Supabase settings after login, writes local cache on change, debounces/merges changed category name overrides, manual category overrides, word groups, and Auto Mine rules back to Supabase after settings load, and exposes a reset helper for sign-out. |
| `src/hooks/useWhoisProviders.ts` | Owns WHOIS provider dashboard state. Hydrates cached provider statuses from session storage, fetches provider statuses in the background, merges live quota/error telemetry into existing panel state, writes refreshed status cache, and wraps save/remove operations for optional per-user provider credentials. |
| `src/contexts/CompactModeContext.tsx` | Provides compact mode state, persists it in `localStorage`, and toggles a `compact` class on `<html>`. |
| `src/services/supabaseService.ts` | Creates the typed Supabase client and wraps auth, domain CRUD, integrations, notifications, provider credentials, user settings, and per-user domain monitoring policy read/write operations. |
| `src/services/whoisService.ts` | Client-side WHOIS proxy wrapper. Calls `get-whois`, fetches `get-whois-providers`, normalizes failures to `unknown`, and logs provider usage. |

## Components

| File | Purpose / logic |
| --- | --- |
| `src/components/AutoMinePanel.tsx` | Auto Mine rules panel. Edits app-level synced name-server combination rules, requires at least two unique name servers per rule, normalizes server names, matches only non-available/non-reserved domains whose stored `name_servers` contain every server in a rule, auto-applies matches by asking `App` to update matching rows to `mine`, provides manual apply, enable/disable, remove, matched-domain preview controls, and mobile-friendly grid rule rows. |
| `src/components/app/DashboardView.tsx` | Dashboard view shell. Owns the responsive page chrome around `DomainList`, using lighter edge-to-edge mobile spacing and framed card styling from small screens upward, and passes through list state/actions plus the app-level date-refresh tick from `App`. |
| `src/components/WhoisSchedulePage.tsx` | Dedicated operational view for due-today, next-3-day, next-7-day, and later WHOIS checks. Loads the signed-in user's monitoring policy so projected due times match backend configuration. |
| `src/components/integration/NotificationChannelsPanel.tsx` | Configures enabled Hermes/webhook drop-alert channels and displays recent durable delivery attempts/failures. |
| `src/components/app/SettingsView.tsx` | Lazy settings shell with WHOIS Providers, Monitoring, and Auto Mine tabs. |
| `src/components/MonitoringSettingsPanel.tsx` | Per-user quota-aware monitoring controls. Offers presets, advanced fields with explanatory tooltips, per-field minutes/hours/days selectors, usage estimate, explicit save, and revert. |
| `src/components/headerStyles.ts` | Shared navbar control geometry, icon sizing, neutral colors, and danger styling used by Header, theme, and compact-mode controls. |
| `src/components/floatingActionStyles.ts` | Shared fixed 48px circle geometry, 20px icon size, focus treatment, mobile/desktop bottom and edge offsets, and primary/neutral tone variants for Add Domain and System Status actions. |
| `src/components/Auth.tsx` | Login screen with Google sign-in button calling Supabase OAuth. |
| `src/components/BulkAddModal.tsx` | Unified single/bulk Add Domains modal with duplicate detection, existing matches, file/paste parsing, focus restoration, and explicit tag shortcuts: Enter/Ctrl+Enter for Mine, Shift variants for To Snatch, and Alt variants for Others. |
| `src/components/bulk-add/bulkAddLogic.ts` | Pure Add Domains helpers: domain input normalization/validation, bulk splitting/parsing, skipped-entry log formatting, tag guard/labels, and existing-domain suggestion matching. |
| `src/components/bulk-add/TagChoice.tsx` | Reusable Mine/To Snatch/Others radio card with semantic and working-shortcut tooltip. |
| `src/components/CompactModeToggle.tsx` | Icon button toggling compact/standard view through context, using shared tooltip behavior. |
| `src/components/ConfigErrorScreen.tsx` | Displays missing/invalid Supabase config errors. |
| `src/components/CategoriesPage.tsx` | Dedicated categories view opened from the navbar. Defaults to the lightweight word-group editor only. The heavy auto-category computation/list stays behind a collapsed accordion and only loads when opened. Uses the shared auto categorizer plus persisted word groups and manual overrides once expanded, shows all category groups and overlaps outside the main dashboard, supports creating/editing/toggling/removing word groups such as `steel, besi, baja` with Enter-submit form behavior, editing synced category names, manually adding domains into a category, excluding wrong auto members, resetting category membership overrides, and listing mobile-safe breakable domain chips per category with manually added or word-group chips highlighted. |
| `src/components/DocsPage.tsx` | Renders bundled docs using `marked` with a custom Tailwind HTML renderer, responsive horizontal mobile doc navigation, scroll-safe code/table rendering, and desktop sidebar doc navigation. Uses `dangerouslySetInnerHTML`. |
| `src/components/DomainItem.tsx` | Memoized responsive domain row. Shows Mine/To Snatch/Others row backgrounds, muted registered targets, leading intent icon, status overrides, expiry-derived `Expires today`/`Expiring soon`/`Expired` labels even when the saved tag is Mine, expired-domain grace/redemption/drop lifecycle labels, compressed auto-category and word-group category chips with distinct styling, per-chip remove controls with a tiny pending spinner for manual false-positive exclusions, a plus control for creating word-group categories from a row, TLD chips, incomplete/failed WHOIS overlay, processing state, clickable whois.com links plus a `mine` site-link icon, expiry/purchase controls, reserved-domain state, desktop hover direct tag switcher, mobile touch tag alternatives, row-level spinner while tag changes are saving, recheck/delete actions, and delegates row helpers/tooltip/status badge to `domain-item` modules. |
| `src/components/domain-item/domainItemLogic.ts` | Pure row helpers for dates, urgency/row/text styles, incomplete WHOIS detection, registry status labels/explanations, tag labels/icons/colors, registrar choices, and registrar purchase URLs. |
| `src/components/domain-item/StatusBadge.tsx` | Compact status badge used by `DomainItem`, including available/reserved display text mapping and lifecycle label overrides for expired rows. |
| `src/components/domain-item/TooltipContent.tsx` | Domain tooltip detail rows, plain tooltip text, expired-domain timeline tooltip, registry status explanations, and name-server detail rendering for `DomainItem`. |
| `src/components/DomainList.tsx` | List state and rendering coordinator. Owns persisted filter/sort/category/TLD state including an explicit Uncategorized category filter, deferred keyword filter state, hide-registered-target state, mobile-first scrollable filter/search/action controls, scroll-triggered floating compact filter chip, recheck/export menu state, WHOIS update schedule tracker buckets for due today/next 3 days/next 7 days, category grouping with distinct word-group vs auto-category styling, row-level category remove/create-word-group action wiring, outer overlap wrappers for connected category groups, viewport-tuned incremental rendering with an 1800px preload margin, row mapping, and calls focused `domain-list` helper modules for pure filter/sort/storage logic, filter chips, keyword search UI, and empty/loading/no-match states. |
| `src/components/domain-list/domainListLogic.ts` | Pure `DomainList` helper module. Exports filter/sort types, localStorage keys/readers, 60-row rendered-row constants for the current 10-row visible viewport, missing-WHOIS detection, expiry-derived expiring/expired matching so ownership labels can overlap expiry filters, status filter matching/counts, keyword matching/suggestions, and domain sorting. |
| `src/components/domain-list/domainListLogic.test.ts` | Vitest regression tests for expiry-derived filter overlap, including Mine domains expiring today and registered rows that should be treated as expired by date. |
| `src/components/domain-list/DomainFilterButton.tsx` | Reusable responsive status filter chip used by `DomainList`, including active styling, icon slot, disabled state, and count badge. |
| `src/components/domain-list/KeywordDomainFilter.tsx` | Controlled responsive keyword search input for `DomainList`. Shows the search/clear icons, opens existing-domain suggestions, fills the keyword from a suggestion, and leaves filtering logic in `domainListLogic.ts`. |
| `src/components/domain-list/DomainListEmptyStates.tsx` | Responsive domain-row skeletons shown during confirmed Supabase loading, plus empty-list and no-match views after loading completes. |
| `src/components/ErrorBoundary.tsx` | React class error boundary showing a recoverable error screen with refresh button. |
| `src/components/Header.tsx` | Sticky responsive icon-first header. Shows app logo/title where space allows, docs, categories, integration API, settings, account icon with email tooltip, notifications dropdown, compact/dark toggles, and icon-only logout with tooltip; hides low-priority actions on the narrowest screens and constrains notification width to the viewport. Sends nav hover/focus intent to `App` so lazy route chunks can warm before click. |
| `src/components/icons.tsx` | Lucide React icon wrapper. Re-exports quality-assured Lucide icons under the app's existing icon component names so component imports stay stable. |
| `src/components/IntegrationSettingsModal.tsx` | Integration API token manager. Shows the external API base URL, generates `dcv_live_...` tokens in-browser, stores SHA-256 token hashes through `supabaseService`, lets users choose scopes, shows the raw token once, provides icon-only copy buttons that switch from copy icon to check icon after success, provides a copyable Hermes setup prompt containing the API URL/token and Mine/To Snatch/Others tag rules, stacks long copy/code rows on mobile, lists active/revoked clients, and revokes tokens. |
| `src/components/Modal.tsx` | Portal modal with Escape/backdrop close, title, close button, centered desktop dialog layout, bottom-sheet mobile layout, and scrollable body. |
| `src/components/ModeToggle.tsx` | Responsive dark/light toggle button using `useDarkMode`. |
| `src/components/Spinner.tsx` | Tailwind spinner with size/color props. |
| `src/components/StatusLog.tsx` | Floating viewport-constrained collapsible status log. Uses shared floating-action geometry and infers icon/color from emoji markers in log strings. |
| `src/components/Tooltip.tsx` | Shared instant portal tooltip. Tracks one active tooltip, prepares its trigger-relative anchor before display, performs one measured correction, constrains height to one side so it cannot cover its trigger, and closes on mouse leave, blur, Escape, page hide, and tab/window inactivity. |
| `src/components/WhoisProviderPanel.tsx` | WHOIS provider accordion used in Settings. Shows summary first, then known providers, active/missing-key/not-implemented state, priority, static free-limit labels, live daily/monthly quota when exposed or persisted by telemetry, quota-source support, secret-key names, notes/errors, mobile provider cards, and write-only per-user key inputs for OTI Labs, Domainduck, and RDAP API when expanded. Supports `defaultExpanded` for the Settings tab. |

## Supabase Functions

| File | Purpose / logic |
| --- | --- |
| `supabase/functions/_shared/whois-logic.ts` | Shared server-side WHOIS orchestration. Loads persistent telemetry and user credentials, orders providers by in-flight pressure and priority, skips unavailable/exhausted providers, calls provider adapters, rejects unusable registered/expired responses without expiry dates so the waterfall continues, persists telemetry, and returns normalized WHOIS data with provider attempts. Re-exports shared WHOIS public types. |
| `supabase/functions/_shared/whois-env.ts` | Deno environment access for project-wide WHOIS provider secrets, including legacy `VITE_` secret fallbacks. |
| `supabase/functions/_shared/whois-registry.ts` | Provider registry and lookup helper. Defines provider labels, priorities, limits, env-key metadata, notes, and per-provider configuration checks including user credential overrides. |
| `supabase/functions/_shared/whois-runtime.ts` | Runtime and persistent provider telemetry. Tracks in-flight calls, recent starts, estimated monthly use, quota blocks, Supabase `whois_provider_telemetry` reads/upserts, `claim_whois_provider_attempt(...)`, and user-scoped `whois_provider_credentials` loading. |
| `supabase/functions/_shared/whois-normalize.ts` | WHOIS/RDAP normalization helpers. Parses quota headers, name servers, registry statuses, IANA RDAP bootstrap data, normalized RDAP payloads, and flexible vendor WHOIS payloads. |
| `supabase/functions/_shared/whois-adapters.ts` | Provider adapter implementations for who-dat, WhoisXMLAPI, APILayer, WhoisFreaks, WhoAPI, legacy RapidAPI Domain WHOIS Lookup, RapidAPI Domains API, WhoisJSON, IP2WHOIS, direct IANA RDAP, RDAP.org, OTI Labs, Domainduck, and RDAP API. Exports the provider handler list used by `whois-logic.ts`. |
| `supabase/functions/_shared/whois-types.ts` | Shared WHOIS type definitions used by `whois-logic.ts`, including provider ids, quotas, attempts, normalized data, provider status/config/runtime state, runtime options, and user provider credentials. |
| `supabase/functions/_shared/whois-status.ts` | Shared status inference helpers for WHOIS normalization. Detects conservative reserved-domain signals from provider/RDAP statuses, remarks, notices, descriptions, titles, messages, and errors. |
| `supabase/functions/get-whois/index.ts` | Authenticated edge function for real-time lookups. Handles CORS, validates Supabase user from Authorization header, creates a service-role telemetry/credential client, validates `domainName`, calls shared WHOIS logic with the current `user_id`, and returns JSON. |
| `supabase/functions/get-whois-providers/index.ts` | Authenticated edge function for WHOIS dashboard. Uses service-role telemetry/credential access and returns provider registry/runtime status without exposing secret values. |
| `supabase/functions/check-domains/index.ts` | Cron edge function. Requires `Authorization: Bearer CRON_SECRET`, selects priority checks, updates WHOIS fields, detects target transitions to available/dropped, queues deduplicated alerts, and dispatches pending/failed notifications even when no domain check is due. |
| `supabase/functions/check-domains/notifications.ts` | Durable drop-notification queue and dispatcher. Signs Hermes/webhook payloads, includes the availability detection timestamp, marks sent attempts, and retries failures with exponential backoff. |
| `supabase/functions/_shared/monitoring-settings.ts` | Backend defaults, bounds, and normalization for persisted per-user monitoring policy rows. Balanced defaults use hourly active polling and six-hour post-window polling. |
| `supabase/functions/check-domains/scheduler.ts` | Pure cron scheduling module. Applies per-user pause/cadence/drop-estimate/window settings while retaining conservative code-defined owned-domain renewal checks. |
| `supabase/functions/check-domains/scheduler.test.ts` | Regression tests for terminal skipping, owned expiry cadence, balanced active/post-window monitoring, aggressive 15-minute polling, and pause behavior. |
| `supabase/functions/external-api/index.ts` | Scoped external REST API bootstrap for Hermes/n8n/scripts/future apps. Handles CORS preflight, creates the service-role Supabase client, authenticates integration clients, and dispatches `/api/v1` routes to focused route handlers without exposing Supabase service-role keys. |
| `supabase/functions/external-api/types.ts` | External API route types for integration clients, domain rows/payloads, scopes, tags, and statuses. |
| `supabase/functions/external-api/domain-utils.ts` | External API domain helpers for name/tag normalization, available-like status checks, missing-WHOIS detection, `daysUntil`, and public domain response formatting. |
| `supabase/functions/external-api/alerts.ts` | External API alert helpers for estimated drop timing and exact target drop/reserved/available alert payloads. |
| `supabase/functions/external-api/http.ts` | Shared external API HTTP helpers: CORS headers, JSON responses, and `/api/v1` path normalization. |
| `supabase/functions/external-api/auth.ts` | External API authentication/idempotency helpers. Hashes bearer tokens with SHA-256, validates `integration_clients`, checks scopes, records audit/idempotency events, and reads completed idempotent responses. |
| `supabase/functions/external-api/routes.ts` | External API route handlers for listing/adding domains, rechecking WHOIS, due alerts, and exact-domain drop alerts. Reuses shared WHOIS logic with the integration owner `user_id`. |

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
| `supabase/migrations/20260702090000_fix_notification_delivery_dedupe.sql` | Changes drop-delivery deduplication to one delivery per channel and event so multiple configured channels can each receive the alert. |
| `supabase/migrations/20260702093000_increase_domain_check_cron_frequency.sql` | Finds existing `check-domains` pg_cron jobs and changes their schedule to every 15 minutes while preserving the existing command and authorization header. |
| `supabase/migrations/20260703150000_add_domain_monitoring_settings.sql` | Adds RLS-protected per-user quota-aware monitoring policy, including run cap, target phases, estimated drop timing, and active/post-window cadence. |

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
| `docs/MOBILE_OPTIMIZATION_PLAN.md` | Mobile UI audit and implementation tracker covering responsive shell/header, dashboard filters, rows/actions, modals, secondary pages, docs, settings, and fixed-position UI. |
| `docs/DB.md` | Proposed Cloudflare D1 database architecture. |
| `docs/CLOUDFLARE_WHOIS_PROVIDER_PLAN.md` | Plan for a Cloudflare Workers/D1/R2/KV mini WHOIS/RDAP provider inspired by `who-dat`, including weaknesses to improve, API shape, caching, telemetry, and implementation phases. |
| `docs/INTEGRATIONS.md` | Progress tracker and plan for a versioned external REST/webhook integration layer so Hermes Agent, WhatsApp, n8n, scripts, and future apps can add domains, trigger WHOIS checks, and receive expiry alerts securely. |
| `docs/MIGRATION.md` | Supabase vs Better Auth + D1 decision guide and current auth-last migration recommendation. |
| `docs/OPTIMIZATION.md` | UI performance audit, optimization plan, and progress tracker for keeping the dashboard responsive with hundreds of domains. |
| `docs/OPTMIZATION.md` | Bundle-size optimization tracker created under the user-requested filename. Records the lazy route/modal chunk plan and build-size result for removing Vite's 500 kB JS warning. |
| `docs/RAPIDAPI_WHOIS_PROVIDERS.md` | RapidAPI WHOIS/domain provider research for 20 marketplace listings, including parsed Basic/free-tier status, host names, endpoint capabilities, fit ranking, and implementation notes for separate RapidAPI-backed provider ids. |
| `docs/REFACTOR.md` | Refactor audit and progress tracker for splitting oversized files into focused modules while preserving behavior. |
| `docs/SUGGESTION.md` | Proactive suggestion log. |
| `docs/SUPABASE.md` | Supabase operations guide for this project, including project ref, CLI command rules, Edge Function deploys with `--use-api`, secrets commands without `--use-api`, current secret names, and function roles. |
| `docs/UI.md` | UI/UX audit and improvement plan. |
| `docs/WHOIS.md` | Current WHOIS implementation study, quota behavior, and expanded provider research covering the 8 implemented providers plus more than 10 RDAP/WHOIS backup candidates. |
| `docs/WHOIS_CHECKING_REFINEMENT.md` | Progress tracker and decision record for optional name-server completeness, reserved domains, precise drop-window scheduling, and exact-domain drop alert API. |
| `docs/MONITORING_CONFIGURATION.md` | Implemented settings inventory, balanced defaults, presets, runtime rules, and completion tracker for configurable WHOIS scheduling. |
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
