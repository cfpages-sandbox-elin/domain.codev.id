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

### Step 6: Verify Supabase Redirect URL

Your Google OAuth flow will only work if Google knows it's safe to redirect back to your Supabase project after authentication.

1.  Go to your Supabase project dashboard > **Authentication** > **Providers** > **Google**.
2.  Ensure the **Redirect URL** shown there is added to your list of **Authorized redirect URIs** in your Google Cloud Console credentials. This step is crucial and is independent of your hosting provider.

Your application is now live! Any future pushes to your production branch on GitHub will automatically trigger a new deployment on Cloudflare Pages.
