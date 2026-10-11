# Performance Audit + Rank Tracking Integration Plan

Last updated: 2026-07-14 WIB  
Implementation status: **Performance pass done · Rank MVP code shipped (ops: migrate + deploy + paste keys)**

This document is the durable map for:

1. Dashboard lag fixes (hover / tooltips / list windowing).
2. How rank tracking plugs into the existing app.

**Rank product details and the 10 SERP provider research live in:**  
→ [`docs/SERP_RANK_TRACKING.md`](./SERP_RANK_TRACKING.md)

**UI performance pass tracker lives in:**  
→ [`docs/OPTIMIZATION.md`](./OPTIMIZATION.md)

---

## Part A — Performance audit

### Context

Earlier pass (`docs/OPTIMIZATION.md`, ~2026-07-03): memoized rows, category caches, one-pass filter counts, 60-row incremental mount, deferred keyword search, O(1) active tooltip dismiss, lazy routes, stale-while-revalidate domain cache.

With ~600–700 domains, remaining lag is **interaction cost on already-mounted rows**, not first-load bundle size.

### Primary lag sources (ranked)

| Priority | Area | What happens today | Why it feels laggy | Recommended fix | Status |
| --- | --- | --- | --- | --- | --- |
| P0 | Tooltip density + per-instance portals | Many `Tooltip`s per row (~8–12) × 60+ rows | Cursor traversal pays state/layout/portal work | **Shared `TooltipHost`** + lightweight triggers; only one portal | ✅ Done |
| P0 | List is top-N append only | `INITIAL_RENDERED_DOMAINS=60`, +60 never unmounts above | Deep scroll mounts most of the list | **Progressive sentinel rendering + `content-visibility: auto`** (superseded jittery sliding window spacer unmounting) | ✅ Done |
| P1 | Hover tag switcher + nested tooltips | Opacity fade-in alternates + tooltips on each | Paint + pointer churn while moving | No opacity animation; `title`/`aria-label` on alt tags; desktop **or** mobile tree | ✅ Done |
| P1 | Expensive row paint | `transition-all`, grayscale/saturate filters | Broad invalidation | `transition-colors` only; mute with opacity/border | ✅ Done |
| P1 | Unstable `categoryLabels` arrays | New array every parent render | O(rows) memo compares | Stable `Map<domainId, labels>` by reference | ✅ Done |
| P2 | `dateRefreshTick` on every focus | Full filter pipeline recompute | Hitch on tab return | Bump only when local calendar day changed | ✅ Done |
| P2 | Dual mobile + desktop tag DOM | Both trees mounted; CSS hides one | Extra nodes | `isDesktopLayout` / matchMedia, render one | ✅ Done |
| P3 | Nested tooltip under domain name | Site link tooltip inside domain tooltip | Show/hide thrash | Flatten; site link uses `title` only | ✅ Done |
| P3 | 5‑min full domain refetch identity | Full array replace → re-categorize | Hitches while browsing | Keep previous array ref if rows unchanged | ✅ Done |
| P3 | Full re-categorize | `categorizeDomains` on any domains identity change | Tag/WHOIS update cost | Incremental / fingerprint cache (later) | ❌ Deferred |

### Hover: root cause ranking

1. **Highest:** many React tooltip triggers + portal/layout work  
2. **High:** growing mounted row count without unmount  
3. **Medium:** transitions + CSS filters  
4. **Lower alone:** pure CSS `group-hover` without React state  

### Performance implementation checklist (do in order)

#### P-1 Shared tooltip host

- [x] `TooltipHost` mounted once at app root (`App`)
- [x] `Tooltip` triggers only attach enter/leave/focus; **no portal per instance**
- [x] Single active tooltip state module-level
- [x] Position: cheap anchor + one measured correction; scroll/resize rAF-coalesced
- [x] Escape / blur / pagehide / visibility hide

#### P-2 Cheaper DomainItem

- [x] Keep rich tooltip **only** on domain name (WHOIS details) and buy / drop-timeline where needed
- [x] Recheck, delete, tag, category remove, site link: `title` + `aria-label` (no Tooltip)
- [x] No nested tooltips
- [x] `transition-colors` not `transition-all`
- [x] Drop `grayscale` / `saturate`; use opacity for muted registered targets
- [x] Desktop **or** mobile alternate-tag UI via `isDesktopLayout` prop
- [x] Alternate tags: no nested Tooltip; `title` only
- [x] Memo: prefer `categoryLabels` **reference equality** first

#### P-3 DomainList progressive rendering + stable labels

- [x] Progressive sentinel rendering (`INITIAL_RENDERED_DOMAINS=80`, `RENDER_INCREMENT=60`) via `IntersectionObserver`
- [x] Zero top-spacer layout shift and zero scroll jumping; native browser offscreen culling via CSS `content-visibility: auto`
- [x] Category mode: stable sequential category group rendering without domain reshuffling or card pop-in/out
- [x] Precompute `categoryLabelsByDomainId: Map<number, labels[]>` in `useMemo`
- [x] Pass stable label array references into `DomainItem`

#### P-4 App tick + refresh polish

- [x] `dateRefreshTick`: on focus/visibility, update **only if** local date string changed
- [x] Domain server refresh keeps array reference when snapshot equal

#### P-5 Verify

- [x] Lint / tsc / build / regression tests
- [ ] Manual: scrub cursor across 60+ rows; scroll deep list without progressive lag

### Suggested files to touch (performance)

| File | Change |
| --- | --- |
| `src/components/Tooltip.tsx` | Shared host + lightweight trigger |
| `src/App.tsx` or `src/index.tsx` | Mount `<TooltipHost />` once; fix date tick |
| `src/components/DomainItem.tsx` | Fewer tooltips, cheaper paint, layout branch |
| `src/components/DomainList.tsx` | Sliding window + stable category label map |
| `src/components/domain-list/domainListLogic.ts` | Window constants / helpers if needed |
| `docs/OPTIMIZATION.md` | Mark tasks Done with notes |

### Interrupted WIP note (2026-07-10)

A partial pass may already exist on disk:

- Rewritten `Tooltip.tsx` (shared host pattern) — **confirm `TooltipHost` is mounted once in App**
- Rewritten `DomainItem.tsx` (fewer tooltips, paint tweaks) — **confirm memo + list wiring**

Before continuing rank work, **finish and verify the performance checklist** so rank UI does not ship on a laggy list.

---

## Part B — Rank tracking (summary)

Full schema, 10-provider research, adapter contract, UI, and backend checklist:

**→ [`docs/SERP_RANK_TRACKING.md`](./SERP_RANK_TRACKING.md)**

### Integration principles (do not lose)

1. **Keyword-centric SERP**, domain-centric derived ranks.  
2. **One SERP fetch** per `(keyword, engine, locale, device, location)`.  
3. Store snapshot once; derive all domain positions from it.  
4. **Server-side only** API keys (user paste in Settings → Edge Function service role read).  
5. **Dedicated Ranks view** — do not bolt matrix UI onto every domain row.  
6. Mirror WHOIS patterns: provider registry, credentials table without browser SELECT, waterfall + telemetry, cron function.  
7. Rotate **~10 free-tier SERP APIs**; respect free limits via skip/telemetry/caps.  
8. Storage: R2 preferred; MVP may use `rank_checks.serp_json` until R2 is wired.

### Recommended global sequence

1. Finish **performance P-1 → P-4** and verify list feels smooth.  
2. Migration + SERP adapters + `get-serp-providers` + credential save UI.  
3. `check-ranks` + position derivation.  
4. **Ranks** page (CRUD keyword, multi-domain attach, matrix, check now).  
5. Cron + optional R2 + external API scopes later.

### Open decisions (defaults in SERP doc)

| Question | MVP default |
| --- | --- |
| Provider set | 10 adapters; enable by pasting key |
| Engine/locale/device | Google / `id` / desktop |
| Competitors | Allow `others` domains on keywords |
| Blob store | `serp_json` fallback, R2-ready key column |

---

## Progress log

| Date/Time (WIB) | Status | Change |
| --- | --- | --- |
| 2026-07-14 | Done | Performance checklist complete; rank MVP code complete. User still needs migration + Edge deploy + SERP keys. |
| 2026-07-13 | Implemented | Shared tooltip host, DomainItem/list lag fixes, rank schema/functions/UI. |
| 2026-07-10 | Plan | Initial audit + rank architecture |
| 2026-07-10 | Docs first | Expanded checklist; split detailed SERP plan to `SERP_RANK_TRACKING.md`; linked OPTIMIZATION tracker |
