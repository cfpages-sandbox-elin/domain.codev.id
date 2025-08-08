# Product Requirements Document: Domain Tracker Pro

**Author:** World-Class Senior Frontend React Engineer
**Version:** 1.4
**Date:** 2024-05-24

---

## 1. Introduction

Domain Tracker Pro is a web application designed for individuals and businesses to monitor domain name availability, track expiration dates, and strategically acquire expiring domains. The application provides a clean, intuitive, and personalized interface with powerful automation features to help users manage their domain portfolios effectively, preventing accidental loss of valuable domains and identifying opportunities to purchase dropped domains.

## 2. User Personas

*   **Alex, the Domain Investor:** Alex buys and sells domain names for profit. They need a tool to track hundreds of domains they are interested in, get precise alerts when domains are about to drop, and quickly check the availability of new ideas. They need their list to be private and accessible from any device.
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

### 3.3. Domain Tracking
*   **3.3.1:** Users must be able to add domains to a persistent tracking list associated with their account.
*   **3.3.2:** The tracked list shall display the domain name, its status, expiration date, and user-assigned tag.
*   **3.3.3:** Users must be able to remove domains from their tracking list.
*   **3.3.4:** Users must be able to switch the tag of a tracked domain (e.g., from "To Snatch" to "Mine" and vice-versa).

### 3.4. Tagging System
*   **3.4.1:** Users must be able to categorize tracked domains with one of two tags:
    *   **"Mine":** For domains the user owns and needs renewal reminders for.
    *   **"To Snatch":** For domains the user wants to acquire after they expire and drop.
*   **3.4.2:** The UI should visually distinguish between domains with different tags.

### 3.5. Expiration Notifications & Alerts
*   **3.5.1:** For domains tagged "Mine", the system must generate a notification when the domain is within a user-defined period of its expiration date (default: 7 days).
*   **3.5.2:** Notifications shall be clearly visible within the application's UI.

### 3.6. Drop Snatching Assistance
*   **3.6.1:** For domains tagged "To Snatch" that have expired, the system will provide an informative modal with an estimated lifecycle timeline based on the domain's expiration date.
*   **3.6.2:** This timeline will estimate the end of the Grace Period, Redemption Period, and the potential date the domain will drop and become available for registration.

### 3.7. Automated Daily Checks (Simulated Client-Side)
*   **3.7.1:** The application will perform a simulated daily background check on all tracked domains when the app is open.
*   **3.7.2:** The primary purpose of the check is to update the status of expired domains to see if they have "dropped".

### 3.8. UI/UX
*   **3.8.1:** The application must feature a theme toggle for Light and Dark modes.
*   **3.8.2:** The interface must be clean, modern, and aesthetically pleasing, built with Tailwind CSS.
*   **3.8.3:** The application must be fully responsive and usable on various screen sizes.

### 3.9. System Behavior
*   **3.9.1. Configuration Error Handling:** The application must not crash if critical environment variables (e.g., Supabase URL, Supabase Anon Key) are missing. Instead, it must display a clear, user-friendly error screen that informs the developer what is wrong and how to fix it by referencing the `README.md`.

## 4. Non-Functional Requirements

*   **4.1. Performance:** The UI must be fast and responsive, with loading states to indicate background operations.
*   **4.2. Usability:** The application flow should be intuitive, requiring minimal instruction for a new user.
*   **4.3. Security:** User data must be isolated and protected. Unauthenticated access is not permitted.
*   **4.4. Data Persistence:** All user data must be stored securely in a remote database (Supabase).
*   **4.5. Global Error Boundary:** The application must not crash to a blank screen in case of a UI rendering error. A global error boundary shall catch such errors and display a user-friendly fallback screen with an option to recover (e.g., refresh the page).

## 5. Technical Stack

*   **Frontend:** React 18+, TypeScript
*   **Styling:** Tailwind CSS
*   **Authentication:** Supabase Auth (with Google OAuth)
*   **Database:** Supabase (PostgreSQL with RLS)
*   **WHOIS Data:**
    *   Primary: `who-dat` (Open Source, self-hostable)
    *   Backup 1: WhoisXMLAPI
    *   Backup 2: apilayer.com API
    *   Backup 3: whoisfreaks.com API
*   **Automation (Production):** A free online cron service (e.g., cron-job.org) triggering a Supabase Edge Function.

## 6. Out of Scope (Future Enhancements)

*   Browser push notifications.
*   Direct domain registration/backordering integration with registrars.
*   Payment processing for premium features.
*   Support for other OAuth providers (e.g., GitHub, Twitter).

## 7. Status

It is live now and deployed at https://domain.codev.id
