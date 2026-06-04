# Bundle Optimization

Progress tracker for reducing Vite production chunks below the 500 kB warning threshold.

## Plan

| Step | Status | Implementation |
| --- | --- | --- |
| Identify eager imports that are not needed for the first dashboard render. | ✅ Done | `DocsPage` eagerly imports `marked` and all `/docs/*.md`; categories, settings panels, and large modals are also not needed for initial dashboard load. |
| Split route-level views with `React.lazy`. | ✅ Done | Lazy-loaded docs, categories, and settings-only panels so the dashboard chunk does not include their code. |
| Split rarely opened modals. | ✅ Done | Lazy-loaded Add Domains and Integration API modals, and only render them when open. |
| Add a shared loading fallback for lazy chunks. | ✅ Done | Added a centered existing `Spinner` fallback through `Suspense` without adding new dependencies. |
| Build with pnpm and inspect chunk sizes. | ✅ Done | `pnpm run build` produced no 500 kB Vite warning. Largest JS chunks: `index` 239.44 kB, `DocsPage` 219.79 kB. Manual chunks are not needed. |
| Update `docs/CODEBASE.md`. | ✅ Done | Documented lazy view/modal loading and that no Vite config change was needed. |

## Decisions

- Prefer route-level dynamic imports before manual Rollup chunking because it removes unused screens from the initial dashboard path.
- Keep dashboard-critical pieces eager: `Header`, `DomainList`, `DomainItem`, auth, config error, status log, and small shared modal/tooltip components.
- Do not add dependencies for bundle analysis unless the production build output is insufficient.
- Use pnpm only for verification.

## Result

The production bundle is now split into dashboard, docs, categories, settings panels, and modal chunks. The Vite 500 kB warning is gone without changing `vite.config.ts`.
