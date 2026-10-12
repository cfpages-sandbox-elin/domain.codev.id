# Product Requirements Document: Domain Codev

**Author:** World-Class Senior Frontend React Engineer
**Version:** 2.0
**Date:** 2024-05-30

---

## 1. Introduction

Domain Codev is a web application designed for individuals and businesses to monitor domain name availability, track expiration dates, and strategically acquire expiring domains. The application provides a clean, intuitive, and personalized interface with powerful automation features to help users manage their domain portfolios effectively, preventing accidental loss of valuable domains and identifying opportunities to purchase dropped domains.

## 2. User Personas

*   **Alex, the Domain Investor:** Alex buys and sells domain names for profit. They need a tool to track hundreds of domains they are interested in, get precise alerts when domains are about to drop, and quickly check the availability of new ideas. They need their list to be private, accessible from any device, and support bulk import/export.
*   **Maria, the Small Business Owner:** Maria owns several domains for her businesses. She is busy and needs a reliable system to remind her to renew her domains well in advance. She doesn't want to lose her branded domains due to a missed email from her registrar.

## 3. Functional Requirements

### 3.1. User Authentication
*   **3.1.1:** Users must be able to sign up and log in to the application using their Google account (OAuth).
*   **3.1.2:** All domain data must be associated with the logged-in user's account.
*   **3.1.3:** Users must be able to log out of the application.
*   **3.1.4:** Unauthenticated users should be presented with a login page and cannot access the application's core features.

### 3.2. Domain Status Checking
*   **3.2.1:** Authenticated users must be able to enter a domain name into an input field and check its registration status (available or registered) in real-time.
*   **3.2.2:** Real-time checks are performed by invoking a secure Supabase Edge Function, which acts as a proxy to query multiple WHOIS providers. This approach resolves browser CORS limitations and enhances security by keeping API keys on the server.
*   **3.2.3:** For registered domains, the system shall fetch and display key WHOIS data, including registrar, registration date, and expiration date.
*   **3.2.4:** For available domains, the application shall present a "Buy" button and a dropdown of recommended registrars to facilitate immediate acquisition.
    *   **3.2.4.1. Layout:** The availability status text, registrar dropdown, and "Buy Now" button must be rendered inline with the domain name on a single line in the domain list view to provide a compact and efficient user interface. These elements should be visually grouped and appear after the domain's tags.
*   **3.2.5:** The registrar list will be context-aware, suggesting relevant registrars based on the domain's TLD (e.g., specific options for `.id` domains vs. gTLDs).

### 3.3. Domain Tracking
*   **3.3.1:** Users must be able to add domains to a persistent tracking list associated with their account.
*   **3.3.2:** The tracked list shall display the domain name, its status, expiration date, and user-assigned tag.
*   **3.3.3:** Users must be able to remove domains from their tracking list.
*   **3.3.4:** Users must be able to switch the tag of a tracked domain (e.g., from "To Snatch" to "Mine" and vice-versa).
*   **3.3.5:** The UI shall provide filters to view all domains, or subsets based on tag ("Mine", "To Snatch"), status ("Expired", "Available"), or urgency ("Expiring Soon").
*   **3.3.6. Sorting:** The application shall provide sorting controls for the tracked domain list.
    *   **3.3.6.1. UI:** A dropdown menu will be placed next to the filter buttons to allow users to select a sorting method.
    *   **3.3.6.2. Options:** The following sorting options must be available:
        *   Domain Name (A-Z, Z-A)
        *   Expiration Date (Soonest First, Latest First)
        *   Date Added (Newest First, Oldest First)
        *   Last Checked (Newest First, Oldest First)
    *   **3.3.6.3. Default Sort:** The default sort order will be "Date Added (Newest First)".
    *   **3.3.6.4. State Persistence:** The selected sort option should be maintained as the user interacts with filters but can reset on page reload.

### 3.4. Tagging System
*   **3.4.1:** Users must be able to categorize tracked domains with one of two tags:
    *   **"Mine":** For domains the user owns and needs renewal reminders for.
    *   **"To Snatch":** For domains the user wants to acquire after they expire and drop.
*   **3.4.2:** Users can quickly add domains using keyboard shortcuts: `Enter` for "Mine" and `Shift+Enter` for "To Snatch".
*   **3.4.3:** The UI should visually distinguish between domains with different tags.

### 3.5. Expiration Notifications & Alerts
*   **3.5.1:** For domains tagged "Mine", the system must generate a notification when the domain is within a user-defined period of its expiration date (default: 7 days).
*   **3.5.2:** The UI will use a multi-level, color-coded highlighting system to indicate urgency for expiring domains:
    *   **90 days or less:** Low alert (e.g., yellow).
    *   **30 days or less:** Medium alert (e.g., orange).
    *   **7 days or less:** High alert (e.g., red).
    *   **Expired:** Critical alert (e.g., strong red).
*   **3.5.3:** Notifications shall be clearly visible within the application's UI.

### 3.6. Drop Snatching Assistance
*   **3.6.1:** For domains tagged "To Snatch" that have expired, the system will provide an informative modal with an estimated lifecycle timeline based on the domain's expiration date.
*   **3.6.2:** This timeline will estimate the end of the Grace Period, Redemption Period, and the potential date the domain will drop and become available for registration.

### 3.7. Automated Daily Checks (Server-Side)
*   **3.7.1:** The application backend will perform a daily background check on all tracked domains that require a status update (e.g., those that have recently expired).
*   **3.7.2:** This check is implemented as a Supabase Edge Function (`check-domains`), triggered by a cron job. The trigger can be configured via Supabase's built-in scheduler or an external service (e.g., fastcron.com).
*   **3.7.3:** The primary purpose of the check is to update the status of expired domains to see if they have been renewed or if they have "dropped" and become available.

### 3.8. UI/UX
*   **3.8.1:** The application must feature a theme toggle for Light and Dark modes.
*   **3.8.2:** The interface must be clean, modern, and aesthetically pleasing, built with Tailwind CSS.
*   **3.8.3:** The application must be fully responsive and usable on various screen sizes.
*   **3.8.4. Compact Mode:** The application shall include a toggle for a "Compact View". This mode will reduce padding and font sizes in the domain list to allow more items to be visible on the screen, catering to users with large domain portfolios.

### 3.9. System Behavior
*   **3.9.1. Configuration Error Handling:** The application must not crash if critical environment variables (e.g., Supabase URL, Supabase Anon Key) are missing. Instead, it must display a clear, user-friendly error screen that informs the developer what is wrong and how to fix it by referencing the `README.md`.

### 3.10. In-App Guidance & Documentation
To enhance user-friendliness and reduce the learning curve, the application will provide contextual help and a centralized documentation center.

*   **3.10.1. Microcopy & Contextual Help:**
    *   **3.10.1.1. Domain Form:** Add descriptive text below the "Check Domain" heading to clarify the form's purpose.
    *   **3.10.1.2. Tracked Domains:** Add an informational block within the "Tracked Domains" card explaining that domains are checked automatically once daily and prompting the user to set up the automation if they haven't. This text should link to the new Documentation section.
    *   **3.10.1.3. Empty State:** The message shown when the tracking list is empty will be encouraging and directive.
    *   **3.10.1.4. Drop Snatching Modal:** The modal will more clearly state that the provided dates are estimates and can vary.

*   **3.10.2. Documentation Center:**
    *   **3.10.2.1. New View:** The application will include a new "Documentation" view, accessible via a link in the main header.
    *   **3.10.2.2. Content:** This view will render the content from the project's key markdown files (`README.md`, `deployment.md`, and all files from the `/docs` directory).
    *   **3.10.2.3. Navigation:** The Documentation Center will feature a sidebar menu allowing users to easily switch between different documents.
    *   **3.10.2.4. Markdown Rendering:** Markdown content will be parsed and rendered into clean, readable HTML.

### 3.11. Bulk Domain Management
*   **3.11.1. Bulk Add via Text Area:** Users must be able to add multiple domains at once by pasting a list (newline, comma, or space-separated) into a textarea.
*   **3.11.2. Data Import (JSON, CSV):** Users must be able to import a list of domains from a local file in either JSON or CSV format.
    *   **3.11.2.1. JSON Format:** The importer must accept a JSON array of objects that match the application's domain structure.
    *   **3.11.2.2. CSV Format:** The importer must accept a CSV file with a `domain_name` header. An optional `tag` column will be used if present.
*   **3.11.3. Data Export (JSON, CSV):** Users must be able to export their entire list of tracked domains to a local file in either JSON or CSV format.
*   **3.11.4. Concurrent Processing:** When domains are added in bulk, the application must check their WHOIS status concurrently to ensure fast processing. This process must be rate-limited (e.g., using batches with delays) to avoid overwhelming WHOIS API providers.

## 4. Non-Functional Requirements

*   **4.1. Performance:** The UI must be fast and responsive, with loading states to indicate background operations. Bulk operations must not lock the UI.
*   **4.2. Usability:** The application flow should be intuitive, requiring minimal instruction for a new user.
*   **4.3. Security:** User data must be isolated and protected. All WHOIS API keys are stored securely as Supabase secrets and are not exposed to the client. The `check-domains` Edge Function must be protected by a secret key. Real-time checks are proxied through an authenticated Edge Function.
*   **4.4. Data Persistence:** All user data must be stored securely in a remote database (Supabase).
*   **4.5. Global Error Boundary:** The application must not crash to a blank screen in case of a UI rendering error. A global error boundary shall catch such errors and display a user-friendly fallback screen with an option to recover (e.g., refresh the page).

## 5. Technical Stack

*   **Frontend:** React 18+, TypeScript
*   **Styling:** Tailwind CSS
*   **Content Parsing:** `marked` for rendering documentation
*   **Authentication:** Supabase Auth (with Google OAuth)
*   **Database:** Supabase (PostgreSQL with RLS)
*   **Backend Logic:** Supabase Edge Functions
    *   `get-whois`: Real-time, on-demand WHOIS lookups (invoked from client).
    *   `check-domains`: Daily automated checks for all tracked domains (triggered by cron job).
*   **WHOIS Data (used by Edge Functions):**
    *   Primary (Optional, Self-hosted): `who-dat`
    *   Backup 1: WhoisXMLAPI
    *   Backup 2: apilayer.com API
    *   Backup 3: whoisfreaks.com API
*   **Automation (Production):** Supabase's built-in scheduler or an external cron service (e.g., fastcron.com, cron-job.org) triggering the secure `check-domains` Supabase Edge Function.

## 6. Out of Scope (Future Enhancements)

*   Browser push notifications.
*   Direct domain registration/backordering integration with registrars.
*   Payment processing for premium features.
*   Support for other OAuth providers (e.g., GitHub, Twitter).

## 7. Status

It is live now and deployed at https://domain.codev.id

## 8. To-Do List (Generated)

- [ ] **3.1. User Authentication**
    - [x] 3.1.1: Users must be able to sign up and log in to the application using their Google account (OAuth).
    - [x] 3.1.2: All domain data must be associated with the logged-in user's account.
    - [x] 3.1.3: Users must be able to log out of the application.
    - [x] 3.1.4: Unauthenticated users should be presented with a login page.

- [ ] **3.2. Domain Status Checking**
    - [x] 3.2.1: Implement real-time domain status checking.
    - [x] 3.2.2: Proxy WHOIS checks through a Supabase Edge Function for security and CORS compliance.
    - [x] 3.2.3: Display key WHOIS data for registered domains.
    - [x] 3.2.4: For available domains, present a "Buy" button and registrar dropdown.
    - [x] 3.2.5: Make registrar list context-aware based on TLD.

- [ ] **3.3. Domain Tracking**
    - [x] 3.3.1: Users must be able to add domains to a persistent tracking list.
    - [x] 3.3.2: The tracked list shall display key domain information.
    - [x] 3.3.3: Users must be able to remove domains from their tracking list.
    - [x] 3.3.4: Users must be able to switch the tag of a tracked domain.
    - [x] 3.3.5: Implement UI filters for the domain list, including an "Available" filter.
    - [x] 3.3.6: Implement sorting controls for the domain list.

- [ ] **3.4. Tagging System**
    - [x] 3.4.1: Users must be able to categorize tracked domains with one of two tags: "Mine" and "To Snatch".
    - [x] 3.4.2: Implement keyboard shortcuts (`Enter` and `Shift+Enter`) for adding domains.
    - [x] 3.4.3: The UI should visually distinguish between domains with different tags.

- [ ] **3.5. Expiration Notifications & Alerts**
    - [x] 3.5.1: Generate in-app notifications for expiring domains.
    - [x] 3.5.2: Implement multi-level, color-coded highlighting for expiring domains.
    - [x] 3.5.3: Notifications shall be clearly visible within the application's UI.

- [ ] **3.6. Drop Snatching Assistance**
    - [x] 3.6.1: Provide an informative modal with an estimated lifecycle timeline for expired domains.
    - [x] 3.6.2: This timeline will estimate key dates in the drop-catching process.

- [ ] **3.7. Automated Daily Checks (Server-Side)**
    - [x] 3.7.1: The application backend will perform a daily background check on all tracked domains that require a status update.
    - [x] 3.7.2: This check is implemented as a Supabase Edge Function (`check-domains`), triggered by a daily cron job.
    - [x] 3.7.3: The check's purpose is to update the status of expired domains.

- [ ] **3.8. UI/UX**
    - [x] 3.8.1: Implement a theme toggle for Light and Dark modes.
    - [x] 3.8.2: Build a clean, modern, and aesthetically pleasing interface with Tailwind CSS.
    - [x] 3.8.3: Ensure the application is fully responsive.
    - [x] 3.8.4: Implement a Compact View toggle and functionality.

- [ ] **3.9. System Behavior**
    - [x] 3.9.1. Configuration Error Handling: The application must not crash if critical environment variables are missing.
    - [x] 4.5. Global Error Boundary: The application must not crash to a blank screen in case of a UI rendering error.

- [ ] **3.10. In-App Guidance & Documentation**
    - [x] 3.10.1.1: Domain Form: Add descriptive text.
    - [x] 3.10.1.2. Tracked Domains: Add informational block explaining auto-checks.
    - [x] 3.10.1.3. Empty State: Implement an encouraging message.
    - [x] 3.10.1.4. Drop Snatching Modal: Clarify that dates are estimates.
    - [x] 3.10.2.1. New View: Implement the "Documentation" view.
    - [x] 3.10.2.2. Content: Load markdown files into the application.
    - [x] 3.10.2.3. Navigation: Implement a sidebar for doc navigation.
    - [x] 3.10.2.4. Markdown Rendering: Use `marked` to render content as HTML.

- [ ] **3.11. Bulk Domain Management**
    - [x] 3.11.1: Implement bulk add via textarea.
    - [x] 3.11.2: Implement data import from JSON and CSV files.
    - [x] 3.11.3: Implement data export to JSON and CSV files.
    - [x] 3.11.4: Implement concurrent, rate-limited processing for bulk additions.

- [ ] **4. Non-Functional Requirements**
    - [x] 4.1. Performance: The UI must be fast and responsive.
    - [x] 4.2. Usability: The application flow should be intuitive.
    - [x] 4.3. Security: User data must be protected, and API keys must be kept server-side.
    - [x] 4.4. Data Persistence: All user data must be stored securely in Supabase.

- [x] **5. Technical Stack** (Defined and implemented)

- [x] **6. Out of Scope (Future Enhancements)** (Defined)

- [x] **7. Status** (Defined)

## 9. Production Hardening: Scroll Performance & Layout Stability Audit

**Objective**: Eliminate scroll jitter, heavy frame drops, layout thrashing, and "domains keep moving around" behavior during scrolling on desktop and mobile.

### Progress Legend
- ⏳ Pending
- 🔄 In Progress
- ✅ Completed

### Findings & Implementation Tasks

- [x] **9.1. Fix Grouped Category Virtualization Slicing Defect ("Domains Keep Moving Around")**
  - **Status**: ✅ Completed
  - **Root Cause**: In category view (`categoryFilter === 'all'`), the component grouped domains by category clusters (`orderedGroups`), but windowing sliced `sortedDomains` by arbitrary flat index `[windowStart, windowEnd]`. Slicing a flat sorted list and filtering non-linear category groups caused domains inside categories to pop in and vanish as the user scrolled. Entire category cards collapsed and reappeared dynamically, while `topSpacerHeight` was prepended above all categories, causing severe visual jumping, card collapse/expansion, and the perceived "domains keep moving around".
  - **Hardening Fix**: Replace broken flat slicing across categorized groups with stable, progressive block rendering. Category cards and their internal domain lists maintain stable rendered sequence and do not pop in/out or move between categories during scroll.

- [x] **9.2. Eliminate Sliding Window Top-Unmounting Jitter & Layout Jumps (CLS)**
  - **Status**: ✅ Completed
  - **Root Cause**: In flat list mode, `updateWindow` unmounted top rows and inserted `topSpacerHeight = windowStart * ESTIMATED_ROW_HEIGHT` (hardcoded 72px). But actual row heights vary significantly (compact mode: 56px; standard mode: 80-96px; rows with warnings or tags: 96px+; mobile stacked grid: 150-180px). When items unmounted, the spacer height differed from actual item heights by hundreds of pixels, causing sudden scroll position jumps. These jumps altered `anchorTop.getBoundingClientRect().top`, triggering immediate feedback loop re-renders on subsequent frames (jitter).
  - **Hardening Fix**: Replace top-unmounting with progressive sentinel appending (`IntersectionObserver` sentinel) combined with modern native CSS `content-visibility: auto` and `contain-intrinsic-size: 72px` (and responsive mobile rules). Offscreen rows are natively culled by the browser's compositor without unmounting top DOM nodes, ensuring 100% stable scroll anchoring without spacer calculation jumps.

- [x] **9.3. Eliminate Tooltip Layout Thrashing & State Storm on Scroll**
  - **Status**: ✅ Completed
  - **Root Cause**: `Tooltip.tsx` mounted tooltips synchronously on `onMouseEnter` with 0ms delay. As the user scrolled or quickly swept their mouse down the list, every domain name touched called `getBoundingClientRect()`, re-rendered `TooltipHost`, forced layout reflow to measure height, and re-rendered again. Furthermore, `TooltipHost` registered a capturing window scroll listener that repeatedly called `computePosition` during scroll.
  - **Hardening Fix**:
    - Add a 150ms hover delay to `Tooltip.tsx` so rapid pointer sweeps across domain rows during scroll do not trigger layout measurements or tooltip renders.
    - Immediately dismiss active tooltips on scroll and suppress new tooltip triggers while scrolling is active.

- [x] **9.4. Decouple Floating Filter Bar Re-Renders from DomainList**
  - **Status**: ✅ Completed
  - **Root Cause**: `updateFloatingFilterVisibility` called `setIsFloatingFilterVisible(nextIsVisible)` inside `DomainList`, forcing the entire list (and all category memoizations) to re-render when scrolling past 220px.
  - **Hardening Fix**: Decouple the floating filter bar into its own isolated component (`FloatingFilterBar`) so toggling its visibility does not re-render the parent `DomainList`.

- [x] **9.5. CSS & Layout Performance Hardening**
  - **Status**: ✅ Completed
  - **Root Cause**: Hundreds of domain rows were actively calculated in the layout tree. Sticky header `backdrop-blur-lg` over a scrolling list of hundreds of elements incurred expensive compositor and GPU shader redraws on every scroll frame.
  - **Hardening Fix**:
    - Add `.domain-row-item` utility with `content-visibility: auto` and responsive `contain-intrinsic-size` (72px desktop / 140px mobile).
    - Ensure smooth GPU acceleration on row elements and eliminate unnecessary repaint triggers during scroll.

## 10. Holistic Domain Lifecycle & Drop-Watch Architecture

**Objective**: Model the entire end-to-end domain lifecycle from active registration to drop release, distinguish confirmed non-dropped expired states from unconfirmed or available states, ensure continuous daily monitoring during the expected drop window, and provide direct manual refresh triggers across all views for expired domains.

### Progress Legend
- ⏳ Pending
- 🔄 In Progress
- ✅ Completed

### Holistic Domain Lifecycle Stages

```
[ Active / Registered ]
        │ (expiryDate - 30..90 days)
        ▼
[ Expiring Soon ] (Weekly / 3-day checks)
        │ (now >= expiryDate)
        ▼
[ Expired (Unconfirmed) ] (Needs WHOIS confirmation)
        │
        ├─────────────────────────────────────────────────┐
        │ WHOIS: still registered / held                  │ WHOIS: available / not found
        ▼                                                 ▼
[ Expired, Confirmed Not Dropped Yet ]              [ Available / Dropped ]
(Grace Period -> Redemption -> Pending Delete)      (Tag: to-snatch, immediate buy controls)
        │
        │ Continuous Daily Checks (Expected Drop Window)
        ▼
[ Potential Drop Date Reached ]
        │
        ├──────────────────────┐
        │ Dropped              │ Renewed / Retained by Owner
        ▼                      ▼
[ Available / Dropped ]     [ Registered ]
```

### Findings & Implementation Tasks

- [x] **10.1. Add Direct Re-Check & Refresh Controls for Expired Domains**
  - **Status**: ✅ Completed
  - **Requirement**: Expired domains must have direct, visible refresh capabilities. In `DomainList.tsx`, add a dedicated "Re-check expired" action to the bulk re-check dropdown menu (`Re-check expired (N domain(s))`). In `WhoisSchedulePage.tsx`, add inline manual re-check buttons per domain card so users can refresh due and expired domains directly from the schedule view without switching pages. Ensure each expired row in `DomainItem.tsx` clearly presents its manual refresh trigger with dedicated tooltips.

- [x] **10.2. Implement "Expired, Confirmed Not Dropped Yet" Lifecycle State**
  - **Status**: ✅ Completed
  - **Requirement**: Introduce explicit differentiation between an unconfirmed expired domain and an expired domain that has been confirmed by WHOIS to still be held by the registry/registrar.
    - When `domain.expiration_date < now` AND `domain.last_checked >= domain.expiration_date` AND WHOIS indicates the domain is still registered/held (e.g. grace period, redemption, or pending delete): surface the status clearly as **"Expired, confirmed not dropped yet"** (badge: `Expired (Not Dropped)`).
    - StatusBadge and tooltips must inform the user of the exact phase (Grace Period, Redemption, Pending Delete), the date confirmed, and the estimated release window.

- [x] **10.3. Continuous Daily Monitoring During Expected Drop Date Window**
  - **Status**: ✅ Completed
  - **Requirement**: Expired domains must not languish in weekly checks. Update `whoisSchedule.ts` and `supabase/functions/check-domains/scheduler.ts` so that expired domains entering their expected drop lifecycle (post-expiry up to estimated drop date and active window) are scheduled for **continuous daily checks** (`intervalHours: 24`, cadence: `Daily (drop watch)`). During the high-probability active drop window (around `expiry + estimated_drop_days`), maintain high-frequency active watch.

- [x] **10.4. Automatic State Transition from Expired to Available / Dropped**
  - **Status**: ✅ Completed
  - **Requirement**: When WHOIS check (manual or scheduled) returns `available` for a previously expired domain:
    - Automatically transition domain status from `expired` to `available` (or `dropped`).
    - Automatically ensure domain tag is set to `to-snatch`.
    - Trigger immediate drop alert notification and surface registrar purchase controls with direct buy links.
    - Ensure client-side `useDomainActions.ts` and server-side Edge function maintain identical status transition logic.

## 11. Scroll Rendering Optimization & Progressive Loading Feedback

**Objective**: Eliminate blank-box flashing and multi-second content delay during scrolling, tune progressive rendering increments to achieve smooth 60fps micro-batching with aggressive prefetching, provide realistic skeleton loading placeholders with informative wait feedback when approaching unrendered batches, and optimize component memoization to minimize allocation churn.

### Progress Legend
- ⏳ Pending
- 🔄 In Progress
- ✅ Completed

### Root Cause Audit
1. **Empty Row Flash via `content-visibility: auto`**: In `src/index.css`, applying `content-visibility: auto` with `contain-intrinsic-size: 72px` causes Chromium to defer painting off-screen element descendants. When the user scrolls fast, Chromium enters unrendered areas and displays empty boxes for 1–3 seconds until layout and painting threads catch up, giving the impression of delayed data fetching.
2. **Coarse Batch Mounting**: `INITIAL_RENDERED_DOMAINS = 80` and `RENDER_INCREMENT = 60` synchronously mounted 60 complex cards per trigger, inducing small main-thread spikes.
3. **Late Sentinel Preload**: A `rootMargin` of `800px` gave insufficient lead time during fast trackpad/mousewheel scrolling, allowing the viewport to overtake the sentinel into unrendered empty space.
4. **Missing Visual Feedback**: When the user reached the end of the rendered batch, there were no placeholder skeletons or informative status indicators, only a tiny text line and button.
5. **Memo Comparison Allocation Churn**: In `DomainItem.tsx`, the memo comparator executed `.map()` across `categoryLabels` creating fresh string arrays on every comparison, regardless of reference equality.

### Implementation Tasks

- [x] **11.1. Eliminate Blank-Box Flash by Removing `content-visibility: auto`**
  - **Status**: ✅ Completed
  - **Requirement**: Remove `content-visibility: auto` and `contain-intrinsic-size` from `.domain-row-item` in `src/index.css`. Because DOM node count is already bounded by progressive rendering, this eliminates the multi-second blank card delay during scrolling while preserving fluid rendering.

- [x] **11.2. Micro-Batching & Aggressive Prefetch Margin**
  - **Status**: ✅ Completed
  - **Requirement**: In `src/components/domain-list/domainListLogic.ts`, update `INITIAL_RENDERED_DOMAINS` to `40` (halves initial mount time) and `RENDER_INCREMENT` to `30` (mounts in <10ms without dropping frames). In `src/components/DomainList.tsx`, expand IntersectionObserver `rootMargin` to `'1400px 0px'` so the next 30 items mount 2–3 screens before the user reaches the bottom.

- [x] **11.3. Progressive Skeleton Loading Placeholders with Wait Message**
  - **Status**: ✅ Completed
  - **Requirement**: In `src/components/DomainList.tsx`, when `hasMoreDomains` is true, render 3 realistic skeleton domain cards with `animate-pulse` shimmer matching exact card dimensions alongside an explicit status indicator (`<Spinner size="sm" />` + `"Loading more domains... (X of Y displayed)"`) and fallback load button.

- [x] **11.4. Zero-Allocation Memo Comparator in DomainItem**
  - **Status**: ✅ Completed
  - **Requirement**: In `src/components/DomainItem.tsx`, refactor `areCategoryLabelsEqual` to compare label items element-by-element without string interpolation or `.map()` array allocations, and only evaluate when references differ.

## 12. Tooltip Ergonomics, Horizontal Domain Card & Expired Filter Controls

**Objective**: Eliminate sluggish native browser tooltips (~1000ms delay) across all interactive elements, fix tooltip hover usability by providing an interactive bridge so users can move their cursor into the tooltip body without it disappearing, restructure domain data hover card horizontally so it never overflows off the bottom of the viewport, optimize tooltip hover latency with warm transitions, and add direct, visible refresh capabilities to the expired domain filter pill and active list view.

### Progress Legend
- ⏳ Pending
- 🔄 In Progress
- ✅ Completed

### Root Cause Audit
1. **Sluggish Native Tooltips**: Buttons and icons used the standard HTML `title="..."` attribute. Modern desktop browsers (Chromium, Firefox, Safari) enforce an unconfigurable delay of 800–1200ms before rendering OS-level native tooltips. They also cannot be styled, formatted, or hovered over.
2. **Tooltip Body Hover Dropoff**: In `Tooltip.tsx`, `TooltipHost` was marked with `pointer-events-none`, and `onMouseLeave` on the trigger element instantly cleared `activeTooltipState`. When users tried to move their cursor toward the tooltip body to read or select details, the trigger's `mouseLeave` fired and immediately destroyed the tooltip before the cursor could reach it.
3. **Vertical Domain Tooltip Overflow**: `DomainTooltipContent` in `TooltipContent.tsx` was organized as a single vertical column (`space-y-3`) with 11 `DetailRow` items, drop estimates, registry status explanations, and nameservers. On medium and standard displays, this vertical stack grew to >650px, causing the bottom half (registry status, nameservers, drop timeline) to overflow off the bottom edge of the browser viewport.
4. **Missing Direct Refresh on Expired Filter**: In `DomainList.tsx`, users had to navigate to the separate `Re-check` dropdown menu to trigger an expired check. The "Expired" filter pill had no direct refresh trigger, making drop-watch workflows unintuitive.

### Implementation Tasks

- [x] **12.1. Tooltip Interactive Hover Bridge, Warm Transitions & Viewport Boundary Clamping**
  - **Status**: ✅ Completed
  - **Requirement**:
    - Update `Tooltip.tsx` portal to `pointer-events-auto`.
    - Implement a 120ms hide grace period in `scheduleTooltipHide` so the cursor can traverse the gap between trigger and tooltip body.
    - Add `onMouseEnter={cancelTooltipHide}` and `onMouseLeave={() => scheduleTooltipHide(120)}` on the portal card.
    - Implement warm transition: if a tooltip was active within 350ms, open the next tooltip with 0ms delay; default to 50ms initial delay (down from 150ms).
    - Add `size?: 'sm' | 'md' | 'lg'` prop (target width up to 480px on `lg`).
    - Enforce `maxHeight: min(space, 380)` and `overflowY: 'auto'` to guarantee zero screen overflow.

- [x] **12.2. Horizontal Multi-Column Domain Tooltip Card Layout**
  - **Status**: ✅ Completed
  - **Requirement**:
    - Refactor `DomainTooltipContent` in `src/components/domain-item/TooltipContent.tsx` into a structured, horizontal 2-column card.
    - Header: Domain name (bold mono), status badge, tag pill, TLD badge.
    - Left Column: Expiration date, registration date, registrar, last checked timestamp, provider label, category pills.
    - Right Column: Drop lifecycle estimate (grace period end, redemption end, estimated drop date), registry statuses with humanized tags, and nameservers list.
    - Restructure `DomainItem.tsx` to pass `size="lg"` to the domain name tooltip.

- [x] **12.3. Direct Re-Check Button on Expired Filter Pill & Active Expired Watch Banner**
  - **Status**: ✅ Completed
  - **Requirement**:
    - Update `DomainFilterButton.tsx` to support optional `onRefresh` and `isRefreshing` props, rendering a split-pill refresh icon button when provided.
    - In `DomainList.tsx`, pass `onRefresh={() => runRecheck(expiredDomains, 'expired domain(s)')}` to the "Expired" filter button.
    - When `filter === 'expired'`, render a prominent drop-watch header banner with count, drop-watch summary, and a direct `"Re-check Expired (${expiredDomains.length})"` action.

- [x] **12.4. Audit & Replace Native `title` Attributes Across the Codebase**
  - **Status**: ✅ Completed
  - **Requirement**:
    - Audit all elements with native `title="..."` attributes.
    - Replace them in `src/components/DomainItem.tsx` (re-check button, remove button, site link, word-group add button, category remove button, tag selection buttons, status icons) with `<Tooltip size="sm">`.
    - Replace them in `src/components/WhoisSchedulePage.tsx` (manual schedule re-check button) with `<Tooltip size="sm">`.

## 13. Row-Level Action Collision Fix, Overhead Tag Popover & Fluid Widescreen Layout

**Objective**: Eliminate action element collisions on domain list rows where the tag-switching buttons physically covered and obscured the individual row re-check button, relocate tag-switching controls to a dedicated floating popover positioned above the current tag button that is hidden by default and only revealed upon hovering, and expand the tracked domains body to a responsive fluid widescreen layout (eliminating artificial container narrowness and dead grid spacer columns) so content renders smoothly without stacking.

### Progress Legend
- ⏳ Pending
- 🔄 In Progress
- ✅ Completed

### Root Cause Audit
1. **Horizontal Positioning Collision**: In `src/components/DomainItem.tsx`, the alternate tag panel was styled with `absolute right-8 top-0`. In the action button cluster, the re-check button sits immediately to the left of the tag button. Positioning the popup at `right-8` caused it to expand horizontally to the left by ~75px, rendering directly over the re-check button and intercepting cursor clicks.
2. **Unconditional Mobile Expansion**: On mobile viewport widths (`!isDesktopLayout`), the alternate tag buttons rendered permanently inline, crowding the action bar, pushing elements off-screen or covering the re-check button.
3. **Accidental Hover Triggering**: The `group/tag` container lacked vertical separation, so moving the cursor toward the re-check button triggered the tag container's hover state, suddenly expanding the tag switcher over the re-check button right before the click landed.
4. **Narrow Fixed-Breakpoint Container & Dead Grid Spacer**: In `src/App.tsx` and `src/components/Header.tsx`, `<main>` used Tailwind's fixed-width `container mx-auto px-4 md:p-8`, capping content width to 1024px–1280px with excessive 64px horizontal padding on each side. On modern displays, this forced the domain tracking list into a narrow box. Furthermore, in `src/components/DomainItem.tsx`, an unnecessary empty spacer column (`<div className="hidden min-h-[32px] md:block" />` stealing 160px / 0.9fr) squeezed domain names and category tags into a tight 180px column, forcing items to wrap and awkwardly stack vertically.

### Implementation Tasks

- [x] **13.1. Re-position Tag-Switcher to Dedicated Overhead Floating Popover**
  - **Status**: ✅ Completed
  - **Requirement**:
    - In `src/components/DomainItem.tsx`, relocate the alternate tag options (`alternateTags`) out of the horizontal row flow into a dedicated overhead floating popover card positioned at `bottom-full mb-1.5 left-1/2 -translate-x-1/2`.
    - Style the popover with a dedicated card container (`rounded-lg bg-white p-1 shadow-lg ring-1 border border-slate-200 dark:bg-slate-800 dark:border-slate-700 z-30`) so it floats cleanly above the row with zero horizontal overlap over the re-check button.
    - Add smooth transition (`opacity-0 scale-95 pointer-events-none group-hover/tag:opacity-100 group-hover/tag:scale-100 group-hover/tag:pointer-events-auto transition-all duration-150`).

- [x] **13.2. Unify Hover-Only Disclosure Across All Layouts**
  - **Status**: ✅ Completed
  - **Requirement**:
    - Remove the divergent mobile inline rendering that permanently displayed alternate tag buttons.
    - Ensure alternate tag options are hidden by default across all layouts, appearing strictly when the user hovers over or focuses within the current tag button.
    - Clicking the tag button directly toggles the tag, while hovering provides the dedicated popover to choose a specific tag (`Mine`, `To Snatch`, `Others`).

- [x] **13.3. Verify Row-Level Re-Check Button Accessibility & Clearance**
  - **Status**: ✅ Completed
  - **Requirement**:
    - Verify that every domain row has an unobstructed 32x32px re-check button with its dedicated `<Tooltip>` trigger ("Re-check WHOIS & drop status" for expired domains, "Re-check WHOIS" otherwise).
    - Ensure zero pointer-event interception from sibling controls, popovers, or floating filter bars.

- [x] **13.4. Fluid Widescreen Container & Eliminate Dead Grid Spacer**
  - **Status**: ✅ Completed
  - **Requirement**:
    - In `src/App.tsx` and `src/components/Header.tsx`, replace the narrow `container mx-auto` constraint with a fluid widescreen layout (`w-full max-w-[1600px] mx-auto px-3 sm:px-6 lg:px-8`) that dynamically follows the browser screen.
    - In `src/components/DomainItem.tsx`, remove the unused 160px dead spacer column (`<div className="hidden min-h-[32px] md:block" />`) and rebalance the row grid to `md:grid-cols-[minmax(240px,2fr)_minmax(120px,auto)_minmax(180px,1.2fr)_auto] md:items-center` so domain names, category pills, status badges, and expiration controls have ample room to render horizontally without wrapping or stacking.

## 14. WHOIS Data Retrieval Audit, Multi-Source Robustness & Lifecycle EPP Detection

**Objective**: Audit and harden the WHOIS and RDAP data retrieval pipeline across 14 upstream providers to support hundreds of domains without timing out, rate-limit thrashing, or quota exhaustion, while accurately classifying domain lifecycle phases (Active Registered -> Expired in Grace/Redemption -> Pending Delete -> Dropped/Available) based on authoritative registry EPP codes.

### Progress Legend
- ⏳ Pending
- 🔄 In Progress
- ✅ Completed

### Root Cause Audit
1. **Unbounded Network Calls in Edge Adapters**: `supabase/functions/_shared/whois-adapters.ts` executes `fetch()` without `AbortSignal.timeout()`. When an upstream provider hangs, edge workers block for 60+ seconds, risking early termination of batch cron runs (`check-domains`) under Supabase Edge Function's 150-second wall-clock limit.
2. **Inverted Cost Order**: Zero-cost, high-speed `rdap-iana` sits at Priority 9 below quota-limited paid APIs (WhoisXMLAPI 500 lifetime queries, WhoisFreaks 500 queries, IP2WHOIS 500 queries), needlessly burning paid credits on standard `.com`/`.org` domains.
3. **EPP Lifecycle Blindness**: `whois-normalize.ts` collects EPP status codes (`pendingDelete`, `redemptionPeriod`, `clientHold`) into `domainStatuses`, but `whois-status.ts`'s `inferDomainStatus` ignores them completely, lumping all expired domains into a flat `expired` status and failing to surface when an expired domain is confirmed not dropped yet versus imminent pending delete.
4. **Missing Circuit Breaker on Failing Providers**: When an upstream provider returns 401, 403, 429, or network errors, it is repeatedly re-attempted for every subsequent domain in the batch, causing exponential latency compounding across hundreds of domains.

### Implementation Tasks

- [x] **14.1. Enforce Bounded Network Timeouts on All Provider Adapters**
  - **Status**: ✅ Completed
  - **Requirement**:
    - Wrap all upstream fetch requests in `supabase/functions/_shared/whois-adapters.ts` with `AbortSignal.timeout(6000)` (6 seconds max per provider).
    - Ensure clean error handling so aborted requests seamlessly fall through to the next provider without stalling the worker thread.

- [x] **14.2. EPP Status Code & Drop Lifecycle Phase Detection**
  - **Status**: ✅ Completed
  - **Requirement**:
    - In `supabase/functions/_shared/whois-status.ts`, update `inferDomainStatus` and status types to detect EPP codes (`pendingDelete`, `redemptionPeriod`, `clientHold`, `autoRenewPeriod`).
    - Distinguish `pending-delete` (drop imminent within 5 days), `redemption` (confirmed not dropped yet, redemption period), `grace` (expired but in registrar grace period), and `dropped` / `available`.
    - Expose `lifecycleStage?: 'active' | 'grace' | 'redemption' | 'pending-delete' | 'dropped'` in `WhoisData`.

- [x] **14.3. Resilient Provider Circuit Breaker in Telemetry Runtime**
  - **Status**: ✅ Completed
  - **Requirement**:
    - In `supabase/functions/_shared/whois-runtime.ts`, enhance `markProviderFailure` with a circuit-breaker mechanism: trip a 5-minute cool-down (`blockedUntil = Date.now() + 300_000`) on HTTP 401, 403, 429, or consecutive network timeouts.
    - Prevent dead or exhausted providers from delaying multi-domain batch execution.

- [x] **14.4. Smart Zero-Cost gTLD RDAP Prioritization**
  - **Status**: ✅ Completed
  - **Requirement**:
    - In `supabase/functions/_shared/whois-logic.ts`, dynamically prioritize `rdap-iana` for gTLDs supported by IANA RDAP bootstrap, preserving commercial paid quota for ccTLDs and obscure extensions.

- [x] **14.5. Frontend Lifecycle Status Badges & Tooltip Synchronization**
  - **Status**: ✅ Completed
  - **Requirement**:
    - In `src/components/domain-item/StatusBadge.tsx` and `TooltipContent.tsx`, render granular lifecycle status labels (e.g., "Expired (Grace/Redemption)", "Pending Delete", "Dropped") so users see at a glance whether an expired domain is still held or imminent to drop.

## 15. Periodic Quota-Safe Re-Verification for Available Domains

**Objective**: Automatically re-verify domains marked as `available` or `dropped` on a quota-safe, tag-differentiated low-frequency schedule, ensuring that if a third party registers or purchases a tracked available domain, the status correctly updates to `registered` without exhausting WHOIS API query credits or starving high-urgency drop watches.

### Progress Legend
- ⏳ Pending
- 🔄 In Progress
- ✅ Completed

### Root Cause & Quota Analysis
1. **Premature Terminal State**: In `supabase/functions/check-domains/scheduler.ts`, `isAutoCheckTerminal` flagged `available` and `dropped` as terminal, permanently halting automatic checks for any domain once marked available. If a third party registers the domain, the dashboard indefinitely displays "Available" and "Buy Now" unless manually refreshed.
2. **Quota Starvation Risk**: Indiscriminately checking available domains daily across large watchlists would burn hundreds of queries per month, depleting free-tier and commercial credits.
3. **Intent-Tiered Solution**:
   - `tag === 'to-snatch'`: High purchase intent. Schedule check every **7 days** (168h). Queue Priority: **20**.
   - `tag === 'others'`: Passive backlog. Schedule check every **21 days** (504h). Queue Priority: **10**.
   - `tag === 'mine'`: Anomaly check (user marked domain as owned, but WHOIS returned available). Schedule check every **3 days** (72h). Queue Priority: **25**.
   - Priority 10–25 ensures urgent drop watches (priority 80–125) and upcoming renewals (priority 30–65) always take precedence; available domain checks only consume surplus batch slots.
   - Standard gTLD checks route via zero-cost IANA RDAP first, preserving commercial credits.

### Implementation Tasks

- [x] **15.1. De-terminalize Available/Dropped Status in Scheduler**
  - **Status**: ✅ Completed
  - **Requirement**:
    - In `supabase/functions/check-domains/scheduler.ts`, restrict `isAutoCheckTerminal` solely to `status === 'reserved'`.
    - Implement tag-differentiated verification cadence for `status === 'available'` and `status === 'dropped'`.
    - Set priorities to 20 (`to-snatch`), 10 (`others`), and 25 (`mine`).

- [x] **15.2. Add Scheduler Unit Tests for Available Domain Cadence**
  - **Status**: ✅ Completed
  - **Requirement**:
    - In `supabase/functions/check-domains/scheduler.test.ts`, test that recently checked available domains are not due immediately.
    - Test that `to-snatch` available domains become due after 7 days with priority 20.
    - Test that `others` available domains become due after 21 days with priority 10.
    - Test that `reserved` domains remain strictly terminal.

- [x] **15.3. Handle Available-to-Registered Flip & Telemetry**
  - **Status**: ✅ Completed
  - **Requirement**:
    - In `supabase/functions/check-domains/index.ts`, when an available domain re-check returns registered, seamlessly persist updated registration/expiry data.
    - If `tag === 'to-snatch'`, record telemetry logging that a target domain was registered by a third party.

- [x] **15.4. Frontend Freshness Indicator for Available Domains**
  - **Status**: ✅ Completed
  - **Requirement**:
    - In `src/components/DomainItem.tsx` and `TooltipContent.tsx`, indicate verification freshness (e.g. "Available · Verified 2d ago") so users know how recently availability was confirmed.

## 16. Tag Switcher Dropdown Placement, Stacking Context & Overflow Fix

**Objective**: Fix the tag changer popover being clipped by row `overflow-hidden`, rendering behind the upper row, and colliding with the main tag button's tooltip.

### Progress Legend
- ⏳ Pending
- 🔄 In Progress
- ✅ Completed

### Root Cause Audit
1. **Container Overflow Clipping**: `DomainItem` root container had `overflow-hidden`. Any child positioned with `bottom-full` (outside the top boundary of the row) was clipped by the row container, appearing sliced off or hidden behind the upper row.
2. **Upward Collision**: Positioning the popover at `bottom-full mb-1.5` forced it to render directly into the space occupied by the row above it.
3. **Missing Elevated Stacking Context**: Without `hover:z-30 focus-within:z-30 relative` on the row, sibling DOM ordering or child stacking contexts allowed upper rows to paint over the popover.
4. **Trigger Tooltip Clutter**: Wrapping the main tag button in `<Tooltip content="Current tag: ...">` caused both the tooltip bubble and the button switch popover to open simultaneously in the exact same physical coordinates, fighting for pointer events and obscuring the controls.
5. **Nested Tooltips in Popover**: Wrapping each option button in a portal tooltip caused unnecessary delay, pointer flicker, and visual noise.

### Implementation Tasks

- [x] **16.1. Remove `overflow-hidden` & Elevate Row Stacking on Hover**
  - **Status**: ✅ Completed
  - **Requirement**:
    - In `src/components/DomainItem.tsx`, remove `overflow-hidden` from the row root container.
    - Add `hover:z-20 focus-within:z-20` so any active row is elevated above adjacent rows in stacking order.

- [x] **16.2. Reposition Tag Switcher to Downward Floating Popover**
  - **Status**: ✅ Completed
  - **Requirement**:
    - Change tag popover placement from `bottom-full mb-1.5` to `top-full mt-1.5 right-0 z-30` (or centered under the button).
    - Ensure it never invades or hides behind the upper row.

- [x] **16.3. Clean Tag Option Chips & Remove Redundant Trigger Tooltip**
  - **Status**: ✅ Completed
  - **Requirement**:
    - Remove the redundant `<Tooltip>` wrapper from the main tag button to prevent conflicting popups.
    - In the popover, render explicit, clean option chips with icon and text labels (`Mine`, `To Snatch`, `Others`) without nested portal tooltips.

## 17. Quick TLD Filter Toggle Pills Next to Keyword Search Bar

**Objective**: Allow users to instantly switch between primary domain extensions (`.id`, `.co.id`, `.com`, or `All`) with a single click directly next to the keyword search bar, eliminating the need to scroll down to the bottom filter dropdown.

### Progress Legend
- ⏳ Pending
- 🔄 In Progress
- ✅ Completed

### Requirement Analysis
1. **Convenience & Speed**: Users managing portfolios frequently want to view only Indonesian apex `.id`, commercial second-level `.co.id`, or global `.com` domains. Currently, filtering by TLD requires finding and opening the secondary dropdown select below the domain list.
2. **Placement**: Situate a responsive pill toggle group right next to `<KeywordDomainFilter />` in the search header block.
3. **Behavior**:
   - Provide pills for `All`, `.id`, `.co.id`, `.com`.
   - Clicking an unselected extension filters the list to that extension immediately.
   - Clicking an already-selected extension toggles it off back to `All`.
   - Include real-time badge count showing the number of domains matching each extension.
   - Maintain seamless bidirectional synchronization with the existing `tldFilter` state and `localStorage`.

### Implementation Tasks

- [x] **17.1. Quick TLD Pill Toggle Component Next to Search Bar**
  - **Status**: ✅ Completed
  - **Requirement**:
    - In `src/components/DomainList.tsx`, render a pill-shaped toggle button group alongside `<KeywordDomainFilter />`.
    - Offer toggles for `All`, `.id`, `.co.id`, `.com`.

- [x] **17.2. Dynamic Extension Counts & Active State Styling**
  - **Status**: ✅ Completed
  - **Requirement**:
    - Compute matching domain counts per TLD pill.
    - Highlight the active pill with brand styling and soft contrast badges.

- [x] **17.3. Bidirectional Sync with `tldFilter` & 1-Click Toggle**
  - **Status**: ✅ Completed
  - **Requirement**:
    - Clicking an active pill resets filter to `'all'`.
    - Synchronize state with `tldFilter` and persistence in `localStorage`.








