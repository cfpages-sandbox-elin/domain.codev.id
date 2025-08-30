# Deployment Guide: Domain Codev on Cloudflare Pages

This guide provides step-by-step instructions for deploying the Domain Codev application to Cloudflare Pages.

## Prerequisites

1.  A Cloudflare account.
2.  A GitHub account with the application code pushed to a repository.
3.  All required API keys and Supabase credentials (see the main `README.md` for setup context).

## Deployment Steps

### Step 1: Push Your Code to GitHub
Push your project code to a GitHub repository.

### Step 2: Create a Cloudflare Pages Project
1.  Log in to your Cloudflare dashboard.
2.  Go to **Workers & Pages** -> **Create application** -> **Pages** -> **Connect to Git**.
3.  Select your GitHub repository and begin setup.

### Step 3: Configure Build Settings
- **Project name**: Choose a name for your project.
- **Production branch**: Select your main branch.
- **Framework preset**: `Vite`.
- **Build command**: `npm run build` or `vite build`.
- **Build output directory**: `dist`.

### Step 4: Add Environment Variables
This is the most critical step for configuring the application's backend functionality. In your Cloudflare Pages project, go to **Settings** -> **Environment variables**. Add the following variables, making sure to add them for both **Production** and **Preview** environments.

#### Supabase Configuration
- `VITE_SUPABASE_URL`: Your Supabase project URL.
- `VITE_SUPABASE_ANON_KEY`: Your Supabase project's anonymous key.
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase project's service role key (this is a secret).
- `SUPABASE_JWT_SECRET`: Your Supabase project's JWT secret (this is a secret). You can find this in your Supabase project's settings under API -> JWT Settings.

#### Cron Job Secret
- `CRON_SECRET`: A strong, random string you generate. This is used to secure the scheduled task that checks domain statuses.

#### WHOIS Provider API Keys (Add at least one)
- `WHOIS_API_KEY`: Your key from WhoisXMLAPI.
- `APILAYER_API_KEY`: Your key from apilayer.com.
- `WHOISFREAKS_API_KEY`: Your key from WhoisFreaks.
- `WHOAPI_COM_API_KEY`: Your key from whoapi.com.
- `RAPIDAPI_KEY`: Your key from RapidAPI.

#### Optional: Self-Hosted `who-dat`
- `WHO_DAT_URL`: The URL of your self-hosted who-dat instance.
- `WHO_DAT_AUTH_KEY`: The authentication key for your who-dat instance.

### Step 5: Deploy the Application
Click **Save and Deploy**. Cloudflare Pages will build and deploy your application. The backend functions in the `/functions` directory will be deployed automatically.

---

## Backend and Cron Job Configuration

The application's backend logic for WHOIS lookups and daily domain checks is handled by **Cloudflare Functions**, which are included in this repository.

- **Real-time Lookups (`/api/get-whois`):** This function is called by the frontend to perform WHOIS lookups in real-time. It authenticates users by verifying their Supabase JWT.
- **Scheduled Checks (`/api/check-domains`):** This function checks the status of registered domains daily. It is triggered by a cron job.

### Setting Up the Cron Job

To automate the daily domain checks, you need to set up a cron job that calls the `/api/check-domains` endpoint on your deployed application. You can use a free service like [cron-job.org](https://cron-job.org/) or a GitHub Actions workflow.

**Example using `cron-job.org`:**

1.  **URL:** `https://your-project-name.pages.dev/api/check-domains`
2.  **Schedule:** Set it to run once a day (e.g., at midnight).
3.  **HTTP Method:** `POST` (or `GET`, the function supports both for cron triggers).
4.  **Custom Headers:** You must add an `Authorization` header to secure the endpoint.
    -   **Name:** `Authorization`
    -   **Value:** `Bearer YOUR_CRON_SECRET` (replace `YOUR_CRON_SECRET` with the value you set in your Cloudflare environment variables).

This setup will trigger the `check-domains` function securely on a daily schedule.

---

## Supabase Configuration & Troubleshooting

(This section on troubleshooting common Supabase issues like login redirects and provider errors remains unchanged and can be found in the original `deployment.md`)
