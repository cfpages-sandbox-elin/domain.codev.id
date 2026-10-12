# Changelog

All notable changes to the Domain Codev project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2026-10-12

### Added
- **Direct Expired Filter Refresh Action**: Added a split-pill refresh trigger directly on the "Expired" filter button (`DomainFilterButton.tsx`) to allow one-click status re-checking without opening the dropdown menu.
- **Active Drop Watch Banner**: Surfaced an informative drop-watch header banner with a direct `"Re-check Expired"` button whenever the Expired filter is active.
- **Custom Tooltip Interactive Hover Bridge**:
  - Replaced native `title="..."` attributes across all domain rows, site links, tags, and schedule triggers with unified `<Tooltip size="sm">` components.
  - Enabled pointer interactions on tooltips with a 120ms hide grace period, allowing users to hover over and copy details directly from the tooltip body.
  - Added warm tooltip transitions (0ms delay between consecutive tooltips within 350ms, 50ms default delay) for instant responsiveness.
  - Added horizontal multi-column layout for `DomainTooltipContent` (`size="lg"` up to 480px width) with maximum height clamping (380px) and vertical scroll fallback to prevent off-screen bottom truncation.
- **Durable PRD-First Policy**: Added durable operational rule across repo-local and global `AGENTS.md` requiring PRD updates with unicode progress trackers before writing code.

## [1.1.0] - 2026-10-12

### Added
- **Navbar Version Badge**: Displayed `v1.1.0` next to the logo in the application header (`Header.tsx`) for instant visibility of the deployed version.
- **Holistic Domain Lifecycle & Drop-Watch Architecture**:
  - Direct WHOIS and drop status manual refresh buttons across `DomainItem` cards, `DomainList` bulk actions (`Re-check expired`), and `WhoisSchedulePage` rows.
  - Derived **"Expired, confirmed not dropped yet"** lifecycle status (`Expired (not dropped)` badge) when a domain has passed expiration and WHOIS confirms it remains held in registry grace/redemption.
  - Continuous **daily drop-watch** monitoring (24h cadence, priority 80) in frontend `whoisSchedule.ts` and Supabase Edge Function `check-domains/scheduler.ts`.
  - Automatic status transition from `expired` to `available` with `to-snatch` tagging, celebration logs, and drop notifications when the registry releases the domain.
- **Progressive Skeleton Loading & Wait Indicator**:
  - Added 3 animated shimmer skeleton placeholder cards and an explicit wait status (`<Spinner />` + `"Loading more domains..."`) when scrolling near the end of the rendered batch.
  - Added `CHANGELOG.md` to track project releases and changes.

### Changed
- **Renamed PRD**: Renamed `prd.md` to `PRD.md` at the repository root.
- **Micro-Batch Progressive Rendering**:
  - Reduced `INITIAL_RENDERED_DOMAINS` from 80 to 40 for instantaneous initial page paint.
  - Reduced `RENDER_INCREMENT` from 60 to 30 for silky 60fps micro-batches (<10ms per batch).
  - Expanded `IntersectionObserver` `rootMargin` from 800px to 1400px (2–3 screens) for aggressive background prefetching.
- **Zero-Allocation Memoization**: Refactored `DomainItem` memo comparator with `areCategoryLabelsEqual` to prevent array and string allocation churn.

### Fixed
- **Scroll Blank-Box Flash**: Removed `content-visibility: auto` and `contain-intrinsic-size` from `.domain-row-item` in `src/index.css`, replacing it with `transform: translateZ(0)` to eliminate multi-second empty row delays during scrolling.
- **Scroll Jitter & Layout Thrashing**: Eliminated cumulative layout shifts (CLS) by replacing top-unmounting sliding window spacer math with progressive IntersectionObserver sentinel rendering, decoupled `FloatingFilterBar`, and added a 150ms debounce with instant scroll dismissal to Tooltips.

## [1.0.0] - 2026-06-01

### Added
- Initial production release of Domain Codev: Supabase auth, domain tracking, bulk add, WHOIS providers, Auto Mine rules, categorization, and rank tracking.
