# Mobile Optimization Plan

Audit date: 2026-06-26 WIB.

Goal: make the existing domain tracking app usable and visually tighter on phone-width screens without changing backend behavior or removing core workflows.

## Audit Findings

| Status | Area | Mobile issue | Optimization plan |
| --- | --- | --- | --- |
| ✅ Implemented | App shell/header | Header keeps too many equal-weight icons in one row; logo/title and account-only items compete for width. | Tighten header height/padding, hide nonessential brand text earlier, shrink icon targets slightly on small screens, hide integration/docs/account actions on the smallest screens where dashboard work matters most, and make notifications fit viewport width. |
| ✅ Implemented | Dashboard container | Main dashboard is a large rounded card with desktop padding, consuming too much of the mobile viewport. | Use edge-to-edge/mobile-light chrome with smaller title and padding; keep the framed card only from `sm` upward. |
| ✅ Implemented | Filter bar | Status filters wrap into multiple tall rows, keyword search competes with chips, and utility buttons stay text-heavy. | Make filters horizontally scrollable on mobile, use compact chip padding/text, move keyword to full-width first control, and make utility actions icon-dominant on narrow screens. |
| ✅ Implemented | Secondary filters | Category/TLD/sort controls do not fill the available small width cleanly. | Put secondary selects into a responsive two-column/mobile full-width grid with stable widths. |
| ✅ Implemented | Domain rows | Each row exposes desktop metadata and empty grid columns on mobile, creating vertical bulk and awkward gaps. | Use a mobile-first row layout: domain line, compressed chips, status/expiry summary, and a compact action strip; remove empty spacer impact on mobile. |
| ✅ Implemented | Row actions | Tag change relies on hover, which is weak on touch screens. | Keep hover behavior for desktop, expose alternate tag buttons on mobile, and hide labels/details that are redundant with icons. |
| ✅ Implemented | Floating filter | Bottom floating filter includes too many chips plus search, taking a large mobile band. | Make mobile floating controls icon-only and hide the floating keyword input until medium screens. |
| ✅ Implemented | Add Domains modal | Modal has desktop padding and radio cards that are too tall for a phone. | Use near-full-screen mobile modal sizing, smaller header/body padding, tighter tabs, compact tag choices, and full-width submit buttons. |
| ✅ Implemented | Integration modal | Long token/curl examples and copy controls can create cramped horizontal layouts. | Stack copy rows on mobile and allow code blocks to scroll horizontally without forcing viewport overflow. |
| ✅ Implemented | Categories page | Word-group chips and auto-category cards can overflow or look busy on phones. | Tighten page header, inputs, chips, and category grids; make chip internals wrap with breakable text. |
| ✅ Implemented | Settings/provider panels | Provider table is desktop-only and creates a poor horizontal-scroll experience. | Add mobile provider cards and keep the table for larger screens. Tighten Auto Mine controls and rule rows. |
| ✅ Implemented | Docs page | Sidebar and article card use desktop proportions; tables/code can be too wide. | Make doc navigation horizontal on mobile, reduce article padding/radius, and tune markdown tables/code for phone widths. |
| ✅ Implemented | Status log/toasts | Fixed panels assume desktop width/position and can cover content. | Constrain fixed panels to viewport width and adjust bottom/top placement on mobile. |

## Implementation Tracker

- [x] Create this audit/plan as a persistent tracker.
- [x] Optimize shell/header, dashboard card, modal shell, status log, and toast sizing.
- [x] Optimize dashboard filter/search/sort/category controls.
- [x] Optimize domain rows and mobile tag actions.
- [x] Optimize Add Domains and reusable tag choice controls.
- [x] Optimize integration modal copy/code rows.
- [x] Optimize categories, settings/provider panels, Auto Mine, and docs layouts.
- [x] Run build verification.
- [x] Remove generated build artifacts after verification.
