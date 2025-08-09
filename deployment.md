# Deployment Guide: Domain Tracker Pro on Cloudflare Pages

This guide provides step-by-step instructions for deploying the Domain Tracker Pro application to Cloudflare Pages.

## Prerequisites

1.  A Cloudflare account.
2.  A GitHub account with the application code pushed to a repository.
3.  All required API keys and Supabase credentials (see the main `README.md` for setup context).

## Deployment Steps

### Step 1: Push Your Code to GitHub

Ensure your latest code, including all the new build configuration files (`package.json`, `vite.config.ts`, etc.), is pushed to a GitHub repository.

### Step 2: Create a Cloudflare Pages Project

1.  Log in to your [Cloudflare dashboard](https://dash.cloudflare.com/).
2.  In the account menu, select **Workers & Pages**.
3.  Click on **Create application** > **Pages** > **Connect to Git**.
4.  Select the GitHub repository containing your application code and click **Begin setup**.

### Step 3: Configure Build Settings

Cloudflare will ask for build settings. Use the following configuration, which is standard for a Vite project:

-   **Project name**: Choose a name for your project (e.g., `domain-tracker-pro`).
-   **Production branch**: Select your main branch (e.g., `main`).
-   **Framework preset**: Select **Vite** from the dropdown menu. Cloudflare will automatically populate the correct build command and output directory.
    -   **Build command**: `npm run build`
    -   **Build output directory**: `dist`
-   **Root directory**: Leave this blank if your `package.json` is at the root of the repository.

### Step 4: Add Environment Variables

This is the most critical step. You must add all the secret keys and configuration variables for the application to function correctly.

1.  Scroll down to the **Environment variables (advanced)** section.
2.  Click **Add variable** for each of the following keys and paste in your corresponding secret value.

    **Required for Core Functionality:**
    -   `VITE_SUPABASE_URL`: Your project's Supabase URL.
    -   `VITE_SUPABASE_ANON_KEY`: Your project's Supabase `anon` public key.

    **Required for WHOIS Lookups (add at least one):**
    -   `VITE_WHO_DAT_URL`: The URL of your self-hosted `who-dat` instance.
    -   `VITE_WHO_DAT_AUTH_KEY`: (Optional) The auth key for your `who-dat` instance.
    -   `VITE_WHOIS_API_KEY`: Your API key from WhoisXMLAPI.
    -   `VITE_APILAYER_API_KEY`: Your API key from apilayer.com.
    -   `VITE_WHOISFREAKS_API_KEY`: Your API key from whoisfreaks.com.

3.  Ensure you use the `VITE_` prefix for all variables, as this is required by Vite to expose them to your frontend code.

### Step 5: Deploy the Application

1.  After configuring the build settings and environment variables, click **Save and Deploy**.
2.  Cloudflare will start building and deploying your application. You can watch the progress in the deployment logs.
3.  Once the deployment is complete, Cloudflare will provide you with a unique `.pages.dev` URL where your live application can be accessed.

---

## Supabase Configuration & Troubleshooting

When you deploy your application to a live environment, you may encounter issues related to authentication redirects or database access. These problems usually stem from Supabase's security settings, which need to be explicitly configured for your new live URL.

Here are solutions to the most common problems.

### Problem: Login Redirects to `localhost` on the Live Site

**Symptom:** After you click "Sign in with Google" on your deployed site (e.g., `https://your-app.pages.dev`), you are redirected back to `http://localhost:5173` or see an error.

**Cause:** Supabase, for security, only allows redirects to URLs you have pre-approved. Your app correctly tells Supabase to redirect back to its current address (e.g., `https://your-app.pages.dev`), but if that address isn't in Supabase's "allow list," Supabase falls back to its default **Site URL**, which is probably still set to `localhost` from when you were developing.

**Solution: Update Your Supabase URL Configuration**

1.  Go to your project in the [Supabase Dashboard](https://app.supabase.com/).
2.  Navigate to **Authentication** (the user icon) in the left sidebar.
3.  Click on **URL Configuration**.

4.  **Set the Site URL**:
    *   Change the **Site URL** to your main production URL.
    *   Example: `https://domain-tracker-pro.pages.dev`

5.  **Add Additional Redirect URLs**:
    *   This is the most important part. In the **Redirect URLs** section, add the URLs for *every* environment where you want login to work. Use the **Add URL** button.
    *   **Production**: `https://your-project.pages.dev`
    *   **Local Development**: `http://localhost:5173` (or whatever your local port is)
    *   **Preview Deployments (Recommended)**: `https://*.your-project.pages.dev` (The wildcard `*` allows Cloudflare's preview deployments to work automatically).
    *   **Important:** URLs are exact matches, including `http` vs `https://`.

### Problem: Google Sign-In Fails with a Provider Error

**Symptom:** The Google Sign-In popup appears but shows an error, or the redirect fails completely.

**Cause:** Google Cloud also needs to know which URLs are allowed to use your OAuth credentials. When you deployed to a new Supabase project, you received a new, unique callback URL that must be registered with Google.

**Solution: Update Google Cloud Authorized URIs**

1.  In the Supabase dashboard, navigate to **Authentication** > **Providers** and select **Google**.
2.  Copy the **Redirect URL**. It will look like `https://<your-project-ref>.supabase.co/auth/v1/callback`.
3.  Go to your [Google Cloud Console](https://console.cloud.google.com/) and navigate to **APIs & Services > Credentials**.
4.  Click on the name of your **OAuth 2.0 Client ID** that you are using for this project.
5.  Under **Authorized redirect URIs**, click **+ ADD URI**.
6.  Paste the callback URL you copied from Supabase.
7.  Click **Save**.

### Problem: App Crashes with "Could not find column 'X'"

**Symptom:** The application fails to load or crashes when trying to fetch data, and the browser console shows an error like: `message: "Could not find the 'last_checked' column of 'domains' in the schema cache"`.

**Cause:** This error means the frontend code is trying to access a database column that doesn't exist in your `domains` table. The frontend type definition (in `src/types.ts`) is out of sync with the actual database schema in Supabase. This can happen if you pull new code that requires a database change.

**Solution: Align Your Database Schema**

1.  **Check the Required Schema:** Open the `README.md` file in the project. It contains the official SQL script used to create the `domains` table. This is the "source of truth" for what the table should look like.
2.  **Compare with Your Table:** Go to the **Table Editor** in your Supabase dashboard and inspect your `domains` table. Check if all the columns from the SQL script exist and have the correct names and types.
3.  **Add the Missing Column(s):** If a column is missing, you can add it easily.
    *   In the **Table Editor**, click the **+ Add column** button.
    *   Enter the `name` of the missing column (e.g., `last_checked`).
    *   Select the correct `type` (e.g., `timestamptz` for a timestamp with timezone).
    *   Set a default value or allow `NULL`s if necessary.
    *   Click **Save**.

    Alternatively, for more complex changes, you can use an `ALTER TABLE` command in the **SQL Editor**. For example:
    ```sql
    ALTER TABLE public.domains
    ADD COLUMN last_checked timestamptz NULL;
    ```
