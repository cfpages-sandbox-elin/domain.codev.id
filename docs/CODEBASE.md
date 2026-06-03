# Codebase Map

Last audited: 2026-06-03 13:09 WIB.

## Overview

This project is a Vite + React + TypeScript domain tracker. The current app uses Supabase for Google OAuth, domain persistence, and Edge Functions. WHOIS checks are proxied through Supabase functions so API keys stay server-side. The future target is Cloudflare D1 plus Better Auth.

## Runtime Flow

1. `src/index.tsx` mounts React into `#root`, wraps the app with `ErrorBoundary` and `CompactModeProvider`, and imports Tailwind CSS.
2. `src/App.tsx` initializes Supabase, reads the current auth session, subscribes to auth state, fetches domains after login, and renders either auth, dashboard, docs, loading, or config error views.
3. User domain actions call `src/services/supabaseService.ts` for CRUD and `src/services/whoisService.ts` for WHOIS.
4. `whoisService.ts` invokes Supabase Edge Function `get-whois`.
5. `supabase/functions/get-whois/index.ts` authenticates the Supabase user and calls shared provider waterfall logic in `supabase/functions/_shared/whois-logic.ts`.
6. `supabase/functions/check-domains/index.ts` is intended for scheduled checks. It uses a cron secret, service role key, and shared WHOIS logic to update expired or stale domains.

## Current Stack

| Layer | Current implementation |
| --- | --- |
| Frontend | Vite, React 18, TypeScript |
| Styling | Tailwind CSS, class-based dark mode |
| Auth | Supabase Auth with Google OAuth |
| Database | Supabase Postgres table assumed as `domains` |
| Backend/API | Supabase Edge Functions |
| WHOIS providers | `who-dat`, WhoisXMLAPI, APILayer, WhoisFreaks, WhoAPI, RapidAPI waterfall |
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
| `package.json` | Scripts and dependencies. Scripts: `dev`, `build`, `lint`, `preview`. Main dependencies: React, Supabase JS, marked. |
| `postcss.config.js` | PostCSS config with Tailwind and Autoprefixer. |
| `prd.md` | Product requirements and implementation status for the domain tracker. Still names Supabase as the backend. |
| `README.md` | Setup, feature, database, Supabase Edge Function, provider, and deployment instructions. |
| `tailwind.config.js` | Tailwind content globs, class dark mode, brand colors, and a slow spin animation. |
| `tsconfig.json` | Strict frontend TypeScript config; includes only `src`. |
| `tsconfig.node.json` | TypeScript config for Vite/Tailwind/PostCSS config files. |
| `vite.config.ts` | Vite React plugin config with `base: '/'`. |

## Frontend Source

| File | Purpose / logic |
| --- | --- |
| `src/index.tsx` | React startup. Handles missing root element and renders a styled fatal startup error if mounting fails. |
| `src/index.css` | Tailwind base/components/utilities imports. |
| `src/env.d.ts` | Types Vite env vars for Supabase URL/anon key and `import.meta.glob` for markdown docs. |
| `src/types.ts` | Core domain, WHOIS result, quota, provider attempt, and provider status types. |
| `src/App.tsx` | Main state machine. Handles session, domain list, notifications, logs, modals, bulk processing, filtering entry points, add/remove/toggle/recheck/export flows, background sync for `mine` domains, and estimated drop timeline modal. |
| `src/hooks/useDarkMode.ts` | Reads/stores theme in `localStorage`, applies/removes `dark` class on `<html>`, returns `[theme, toggleTheme]`. |
| `src/contexts/CompactModeContext.tsx` | Provides compact mode state, persists it in `localStorage`, and toggles a `compact` class on `<html>`. |
| `src/services/supabaseService.ts` | Creates Supabase client, exposes config error, wraps auth (`getSession`, Google sign-in, sign-out), and domain CRUD functions. Defines Supabase-ish database types manually. |
| `src/services/whoisService.ts` | Client-side WHOIS proxy wrapper. Calls `get-whois`, fetches `get-whois-providers`, normalizes failures to `unknown`, and logs provider usage. |

## Components

| File | Purpose / logic |
| --- | --- |
| `src/components/Auth.tsx` | Login screen with Google sign-in button calling Supabase OAuth. |
| `src/components/BulkAddModal.tsx` | Modal for pasted bulk domains and JSON/CSV import. Splits pasted input by whitespace/comma. Parses JSON arrays and CSV with `domain_name` plus optional `tag`. |
| `src/components/CompactModeToggle.tsx` | Icon button toggling compact/standard view through context. |
| `src/components/ConfigErrorScreen.tsx` | Displays missing/invalid Supabase config errors. |
| `src/components/DocsPage.tsx` | Renders bundled docs using `marked` with a custom Tailwind HTML renderer and sidebar doc navigation. Uses `dangerouslySetInnerHTML`. |
| `src/components/DomainForm.tsx` | Single-domain entry form. Validates a dot exists, adds as `mine` or `to-snatch`, supports Enter and Shift+Enter shortcuts. |
| `src/components/DomainItem.tsx` | Domain row. Shows status/tag badges, urgency colors, expiry info, registrar purchase dropdown for available domains, recheck button for unknown status, tag switch, delete, and expired-domain info action. |
| `src/components/DomainList.tsx` | List controls and rendering. Supports filters, sort dropdown, visible-list recheck, import/export menus, empty states, and maps domains to `DomainItem`. |
| `src/components/ErrorBoundary.tsx` | React class error boundary showing a recoverable error screen with refresh button. |
| `src/components/Header.tsx` | Sticky header. Shows brand button, docs nav, user email, notifications dropdown, compact/dark toggles, and logout. |
| `src/components/icons.tsx` | Inline SVG icon components used throughout the UI. |
| `src/components/Modal.tsx` | Portal modal with Escape/backdrop close, title, close button, and scrollable body. |
| `src/components/ModeToggle.tsx` | Dark/light toggle button using `useDarkMode`. |
| `src/components/Spinner.tsx` | Tailwind spinner with size/color props. |
| `src/components/StatusLog.tsx` | Floating collapsible status log. Infers icon/color from emoji markers in log strings. |
| `src/components/WhoisProviderPanel.tsx` | Dashboard provider panel. Shows known providers, active/missing-key/not-implemented state, free-limit labels, quota from runtime checks, and notes/errors. |

## Supabase Functions

| File | Purpose / logic |
| --- | --- |
| `supabase/functions/_shared/whois-logic.ts` | Shared server-side WHOIS provider waterfall. Reads provider keys from Deno env, checks providers in order, maps each provider response to `{ status, expirationDate, registeredDate, registrar }`, and returns `unknown` after all fail. |
| `supabase/functions/get-whois/index.ts` | Authenticated edge function for real-time lookups. Handles CORS, validates Supabase user from Authorization header, validates `domainName`, calls shared WHOIS logic, and returns JSON. |
| `supabase/functions/get-whois-providers/index.ts` | Authenticated edge function for WHOIS dashboard. Returns provider registry status without exposing secret values. |
| `supabase/functions/check-domains/index.ts` | Cron edge function. Requires `Authorization: Bearer CRON_SECRET`, uses service role Supabase client, selects expired/expiry-past domains, checks WHOIS, marks dropped/available domains, and upserts updates. |

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
| `docs/MIGRATION.md` | Supabase vs Better Auth + D1 decision guide and current auth-last migration recommendation. |
| `docs/SUGGESTION.md` | Proactive suggestion log. |
| `docs/UI.md` | UI/UX audit and improvement plan. |
| `docs/WHOIS.md` | Current WHOIS implementation study and researched free-tier provider options. |
| `docs/WHOIS_DASHBOARD.md` | Requirements and implementation guide for provider quota/status dashboard and backup providers. |
| `docs/AUTH.md` | Current Supabase Auth notes and Better Auth migration guide. |

## Notable Implementation Gaps

| Area | Observation |
| --- | --- |
| Backend direction | Current code is deeply wired to Supabase. Migrating to Cloudflare D1 requires replacing auth, database service calls, edge functions, cron, and env names. |
| Bulk import | Bulk add exists, but it calls per-domain add/check from the client in batches. Future D1/Workers version should submit a bulk job and process server-side. |
| Sorting | `DomainList` has an `added-desc` comparator bug. |
| Docs | In-app docs are static TypeScript strings; markdown files are not automatically loaded. |
| Security | `get-whois` CORS allows `*`; production should restrict origins. |
| Duplicates/artifacts | Empty root scaffold files and import-map entries were removed. |
