# Product Requirements Document: Domain Codev

**Author:** World-Class Senior Frontend React Engineer
**Version:** 1.9
**Date:** 2024-05-29

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
*   **3.2.1:** Authenticated users must be able to enter a domain name into an input field and check its registration status (available or registered).
*   **3.2.2:** For registered domains, the system shall fetch and display key WHOIS data, including registrar, registration date, and expiration date.
*   **3.2.3:** For available domains, the application shall present a "Buy" button and a dropdown of recommended registrars to facilitate immediate acquisition.
    *   **3.2.3.1. Layout:** The availability status text, registrar dropdown, and "Buy Now" button must be rendered inline with the domain name on a single line in the domain list view to provide a compact and efficient user interface. These elements should be visually grouped and appear after the domain's tags.
*   **3.2.4:** The registrar list will be context-aware, suggesting relevant registrars based on the domain's TLD (e.g., specific options for `.id` domains vs. gTLDs).

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
*   **3.7.2:** This check is implemented as a Supabase Edge Function, triggered by a cron job. The trigger can be configured via Supabase's built-in scheduler or an external service (e.g., fastcron.com).
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
*   **4.3. Security:** User data must be isolated and protected. The `check-domains` Edge Function must be protected by a secret key.
*   **4.4. Data Persistence:** All user data must be stored securely in a remote database (Supabase).
*   **4.5. Global Error Boundary:** The application must not crash to a blank screen in case of a UI rendering error. A global error boundary shall catch such errors and display a user-friendly fallback screen with an option to recover (e.g., refresh the page).

## 5. Technical Stack

*   **Frontend:** React 18+, TypeScript
*   **Styling:** Tailwind CSS
*   **Content Parsing:** `marked` for rendering documentation
*   **Authentication:** Supabase Auth (with Google OAuth)
*   **Database:** Supabase (PostgreSQL with RLS)
*   **Backend Automation:** Supabase Edge Function with Cron Jobs
*   **WHOIS Data:**
    *   Primary (Optional, Self-hosted): `who-dat`
    *   Backup 1: WhoisXMLAPI
    *   Backup 2: apilayer.com API
    *   Backup 3: whoisfreaks.com API
*   **Automation (Production):** Supabase's built-in scheduler or an external cron service (e.g., fastcron.com, cron-job.org) triggering the secure Supabase Edge Function.

## 6. Out of Scope (Future Enhancements)

*   Browser push notifications.
*   Direct domain registration/backordering integration with registrars.
*   Payment processing for premium features.
*   Support for other OAuth providers (e.g., GitHub, Twitter).

## 7. Status

It is live now and deployed at https://domain.codev.id

## 8. To-Do List (Generated)

- [ ] **3.1. User Authentication**
    - [x] 3.1.1: Users must be able to sign up and log in to the application using their Google account (OAuth). (Supabase service initiated)
    - [x] 3.1.2: All domain data must be associated with the logged-in user's account. (Requires implementing database interactions)
    - [x] 3.1.3: Users must be able to log out of the application. (Requires implementing logout function in UI)
    - [x] 3.1.4: Unauthenticated users should be presented with a login page and cannot access the application's core features. (Requires implementing route guarding)

- [ ] **3.2. Domain Status Checking**
    - [x] 3.2.1: Authenticated users must be able to enter a domain name into an input field and check its registration status (available or registered).
    - [x] 3.2.2: For registered domains, the system shall fetch and display key WHOIS data.
    - [x] 3.2.3: For available domains, present a "Buy" button and registrar dropdown.
    - [x] 3.2.4: Make registrar list context-aware based on TLD.

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
    - [x] 3.5.2: Implement multi-level, color-coded highlighting for expiring domains (90, 30, 7 days, and expired).
    - [x] 3.5.3: Notifications shall be clearly visible within the application's UI.

- [ ] **3.6. Drop Snatching Assistance**
    - [x] 3.6.1: For domains tagged "To Snatch" that have expired, the system will provide an informative modal with an estimated lifecycle timeline.
    - [x] 3.6.2: This timeline will estimate the end of the Grace Period, Redemption Period, and the potential drop date.

- [ ] **3.7. Automated Daily Checks (Server-Side)**
    - [x] 3.7.1: The application backend will perform a daily background check on all tracked domains that require a status update. (Implemented with Supabase Edge Function)
    - [x] 3.7.2: This check is implemented as a Supabase Edge Function, triggered by a daily cron job. (Requires developer setup as per README)
    - [x] 3.7.3: The primary purpose of the check is to update the status of expired domains to see if they have been renewed or if they have "dropped". (Logic implemented in Edge Function)

- [ ] **3.8. UI/UX**
    - [x] 3.8.1: The application must feature a theme toggle for Light and Dark modes.
    - [x] 3.8.2: The interface must be clean, modern, and aesthetically pleasing, built with Tailwind CSS.
    - [x] 3.8.3: The application must be fully responsive and usable on various screen sizes.
    - [x] 3.8.4: Implement Compact View toggle and functionality.

- [ ] **3.9. System Behavior**
    - [x] 3.9.1. Configuration Error Handling: The application must not crash if critical environment variables are missing.
    - [x] 4.5. Global Error Boundary: The application must not crash to a blank screen in case of a UI rendering error.

- [ ] **3.10. In-App Guidance & Documentation**
    - [x] 3.10.1.1. Domain Form: Add descriptive text below the "Check Domain" heading.
    - [x] 3.10.1.2. Tracked Domains: Add an informational block explaining auto-checks.
    - [x] 3.10.1.3. Empty State: The message shown when the tracking list is empty will be encouraging and directive.
    - [x] 3.10.1.4. Drop Snatching Modal: The modal will more clearly state that the provided dates are estimates and can vary.
    - [x] 3.10.2.1. New View: Implement the "Documentation" view.
    - [x] 3.10.2.2. Content: Load markdown files into the application.
    - [x] 3.10.2.3. Navigation: Implement a sidebar for doc navigation.
    - [x] 3.10.2.4. Markdown Rendering: Use `marked` to render content as HTML.

- [ ] **3.11. Bulk Domain Management**
    - [x] 3.11.1: Implement bulk add via textarea.
    - [x] 3.11.2: Implement data import from JSON and CSV files.
    - [x] 3.11.3: Implement data export to JSON and CSV files.
    - [x] 3.11.4: Implement concurrent, rate-limited processing for bulk additions.

- [ ] **4. Non-Functional Requirements** (These are ongoing considerations and not distinct tasks)
    - [x] 4.1. Performance: The UI must be fast and responsive. (Ongoing effort)
    - [x] 4.2. Usability: The application flow should be intuitive. (Ongoing effort)
    - [x] 4.3. Security: User data must be isolated and protected. (Addressed by Supabase RLS and secure coding practices)
    - [x] 4.4. Data Persistence: All user data must be stored securely in a remote database (Supabase). (Addressed by using Supabase)

- [x] **5. Technical Stack** (Defined in `prd.md` and reflected in `package.json`)

- [x] **6. Out of Scope (Future Enhancements)** (Defined in `prd.md`)

- [x] **7. Status** (Defined in `prd.md`)
