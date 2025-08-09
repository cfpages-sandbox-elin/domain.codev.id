# Deployment Guide: Domain Codev on Cloudflare Pages

This guide provides step-by-step instructions for deploying the Domain Codev application to Cloudflare Pages.

## Prerequisites

1.  A Cloudflare account.
2.  A GitHub account with the application code pushed to a repository.
3.  All required API keys and Supabase credentials (see the main `README.md` for setup context).

## Deployment Steps

(Steps 1-5 for deploying the frontend application remain unchanged and can be found in the original `deployment.md`)

### Step 1: Push Your Code to GitHub
### Step 2: Create a Cloudflare Pages Project
### Step 3: Configure Build Settings
### Step 4: Add Environment Variables
### Step 5: Deploy the Application

---

## Setting Up Automated Domain Checks (Post-Deployment)

To enable automatic daily checks, you need to deploy and schedule the `check-domains` Supabase Edge Function. This is a crucial step for the app's core functionality.

### 1. Install, Link, and Set Secrets (Common First Step)

First, install the Supabase CLI on your local machine, link it to your project, and set the required secrets.

```bash
# Install the CLI if you haven't already
npm install supabase --save-dev

# Log in to your Supabase account
npx supabase login

# Link your local project to your remote Supabase project
npx supabase link --project-ref <your-project-ref>
```

#### Set Secrets for the Edge Function
The Edge Function needs API keys to work. It also needs a secret key to prevent unauthorized execution.

1.  **Create a Cron Secret:** Generate a strong, random string (e.g., using a password generator). This key will authorize the cron job service to run your function, protecting it from public access.

2.  **Set the Secrets:** Run these commands in your terminal, replacing the placeholders with your actual keys and the secret you just generated.

    ```bash
    # Required: Secret to authorize the cron job
    npx supabase secrets set CRON_SECRET=YOUR_SUPER_SECRET_STRING_HERE

    # Required: WHOIS API Keys (add at least one)
    npx supabase secrets set VITE_WHOIS_API_KEY=YOUR_WHOISXMLAPI_KEY
    npx supabase secrets set VITE_APILAYER_API_KEY=YOUR_APILAYER_KEY
    npx supabase secrets set VITE_WHOISFREAKS_API_KEY=YOUR_WHOISFREAKS_KEY
    npx supabase secrets set VITE_WHOAPI_COM_API_KEY=YOUR_WHOAPI_COM_KEY

    # Optional: Set these if you are using a self-hosted who-dat instance
    # npx supabase secrets set VITE_WHO_DAT_URL=https://your-who-dat-instance.vercel.app
    # npx supabase secrets set VITE_WHO_DAT_AUTH_KEY=YOUR_WHO_DAT_SECRET_KEY
    ```

### 2. Deploy the Edge Function

Deploy the `check-domains` function from your local machine to Supabase.

```bash
npx supabase functions deploy check-domains
```

After deploying, choose **one** of the following methods to schedule the job.

### Option 1: Using Supabase's Built-in Scheduler (Simple)

This is the easiest method and is great for most use cases.

1.  Navigate to your project on the [Supabase Dashboard](https://app.supabase.com).
2.  Go to **Edge Functions** in the left sidebar.
3.  Click on the **`check-domains`** function.
4.  In the function's details page, find the **"Invoke on a schedule"** section.
5.  Enter a **Name** for your job, like `Daily Domain Check`.
6.  In the **"Cron schedule"** input, paste `0 0 * * *` to run the job daily at midnight (UTC).
7.  Click **Create schedule**.

### Option 2: Using an External Cron Service (e.g., fastcron.com)

This method provides more advanced features like detailed logs and failure notifications.

1.  **Sign up for a cron service:** Create an account on a service like [fastcron.com](https://fastcron.com/).

2.  **Get your Edge Function URL:**
    *   In your Supabase Dashboard, go to **Edge Functions** and click on the `check-domains` function.
    *   Under "Invoke via", find and copy the **POST** URL. It will look like `https://<project-ref>.supabase.co/functions/v1/check-domains`.

3.  **Create a Cron Job in FastCron:**
    *   Log into your FastCron dashboard and click **"Add a cronjob"**.
    *   Fill out the form:
        *   **URL to call**: Paste your Edge Function URL here.
        *   **When to call**: Select "Once a day" or enter `0 0 * * *` in the **Expression** field to run at midnight UTC.
        *   Expand the **"Send HTTP request"** section. **This is the most important step.**
        *   In the **HTTP headers** text area, add the following line, replacing `YOUR_SUPER_SECRET_STRING_HERE` with the `CRON_SECRET` you created earlier:
            ```
            Authorization: Bearer YOUR_SUPER_SECRET_STRING_HERE
            ```
        *   **HTTP Method**: Can be left as `GET` or changed to `POST`.
    *   Configure other settings like timeout and notifications to your liking.
    *   Click **Save change**.

Your application is now fully deployed and configured for automated daily checks.

---

## Supabase Configuration & Troubleshooting

(This section on troubleshooting common Supabase issues like login redirects and provider errors remains unchanged and can be found in the original `deployment.md`)