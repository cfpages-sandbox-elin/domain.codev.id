# UI Performance Optimization

Last updated: 2026-06-05 22:37 WIB.

This tracker exists because the dashboard now has around 675 domains and is starting to feel sluggish.

## Current Audit

| Area | Status | Finding | Impact | First fix |
| --- | --- | --- | --- | --- |
| Category calculation | Done | `categorizeDomains(domains)` compared many anchors against many domains and ran edit-distance helpers repeatedly. | This could block rendering when the domain list changed. | Added pair-level membership/score caching, skipped 3-letter category anchors, and replaced repeated category lookup with a map. |
| Filter counts | Done | Each filter count scanned `contextFilteredDomains` separately. | Seven repeated scans every render. | Count all filters in one pass. |
| Row rendering | Done | Every visible row rendered tooltip detail structures and action handlers. | 675 rows could feel heavy even without virtualization. | Memoized `DomainItem`, memoized tooltip content, and stabilized App row action callbacks with a domain ref. |
| Category groups | Done | Overlapping categories were not intentionally ordered together. | Related groups could be visually separated. | Render category groups by overlap-connected clusters. |
| Tag switching | Done | Row tag action cycled one step at a time. | Changing `Mine` to `Others` required multiple clicks. | Show the other two tag targets on hover/focus and switch directly. |
| List windowing | Done | The first no-dependency render window started at 180 rows, then the second pass used 30-row chunks plus browser render containment. The browser viewport currently shows about 10 rows. | 180+ mounted rows was too much, but `content-visibility` could show blank reserved boxes during fast scrolling. | Use 60-row initial/increment chunks and a larger 1800px preload margin so rows are appended before the user reaches them without deferring row paint. |

## Current Pass Tracker

| Task | Status | Implementation note |
| --- | --- | --- |
| Tune render budget for the observed viewport | Done | Uses 60 initial rows and 60-row increments, around six visible screens at the observed viewport size. |
| Preload upcoming rows while scrolling | Done | The bottom sentinel now uses an 1800px root margin so the next chunk loads before the user reaches the end of the mounted rows. |
| Remove row/group render containment | Done | Removed `content-visibility` from rows/category blocks because it could create temporary blank boxes during fast scrolling. |
| Defer keyword filtering | Done | Uses React deferred keyword state so typing stays responsive while 685 rows are searched/sorted. |
| Defer Categories page auto-group work | Done | Categories now defaults to word groups only; the 195 auto-category calculation and list render are behind a collapsed accordion and only run when opened. |
| Warm Add Domains modal chunk | Done | The Add Domains chunk is prefetched after login/idle and on button intent; if still cold, a loading modal appears immediately instead of a blank delay. |
| Verify with project checks | Done | `pnpm run lint`, `pnpm exec tsc --noEmit --pretty false`, and `pnpm run build` passed. |

## Progress Log

| Date/Time (WIB) | Status | Change | Notes |
| --- | --- | --- | --- |
| 2026-06-05 22:37 WIB | Done | Tightened dashboard scrolling and Add Domains startup. | Replaced `content-visibility` with proactive 60-row chunk preloading, increased the sentinel margin to 1800px, prefetched Add Domains on idle/intent, and added an immediate modal fallback while the chunk loads. |
| 2026-06-05 19:22 WIB | Done | Collapsed heavy Categories page auto-category work. | Word groups are now the default view. Auto categories compute/render only after opening the accordion. |
| 2026-06-05 18:47 WIB | Done | Completed second dashboard list performance pass. | Tuned the render budget for a 10-row visible viewport, added offscreen render containment, deferred keyword filtering, and verified with lint/type/build checks. |
| 2026-06-05 06:27 WIB | Done | Split route-only views and heavy modals into lazy chunks. | `DocsPage`, `CategoriesPage`, settings panels, Add Domains, and Integration API now load on demand. `pnpm run build` no longer emits the 500 kB Vite chunk warning; largest JS chunks are 239.44 kB and 219.79 kB. |
| 2026-06-04 22:48 WIB | Done | Moved secondary panels out of the dashboard. | Categories now live in their own navbar view; WHOIS Providers and Auto Mine live in Settings tabs, reducing dashboard first-render and visual clutter. |
| 2026-06-04 22:31 WIB | Done | Implemented remaining no-dependency optimization plan. | Memoized rows, stabilized row callbacks, and added incremental rendering/windowing for large domain lists. |
| 2026-06-04 22:17 WIB | Done | First performance/UI pass implemented. | Cached categorization scoring, counted filters in one pass, centered filter chips, grouped overlapping categories together, and added direct tag target switching. |
| 2026-06-04 22:05 WIB | In progress | Created optimization tracker and audited first bottlenecks. | First implementation pass will avoid new dependencies. |

## Rules

- Avoid adding dependencies unless the performance win clearly justifies local storage cost.
- Keep `docs/CODEBASE.md` current when implementation changes.
- Prefer cheap deterministic optimizations first: fewer scans, memoized expensive scoring, less row rerendering.
- Treat true fixed-height virtualization as the next escalation only if incremental rendering is still not enough.
