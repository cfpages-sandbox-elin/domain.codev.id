# Refactor Audit

Progress tracker for splitting large files into smaller modules while preserving current app behavior.

## Audit

| File | Lines | Current responsibility | Refactor plan | Status |
| --- | ---: | --- | --- | --- |
| `supabase/functions/_shared/whois-logic.ts` | 1177 | Provider registry, telemetry, provider adapters, RDAP/WHOIS parsing, reserved detection, waterfall orchestration. | Split later into provider registry, provider adapters, telemetry, normalization/parsing, and orchestration modules. Keep Deno import paths explicit and deploy all affected functions together. | ⬜ Planned |
| `src/components/DomainList.tsx` | 872 | Filter state, keyword suggestions, category/TLD filtering, sorting, grouping, windowed rendering, toolbar UI, recheck/export controls, empty/loading states, row mapping. | First pass: extract filter/sort/storage logic, keyword filter UI, filter chip, and empty states into `src/components/domain-list/*`; leave data flow and rendering behavior unchanged. | ✅ First pass implemented |
| `src/App.tsx` | 827 | Auth/session, domain CRUD, WHOIS sync, bulk processing, user settings sync, notifications, modal/view routing, exports. | Split later into hooks for session/bootstrap, domain actions, user settings sync, notification checks, and dashboard view rendering. Keep public props into `DomainList` stable. | ⬜ Planned |
| `supabase/functions/external-api/index.ts` | 608 | Token auth, request routing, domain CRUD, recheck endpoint, due/drop alerts, audit events. | Split later into auth/scopes, route handlers, response mapping, alert builders, and shared validation utilities. | ⬜ Planned |
| `src/components/DomainItem.tsx` | 515 | Row styling, status/tag controls, WHOIS tooltip detail, registrar purchase controls, row actions. | Split later into status/tag helpers, tooltip details, purchase controls, and row action controls. | ⬜ Planned |
| `src/components/BulkAddModal.tsx` | 467 | Single add, bulk paste/file parsing, duplicate suggestions, tag selection, modal keyboard flow. | Split later into parsing helpers, single-domain form, bulk paste form, file import form, and tag choice components. | ⬜ Planned |
| `src/utils/domainCategorization.ts` | 420 | Domain parsing, similarity scoring, containment heuristics, category grouping, persisted override application. | Split later into parsing, scoring, containment rules, and override application utilities with focused tests before more heuristic changes. | ⬜ Planned |

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
| Update `docs/CODEBASE.md`. | ✅ Done | Recorded new `domain-list` modules and reduced `DomainList` responsibility. |
| Verify with pnpm and remove build output. | ✅ Done | `pnpm exec tsc --noEmit --pretty false` and `pnpm run build` passed; `dist` was removed. |

## Current Pass Result

- `src/components/DomainList.tsx` moved from 872 lines to 647 lines.
- New focused modules: `DomainFilterButton.tsx` 41 lines, `DomainListEmptyStates.tsx` 29 lines, `KeywordDomainFilter.tsx` 88 lines, `domainListLogic.ts` 177 lines.
- Behavior intended to stay unchanged: existing filters, keyword suggestions, counts, sorting, grouping, windowed rendering, recheck/export controls, loading and empty states.
