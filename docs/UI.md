# UI / UX Audit

Last audited: 2026-06-03 13:09 WIB.

## Current Experience

The app already supports the core workflow: sign in, add one or many domains, check WHOIS, tag domains as owned or target, filter/sort, export, and see expiry/drop cues. The UI is practical but still feels like a prototype: the dashboard is card-heavy, controls wrap heavily on small screens, the persistent status log competes with the add button, and the most important portfolio insights are not summarized before the list.

## Strengths

| Area | What works |
| --- | --- |
| Core workflow | Single add, bulk paste/import, JSON/CSV export, manual recheck, and purchase links are already present. |
| Domain rows | Status, tag, expiry, registrar, urgency color, and action buttons are available in one place. |
| Large-list support | Compact mode exists and is useful for domain portfolios. |
| Safety | Config error and global error screens prevent blank failures. |
| Theme | Light/dark mode is implemented and persisted. |

## Issues And Improvements

| Priority | Area | Finding | Recommendation |
| --- | --- | --- | --- |
| High | Dashboard hierarchy | The first signed-in screen starts with a large `Tracked Domains` card and setup notice, but no portfolio summary. | Add a compact top summary: total domains, expiring in 7/30/90 days, available targets, failed checks, and next scheduled check. |
| High | Sorting | "Added: Newest" does not work because of a comparator bug in `DomainList.tsx`. | Fix comparator before relying on sort UX. |
| High | Bulk workflow | Bulk add gives logs but no clear progress bar, success/failure table, or retry list. | Show batch progress, counts, failed domains, duplicate count, and a retry failed button. Future backend should persist import jobs. |
| High | Mobile controls | Filters, import/export, and sort controls can become a crowded wrapped toolbar. | Collapse filters into a segmented control plus "More filters" menu on mobile. Keep sort as a compact select/menu. |
| High | Notifications | Notifications are in-memory and hidden behind a bell. | Add persistent notification center and dashboard alert strip for urgent renewals/dropped targets. |
| High | WHOIS provider status | The dashboard does not show provider quota, configured providers, or provider failures. | Add a WHOIS Providers panel with active/missing/not-implemented providers, quota remaining, last success/error, and bulk re-check cost estimate. |
| Medium | Status log | Floating log is useful for debugging but competes with the main workflow. | Make it developer/debug mode, or move detailed logs into an activity drawer. Keep user-facing status near the active operation. |
| Medium | Empty state | Empty list only pushes import/add bulk. | Offer two clear first actions: "Add owned domains" and "Track target domains", with paste support directly available. |
| Medium | Domain row actions | Delete, toggle, info, and recheck are icon-only and can be unclear. | Add tooltips consistently and use a confirmation for delete. Consider a row action menu on mobile. |
| Medium | Drop timeline | Timeline is generated as HTML string and only enabled for `expired` status. | Render as React components, show for target domains with expiry dates, and label confidence/assumptions per TLD. |
| Medium | Registrar links | Registrar options are hardcoded and row-level. | Add user settings for preferred registrars by TLD and make "Buy" open the preferred registrar by default. |
| Medium | Docs UX | Docs view is useful, but generated docs are disconnected from actual markdown files. | Use build-time markdown imports and add a docs search/filter. |
| Low | Visual polish | Many controls use pill/rounded styles while cards use large rounded corners. | Standardize radius and spacing. Use dense, utilitarian SaaS styling for repeated domain management. |
| Low | Accessibility | Modal focus is not trapped and docs use injected HTML. | Add focus trap, restore focus on close, sanitize docs HTML or constrain markdown source, and test keyboard navigation. |

## Recommended Dashboard Layout

1. Header: brand, search, add domain button, import, notifications, settings.
2. Summary strip: `Total`, `Expiring <= 7d`, `Expiring <= 30d`, `Available targets`, `Failed checks`.
3. Primary toolbar: search input, tag/status filter, expiry filter, sort.
4. Domain table/list: stable columns on desktop; compact stacked rows on mobile.
5. Activity drawer: import progress, WHOIS provider failures, cron/check history.

## Bulk Add UX Target

The final product goal should make bulk input first-class:

1. Paste domains or upload CSV/JSON.
2. Preview normalized domains before saving.
3. Show duplicates and invalid lines before running WHOIS.
4. Create an import job.
5. Process checks server-side with rate limiting.
6. Let the user close the modal and return later.
7. Show final import report with retry/export failed options.

## Copy / Label Improvements

| Current | Suggested |
| --- | --- |
| `Snatch this Domain` | `Track as Target` |
| `To Snatch` | `Target` or keep `To Snatch` if you prefer the domain-investing language |
| `Import / Add Bulk` | `Bulk Add` |
| `Automated Daily Checks` setup box | Move to settings until automation is not configured |
| `Could not retrieve WHOIS data` | Add provider/error reason when available |

## Implementation Order

1. Fix sort bug and clean `index.html` script/import-map issues.
2. Add dashboard summary metrics from existing `domains` state.
3. Improve bulk modal progress/reporting.
4. Redesign toolbar for mobile.
5. Add persistent notifications after the D1 backend exists.
6. Move status log into an activity drawer or debug setting.
