# Refactor Audit

Progress tracker for splitting large files into smaller modules while preserving current app behavior.

## Audit

| File | Lines | Current responsibility | Refactor plan | Status |
| --- | ---: | --- | --- | --- |
| `supabase/functions/_shared/whois-logic.ts` | 212 | WHOIS waterfall orchestration and public provider status/data exports. | Split environment access, provider registry, runtime telemetry, normalization/RDAP parsing, and provider adapters into focused `_shared/whois-*` modules; keep this file as the coordinator. | ✅ Implemented |
| `src/components/DomainList.tsx` | 872 | Filter state, keyword suggestions, category/TLD filtering, sorting, grouping, windowed rendering, toolbar UI, recheck/export controls, empty/loading states, row mapping. | First pass: extract filter/sort/storage logic, keyword filter UI, filter chip, and empty states into `src/components/domain-list/*`; leave data flow and rendering behavior unchanged. | ✅ First pass implemented |
| `src/App.tsx` | 344 | Auth/session, notifications, modal/view routing, settings/category wiring, and exports. | Extracted domain CRUD, optimistic add/bulk workers, WHOIS recheck, Auto Mine updates, auto-repair, and provider dashboard state into focused hooks. | ✅ Implemented |
| `supabase/functions/external-api/index.ts` | 61 | CORS preflight, Supabase admin bootstrap, token authentication, and top-level route dispatch. | Split auth/idempotency, HTTP helpers, route handlers, route types, domain utilities, and alert/drop timing helpers into focused sibling modules. | ✅ Implemented |
| `src/components/DomainItem.tsx` | 515 | Row styling, status/tag controls, WHOIS tooltip detail, registrar purchase controls, row actions. | Extract row helpers, status badge, and tooltip content into `src/components/domain-item/*`; row action layout remains in the row component. | ✅ First pass implemented |
| `src/components/BulkAddModal.tsx` | 467 | Single add, bulk paste/file parsing, duplicate suggestions, tag selection, modal keyboard flow. | Extract parsing helpers and tag choice UI into `src/components/bulk-add/*`; single/bulk form component split remains future work. | ✅ First pass implemented |
| `src/utils/domainCategorization.ts` | 420 | Domain parsing, similarity scoring, containment heuristics, category grouping, persisted override application. | Extract scoring/containment/membership rules to `src/utils/domainCategorizationScoring.ts`; categorization orchestration remains in the original module. | ✅ First pass implemented |

## Implementation Rules

- Refactors should be behavior-preserving unless the user explicitly asks for behavior changes.
- Prefer small modules with one clear reason to change: UI controls, pure list filtering/sorting, data hooks, provider adapters, and route handlers.
- After each refactor pass, run `pnpm exec tsc --noEmit --pretty false` and `pnpm run build`.
- Remove generated `dist` after build verification.
- Update `docs/CODEBASE.md` whenever file responsibilities change.

## Current Pass

| Task | Status | Notes |
| --- | --- | --- |
| Add modular coding guidance to `AGENTS.md`. | ✅ Done | Added guidance to avoid growing already-large files when focused modules/hooks/components are practical. |
| Extract `DomainList` filter/sort/storage logic. | ✅ Done | Added `src/components/domain-list/domainListLogic.ts`. |
| Extract `DomainList` keyword filter UI. | ✅ Done | Added `src/components/domain-list/KeywordDomainFilter.tsx`. |
| Extract `DomainList` filter chip UI. | ✅ Done | Added `src/components/domain-list/DomainFilterButton.tsx`. |
| Extract `DomainList` loading/empty/no-match states. | ✅ Done | Added `src/components/domain-list/DomainListEmptyStates.tsx`. |
| Extract app status log state. | ✅ Done | Added `src/hooks/useStatusLog.ts`. |
| Extract synced user settings state/effects. | ✅ Done | Added `src/hooks/useSyncedUserSettings.ts`. |
| Extract app domain actions/state. | ✅ Done | Added `src/hooks/useDomainActions.ts` for fetch/add/bulk/remove/tag/recheck/auto-repair state. |
| Extract WHOIS provider dashboard state. | ✅ Done | Added `src/hooks/useWhoisProviders.ts` for provider status refresh, credential save/remove, and provider telemetry merging. |
| Extract dashboard/settings view rendering. | ✅ Done | Added `src/components/app/DashboardView.tsx` and `src/components/app/SettingsView.tsx`; settings remains lazy-loaded. |
| Split external API route/auth/http modules. | ✅ Done | Added `auth.ts`, `http.ts`, and `routes.ts`; `index.ts` now handles bootstrap and dispatch only. |
| Split shared WHOIS modules. | ✅ Done | Added `_shared/whois-env.ts`, `_shared/whois-registry.ts`, `_shared/whois-runtime.ts`, `_shared/whois-normalize.ts`, and `_shared/whois-adapters.ts`. |
| Add lightweight regression tests. | ✅ Done | Added Vitest tests for category scoring and targeted cron scheduling; `pnpm run test:regression` passes. |
| Update `docs/CODEBASE.md`. | ✅ Done | Recorded new `domain-list` modules and reduced `DomainList` responsibility. |
| Verify with tests, pnpm, lint, build, and Supabase API deploy. | ✅ Done | `pnpm run test:regression`, `pnpm run lint`, `pnpm exec tsc --noEmit --pretty false`, and `pnpm run build` passed; generated `dist` output is ignored by git. Deployed `get-whois`, `get-whois-providers`, `check-domains`, and `external-api` with `npx supabase@latest functions deploy ... --use-api`. |

## Current Pass Result

- `src/App.tsx` moved from 827 lines to 344 lines after extracting app helpers, status logs, settings sync, provider state, domain actions, and view modules.
- `src/components/DomainList.tsx` moved from 872 lines to 703 lines.
- New focused `domain-list` modules: `DomainFilterButton.tsx` 44 lines, `DomainListEmptyStates.tsx` 32 lines, `KeywordDomainFilter.tsx` 91 lines, `domainListLogic.ts` 199 lines.
- `src/components/DomainItem.tsx` moved from 515 lines to 344 lines.
- `src/components/BulkAddModal.tsx` moved from 467 lines to 398 lines.
- `src/utils/domainCategorization.ts` moved from 420 lines to 274 lines.
- `supabase/functions/_shared/whois-logic.ts` moved from 1202 lines to 212 lines, with focused shared modules for env, registry, runtime telemetry, normalization, and provider adapters.
- `supabase/functions/external-api/index.ts` moved from 608 lines to 61 lines, with route handlers in `routes.ts`.
- `supabase/functions/check-domains/index.ts` moved from 333 lines to 174 lines.
- Added `src/utils/appDomainLogic.ts`, `src/components/app/*`, `src/hooks/useStatusLog.ts`, `src/hooks/useSyncedUserSettings.ts`, `src/hooks/useDomainActions.ts`, `src/hooks/useWhoisProviders.ts`, `src/components/domain-item/*`, `src/components/bulk-add/*`, `src/utils/domainCategorizationScoring.ts`, `src/utils/domainCategorizationScoring.test.ts`, `supabase/functions/external-api/*`, `supabase/functions/check-domains/scheduler.ts`, `supabase/functions/check-domains/scheduler.test.ts`, and shared WHOIS status/type/env/registry/runtime/normalize/adapter modules.
- Verification completed with `pnpm run test:regression`, `pnpm run lint`, `pnpm exec tsc --noEmit --pretty false`, `pnpm run build`, and Supabase API deployment of `get-whois`, `get-whois-providers`, `check-domains`, and `external-api`.
- Behavior intended to stay unchanged: existing filters, keyword suggestions, counts, sorting, grouping, windowed rendering, recheck/export controls, loading and empty states.

## Remaining Follow-Up

- `src/components/DomainList.tsx` remains the largest frontend component at about 703 lines. It is already split into helper/UI modules, but further subdivision should focus on concrete future changes rather than line count alone.
- `supabase/functions/external-api/routes.ts` is the next external API split candidate if it grows; keep individual route helpers in their own modules once endpoint behavior changes require it.
