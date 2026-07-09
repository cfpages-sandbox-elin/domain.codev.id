# UI Performance Optimization

Last updated: 2026-07-10 WIB.

This tracker exists because the dashboard now has around 675 domains and is starting to feel sluggish.

**Related plan (hover lag root causes + next pass design):**  
`docs/PERFORMANCE_AND_RANK_TRACKING_PLAN.md`

**Related product (rank tracking MVP — implement after list feels smooth):**  
`docs/SERP_RANK_TRACKING.md`

---

## Next pass (2026-07-10) — hover / list lag

User report: cursor traversal feels laggy; hover show/hide controls suspected.

| Task | Status | Implementation note |
| --- | --- | --- |
| Shared single `TooltipHost` portal | 🟡 In progress | Rewrite triggers to lightweight enter/leave; mount host once in App. May be partially on disk — finish and verify. |
| Reduce DomainItem tooltip count | 🟡 In progress | Rich tooltip only for WHOIS domain details (+ buy/drop where needed); actions use title/aria-label. |
| Flatten nested tooltips | 🟡 In progress | Site link must not sit inside domain-name tooltip host. |
| Cheaper row paint | 🟡 In progress | `transition-colors` only; drop grayscale/saturate; mute with opacity. |
| Desktop XOR mobile tag alternate UI | 🟡 In progress | `isDesktopLayout` / matchMedia; do not mount both trees. |
| Stable categoryLabels map | ❌ Not started | Precompute Map in DomainList; pass stable array refs. |
| Sliding window (unmount offscreen rows) | ❌ Not started | Replace top-N append with start/end range + spacers. |
| dateRefreshTick only on day change | ❌ Not started | Avoid full filter recompute on every window focus. |
| Domain refresh referential equality | ❌ Not started | Optional: keep domains array ref when server snapshot unchanged. |
| Verify lint/tsc/build + manual cursor scrub | ❌ Not started | Required before calling the pass Done. |

## Current Audit

| Area | Status | Finding | Impact | First fix |
| --- | --- | --- | --- | --- |
| Category calculation | Done | `categorizeDomains(domains)` compared many anchors against many domains and ran edit-distance helpers repeatedly. | This could block rendering when the domain list changed. | Added pair-level membership/score caching, skipped 3-letter category anchors, and replaced repeated category lookup with a map. |
| Filter counts | Done | Each filter count scanned `contextFilteredDomains` separately. | Seven repeated scans every render. | Count all filters in one pass. |
| Row rendering | Done | Every visible row rendered tooltip detail structures and action handlers. | 675 rows could feel heavy even without virtualization. | Memoized `DomainItem`, memoized tooltip content, and stabilized App row action callbacks with a domain ref. |
| Category groups | Done | Overlapping categories were not intentionally ordered together. | Related groups could be visually separated. | Render category groups by overlap-connected clusters. |
| Tag switching | Done | Row tag action cycled one step at a time. | Changing `Mine` to `Others` required multiple clicks. | Show the other two tag targets on hover/focus and switch directly. |
| List windowing | Done | The first no-dependency render window started at 180 rows, then the second pass used 30-row chunks plus browser render containment. The browser viewport currently shows about 10 rows. | 180+ mounted rows was too much, but `content-visibility` could show blank reserved boxes during fast scrolling. | Use 60-row initial/increment chunks and a larger 1800px preload margin so rows are appended before the user reaches them without deferring row paint. |
| Tooltip hover dispatch | Done | Every mounted tooltip subscribed to a global listener set, so opening one tooltip notified every row tooltip. | Hover cost grew with mounted tooltip count and could delay pointer/paint feedback on dense lists. | Keep one active-tooltip reference and dismiss only the previously active tooltip. |
| Cursor consistency | Done | Interactive elements relied on mixed browser defaults and scattered `cursor-*` classes. | Buttons could show an arrow while labels/details showed a hand, making feedback look delayed or stuck. | Apply a CSS-only pointer cursor policy to enabled interactive controls and explicit disabled cursors. |
| Hover prefetch | Done | Header and Add Domain controls started dynamic imports on mouse enter even though chunks are already prefetched on idle and loaded on click/focus. | Module download/parse work could compete with the first hover paint on slower devices. | Remove mouse-enter imports; retain idle warmup, keyboard focus intent, and click-time loading fallback. |
| Floating actions | Done | System Status and Add Domain used different padding, responsive sizes, borders, icon sizes, and hover scaling. | The two persistent actions looked unrelated and their visual hit areas changed by viewport. | Use one fixed 48px shared button geometry and 20px icon size with neutral/primary tone variants. |
| Floating action offsets | Done | The two circles still used separate bottom and horizontal viewport offsets after sharing button geometry. | Equal-size controls remained visibly misaligned and Add Domain moved differently across breakpoints. | Share bottom clearance and edge spacing; vary only left/right side and color tone. |
| Tooltip first paint | Done | A tooltip first rendered with stale/default coordinates and relied on a layout-effect state update before reaching its final anchor; scroll also performed synchronous updates for every event. | Under main-thread pressure, tooltip appearance could feel late even though no delay timer existed. | Compute a cheap trigger-relative anchor before showing, perform one measured correction after portal mount, and coalesce scroll/resize repositioning to one animation frame. |
| Tooltip overlap | Done | Large WHOIS tooltips were viewport-clamped without preserving a gap from their trigger. | A tooltip could move across and cover the domain name that opened it. | Constrain height to the selected side and flip to the side with room; never clamp through the trigger rectangle. |
| Add-tag shortcuts | Done | Mine and To Snatch shortcuts existed only in surrounding tooltips, while Others had no shortcut. | Keyboard behavior was hard to discover and incomplete. | Put meaning plus shortcut on each tag choice and add Alt-based Others shortcuts for single/bulk entry. |

## Current Pass Tracker

| Task | Status | Implementation note |
| --- | --- | --- |
| Tune render budget for the observed viewport | Done | Uses 60 initial rows and 60-row increments, around six visible screens at the observed viewport size. |
| Preload upcoming rows while scrolling | Done | The bottom sentinel now uses an 1800px root margin so the next chunk loads before the user reaches the end of the mounted rows. |
| Remove row/group render containment | Done | Removed `content-visibility` from rows/category blocks because it could create temporary blank boxes during fast scrolling. |
| Defer keyword filtering | Done | Uses React deferred keyword state so typing stays responsive while 685 rows are searched/sorted. |
| Defer Categories page auto-group work | Done | Categories now defaults to word groups only; the 195 auto-category calculation and list render are behind a collapsed accordion and only run when opened. |
| Warm Add Domains modal chunk | Done | The Add Domains chunk is prefetched after login/idle and on button intent; if still cold, a loading modal appears immediately instead of a blank delay. |
| Paint route transitions before heavy page mounts | Done | Header navigation now shows an immediate route-loading view, preloads the target chunk, then mounts the target page on the next frame so heavy dashboard/category/docs/settings work does not make the click feel stuck. |
| Page/data cache strategy | Done | Do not wait on Supabase just to navigate. Use already-loaded React state first, hydrate domains from a user-scoped local stale cache after refresh, revalidate Supabase in the background, debounce category/settings writes while the user is tidying, and cache provider dashboard status for immediate settings paint. |
| Tag update feedback | Done | Changing Mine / To Snatch / Others waits on Supabase and could feel stuck. Track per-domain tag updates and show a small spinner/disabled tag controls for only the row being changed. |
| Verify with project checks | Done | `pnpm run lint`, `pnpm exec tsc --noEmit --pretty false`, and `pnpm run build` passed. |
| Optimize hover/cursor interaction path | Done | Replaced tooltip listener fan-out, standardized cursor CSS, removed hover prefetch work, anchored tooltip first paint, prevented trigger overlap, and unified floating actions and offsets. |

## Current Cache/Navigation Plan

| Idea | Decision | Implementation note |
| --- | --- | --- |
| Keep domain rows in memory across app pages | Keep | `useDomainActions` already owns domains at app-shell level, so dashboard/categories/settings share the same array and page switching should not refetch domains. |
| Hydrate domains from browser cache after reload | Implement | Read a user-scoped local snapshot immediately after session is known, render it as stale data, then fetch Supabase in the background and replace/cache the fresh rows. |
| Debounce category/settings saves | Implement | Category word-group/manual override/name edits currently call Supabase on every state change. Merge pending setting patches and save after a short idle delay so rapid tidying becomes one write. |
| Cache provider status | Implement lightly | Keep the latest provider dashboard state in session storage and show it immediately while the provider function refreshes in the background. |
| Always show route spinner before page switch | Change | If a lazy page chunk has already loaded from idle/hover prefetch, switch views immediately. Keep the spinner only for genuinely cold chunks. |
| Add server pagination for domains | Defer | With 685 rows, local stale-while-revalidate plus list windowing should be enough. Server pagination becomes useful after several thousand rows or multi-user/admin views. |

## Progress Log

| Date/Time (WIB) | Status | Change | Notes |
| --- | --- | --- | --- |
| 2026-07-10 | Planned / WIP | Started next hover/list lag pass; paused to lock plans in markdown. | Full checklist in this file + `PERFORMANCE_AND_RANK_TRACKING_PLAN.md`. Rank work tracked in `SERP_RANK_TRACKING.md`. |
| 2026-07-03 17:32 WIB | Done | Completed hover/cursor and floating-action pass. | Cursor changes are CSS-only; tooltip activation is O(1) instead of broadcasting to every mounted tooltip; persistent floating circles share one size/style system. |
| 2026-07-03 17:32 WIB | Done | Completed tooltip placement and tag-shortcut follow-up. | Tooltips anchor before display, stay off their trigger, and tag choices expose working Mine/To Snatch/Others shortcuts. |
| 2026-06-06 14:18 WIB | Done | Completed stale-cache and reduced-Supabase-call pass. | Added user-scoped local domain snapshots, session-cached provider statuses, debounced merged app-settings writes, immediate route switches for warmed chunks, and row-level tag-update spinners. |
| 2026-06-06 08:11 WIB | Done | Started stale-cache and reduced-Supabase-call pass. | Focus: no Supabase wait on page change, cache domain/provider data locally, and debounce category/settings writes during cleanup. |
| 2026-06-05 23:21 WIB | Done | Added instant route transition feedback. | Page navigation now paints a spinner/message immediately, prefetches route chunks on idle and nav intent, and mounts heavy pages after the browser has had a frame to respond. |
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
