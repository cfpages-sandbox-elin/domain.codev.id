# UI Performance Optimization

Last updated: 2026-06-04 22:48 WIB.

This tracker exists because the dashboard now has around 675 domains and is starting to feel sluggish.

## Current Audit

| Area | Status | Finding | Impact | First fix |
| --- | --- | --- | --- | --- |
| Category calculation | Done | `categorizeDomains(domains)` compared many anchors against many domains and ran edit-distance helpers repeatedly. | This could block rendering when the domain list changed. | Added pair-level membership/score caching, skipped 3-letter category anchors, and replaced repeated category lookup with a map. |
| Filter counts | Done | Each filter count scanned `contextFilteredDomains` separately. | Seven repeated scans every render. | Count all filters in one pass. |
| Row rendering | Done | Every visible row rendered tooltip detail structures and action handlers. | 675 rows could feel heavy even without virtualization. | Memoized `DomainItem`, memoized tooltip content, and stabilized App row action callbacks with a domain ref. |
| Category groups | Done | Overlapping categories were not intentionally ordered together. | Related groups could be visually separated. | Render category groups by overlap-connected clusters. |
| Tag switching | Done | Row tag action cycled one step at a time. | Changing `Mine` to `Others` required multiple clicks. | Show the other two tag targets on hover/focus and switch directly. |
| List windowing | Done | All matching rows rendered at once. | Biggest initial-render cost with hundreds of domains. | Added no-dependency incremental rendering: initial 180 domains, then 120 more via bottom sentinel or manual Load more. |

## Progress Log

| Date/Time (WIB) | Status | Change | Notes |
| --- | --- | --- | --- |
| 2026-06-04 22:48 WIB | Done | Moved secondary panels out of the dashboard. | Categories now live in their own navbar view; WHOIS Providers and Auto Mine live in Settings tabs, reducing dashboard first-render and visual clutter. |
| 2026-06-04 22:31 WIB | Done | Implemented remaining no-dependency optimization plan. | Memoized rows, stabilized row callbacks, and added incremental rendering/windowing for large domain lists. |
| 2026-06-04 22:17 WIB | Done | First performance/UI pass implemented. | Cached categorization scoring, counted filters in one pass, centered filter chips, grouped overlapping categories together, and added direct tag target switching. |
| 2026-06-04 22:05 WIB | In progress | Created optimization tracker and audited first bottlenecks. | First implementation pass will avoid new dependencies. |

## Rules

- Avoid adding dependencies unless the performance win clearly justifies local storage cost.
- Keep `docs/CODEBASE.md` current when implementation changes.
- Prefer cheap deterministic optimizations first: fewer scans, memoized expensive scoring, less row rerendering.
- Treat true fixed-height virtualization as the next escalation only if incremental rendering is still not enough.
