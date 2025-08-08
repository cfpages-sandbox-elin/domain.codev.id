# Domain Tracker Pro

An aesthetically pleasing app to check domain availability and track domain expiration dates. It helps you renew your domains on time or snatch up expiring ones as soon as they drop, with all your data securely stored in your personal account.

![Domain Tracker Pro Screenshot](https://picsum.photos/1200/600)

## Features

*   **Secure User Accounts:** Sign in with your Google account to keep your domain list private and synced.
*   **Resilient Real-Time Domain Check:** Quickly see if a domain is available using a tiered approach: an open-source `who-dat` service first, with automatic fallbacks to WhoisXMLAPI, apilayer.com, and whoisfreaks.com.
*   **Track Your Portfolio:** Add domains to a personal tracking list.
*   **Smart Tagging:** Tag domains as "Mine" for renewal reminders or "To Snatch" for drop-catching.
*   **Expiration Alerts:** Get in-app notifications before your domains expire.
*   **Drop-Catching Helper:** For expired domains, get an estimated timeline for when they might become available.
*   **Light/Dark Mode:** Beautifully designed interface that's easy on the eyes.
*   **Cloud Data Persistence:** Your list is securely saved to your Supabase account, accessible from anywhere.

## Tech Stack

*   **Vite** + **React 18** & **TypeScript**
*   **Tailwind CSS** for styling
*   **Supabase** for Authentication and Database
*   **`who-dat`**, **WhoisXMLAPI**, **apilayer.com API**, & **whoisfreaks.com API** for live domain data

---

## Getting Started: Local Development

Follow these steps to set up and run the project on your local machine.

### Step 1: Clone the Repository

```bash
git clone <repository-url>
cd <repository-directory>
```

### Step 2: Install Dependencies

You need to have [Node.js](https://nodejs.org/) (version 18 or newer) installed.

```bash
npm install
```

### Step 3: Configure Environment Variables

1.  Create a new file named `.env` in the root of the project.
2.  Add the required variables for Supabase and the WHOIS APIs. You will need to get these keys from their respective services.

    ```env
    # Supabase Credentials (Required)
    VITE_SUPABASE_URL=YOUR_SUPABASE_PROJECT_URL
    VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY

    # WHOIS API Keys (Add at least one provider)
    VITE_WHO_DAT_URL=https://your-who-dat-instance.vercel.app
    VITE_WHO_DAT_AUTH_KEY=YOUR_WHO_DAT_SECRET_KEY
    VITE_WHOIS_API_KEY=YOUR_WHOISXMLAPI_KEY
    VITE_APILAYER_API_KEY=YOUR_APILAYER_KEY
    VITE_WHOISFREAKS_API_KEY=YOUR_WHOISFREAKS_KEY
    ```

    **Note:** The `VITE_` prefix is required for Vite to expose these variables to the application. The original `README.md` contains details on setting up the `domains` table in Supabase.

### Step 4: Run the Development Server

```bash
npm run dev
```

The application should now be running locally, typically at `http://localhost:5173`.

## Production Deployment

For instructions on how to deploy this application to a live environment like Cloudflare Pages, see the **[Deployment Guide](./deployment.md)**.
