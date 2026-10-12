# Changelog

All notable changes to the Domain Codev project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.2] - 2026-10-12

### Added
- **Quick TLD Filter Toggle Pills Next to Keyword Search Bar**:
  - Added interactive extension toggle pills (`All`, `.id`, `.co.id`, `.com`) directly next to `<KeywordDomainFilter />` in `DomainList.tsx`.
  - Displays dynamic live count badges of matching domains per extension.
  - Clicking an active pill toggles back to `All`, maintaining seamless bidirectional synchronization with the existing `tldFilter` state and `localStorage`.
- **Periodic Quota-Safe Re-Verification for Available Domains**:
  - De-terminalized `available` and `dropped` domain status in `supabase/functions/check-domains/scheduler.ts` (restricting `isAutoCheckTerminal` strictly to `reserved`).
  - Implemented tag-differentiated low-frequency verification cadences to prevent quota exhaustion:
    - `tag === 'to-snatch'`: Re-verified every 7 days (priority 20) to detect third-party snatching.
    - `tag === 'others'`: Re-verified every 21 days (priority 10) to conserve API credits.
    - `tag === 'mine'`: Anomaly verification every 3 days (priority 25) to check whether user registration completed.
  - Priority 10–25 ensures available domain re-checks never starve high-urgency drop watches (priority 80–125) or renewal warnings.
  - Added telemetry logging in `supabase/functions/check-domains/index.ts` to log third-party registration when an available domain flips to registered.
  - Surfaced an "Availability Freshness" indicator in `TooltipContent.tsx` showing the date availability was last verified and confirming active background protection.
- **Tag Switcher Downward Dropdown, Stacking Elevation & Collision Fix**:
  - Removed `overflow-hidden` from the domain row root container in `DomainItem.tsx` and added `hover:z-20 focus-within:z-20 relative` so active rows smoothly elevate above sibling rows.
  - Repositioned the tag popover to open downwards (`top-full mt-1.5 right-0 z-30`), preventing it from rendering into or behind the upper row.
  - Rendered explicit, clean option chips with icon and text labels (`Switch: [Mine] [Others]`) in the popover and removed the conflicting trigger `<Tooltip>` from the main tag button.

## [1.2.1] - 2026-10-12

### Added
- **Dedicated Overhead Floating Tag Switcher Popover**:
  - Relocated alternate tag switching controls out of the horizontal row flow into an overhead floating popover (`bottom-full mb-1.5 left-1/2 -translate-x-1/2`) in `DomainItem.tsx`.
  - Hidden by default and revealed strictly on hover/focus (`group-hover/tag:opacity-100`), eliminating collision and click interception over the adjacent row-level re-check button across all device viewports.
- **Fluid Responsive Widescreen Layout**:
  - Replaced narrow fixed-breakpoint `container mx-auto` in `App.tsx` and `Header.tsx` with a fluid responsive widescreen layout (`w-full max-w-[1600px] mx-auto px-3 sm:px-6 md:px-8`).
  - Removed the unused 160px dead spacer column in `DomainItem.tsx` and rebalanced row grid to `md:grid-cols-[minmax(240px,2fr)_minmax(120px,auto)_minmax(180px,1.2fr)_auto]`, giving domain names, category badges, and expiration controls ample breathing room without vertical stacking.
- **Multi-Source WHOIS / RDAP Pipeline Hardening**:
  - **Bounded Fetch Timeouts**: Enforced 6-second bounded timeouts (`AbortSignal.timeout(6000)`) on all 14 upstream provider requests in `supabase/functions/_shared/whois-adapters.ts` and 8-second timeout on IANA bootstrap fetch in `whois-normalize.ts`, eliminating runaway worker stalls under Edge Function execution limits.
  - **Smart Zero-Cost gTLD RDAP Prioritization**: In `whois-logic.ts`, dynamically elevated zero-cost `rdap-iana` to priority 1.5 ahead of commercial APIs for ICANN gTLDs (.com, .net, .org, .xyz, .io, .app, .dev, etc.), protecting commercial API quota for ccTLDs.
  - **Registry EPP Lifecycle Inference**: Added `detectEppLifecyclePhase` and `inferLifecycleStage` in `whois-status.ts` to inspect EPP codes (`pendingDelete`, `redemptionPeriod`, `clientHold`, `autoRenewPeriod`), accurately distinguishing active registered vs. grace period vs. redemption vs. imminent pending delete.
  - **Runtime Circuit Breaker**: Enhanced `markProviderFailure` in `whois-runtime.ts` with a 5-minute cool-down for auth/quota errors (401/403/429) and a 3-minute breaker for network/timeouts, preventing offline providers from adding hundreds of seconds of latency to batch operations.
  - **Pending-Delete Drop Prioritization**: Updated `scheduler.ts` to assign urgency priority 125 and active drop-watch cadence to target domains with `pendingDelete` status.
  - **Detailed Lifecycle Badges**: Updated `StatusBadge.tsx` and `DomainItem.tsx` with distinct status labels for `pending delete` (rose badge) and `redemption` (amber badge).
- **Authoritative WHOIS Audit Documentation**: Added comprehensive audit report in `%OneDrive%\MD\REPORT\REPORT-DOMAIN-CODEV-WHOIS-RETRIEVAL-AUDIT-2026-10-12.md` and repository copy `docs/WHOIS_RETRIEVAL_AUDIT.md`.

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
