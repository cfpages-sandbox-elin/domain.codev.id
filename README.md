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

---

## Google OAuth Redirect Configuration

After setting up Google OAuth in both Supabase and the Google Cloud Console, it's crucial to configure the Authorized redirect URIs correctly. This tells Google where it's safe to redirect the user after successful authentication.

You need to add the following URI format to your Authorized redirect URIs in both your Supabase project's Authentication settings (under Providers > Google) and your Google Cloud Console credentials for the OAuth 2.0 Client ID:

`https://[your-domain]/auth-callback`

Replace `[your-domain]` with the actual domain where your application is hosted (e.g., `https://domain.codev.id`). This specific path (`/auth-callback`) is where the application's `AuthCallback` component handles the post-authentication redirect to the user's original page.

### Troubleshooting: Redirect Mismatch Errors

If you encounter redirect mismatch errors during the Google OAuth flow, it almost always means that the Authorized redirect URI configured in your Google Cloud Console or Supabase does not exactly match the callback URL your application is using. Double-check for typos, extra slashes, or differences in HTTP vs. HTTPS. Ensure the URI in both Google Cloud and Supabase precisely matches the path where your `AuthCallback` component is rendered in your deployed application.


---

## Troubleshooting Cloudflare Pages Cache

When deploying to Cloudflare Pages, you might notice that recent code changes aren't immediately reflected in your browser. This is often due to Cloudflare's aggressive caching of static assets to improve performance. While this is beneficial for users, it can be annoying during development or when verifying a recent deployment.

Here are some common ways to bypass or deal with Cloudflare Pages cache:

1.  **Hard Refresh:** The quickest way to try and fetch fresh assets is by performing a hard refresh in your browser.
    *   Windows/Linux: `Ctrl + Shift + R`
    *   macOS: `Cmd + Shift + R`

2.  **Clear Browser Cache:** If a hard refresh doesn't work, clearing your browser's cache for the specific site is the next step. The exact steps vary by browser but usually involve the browser's developer tools or privacy settings.

3.  **Append Query Strings (Development consideration):** Build tools like Vite (used in this project) automatically append unique hash strings to your production build asset filenames (e.g., `index.js?v=abcdef123`). This cache-busting technique forces the browser to download the new file when the content changes. While you typically don't need to manually manage this in production builds, understanding this mechanism helps explain why Cloudflare's cache is effectively bypassed for changed assets in a proper production deployment. During development, if you are testing a staged deployment or a preview URL, a hard refresh is usually sufficient.

If you continue to see outdated content after a hard refresh and clearing browser cache, verify that your latest changes have been successfully deployed to Cloudflare Pages by checking your project's deployment history in the Cloudflare dashboard.