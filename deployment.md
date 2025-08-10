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

## Setting Up Backend Functions (Post-Deployment)

To enable both real-time domain lookups and automatic daily checks, you need to deploy the Supabase Edge Functions. This is a crucial step for the app's core functionality.

Choose one of the following methods based on your comfort level.

---

### Method 1: Using the Supabase Dashboard (Recommended for Beginners)

This method uses the Supabase website interface and is perfect if you are not comfortable with command-line tools.

#### Step 1: Deploy the Edge Functions
You will deploy two functions: `get-whois` (for real-time checks) and `check-domains` (for daily cron jobs).

1.  Go to your project on the [Supabase Dashboard](https://app.supabase.com).
2.  In the left sidebar, click on the **Edge Functions** icon (a lightning bolt).
3.  **For `get-whois`:**
    *   Click **"Create a function"**. Name it `get-whois` and click **"Create function"**.
    *   You will be taken to an online code editor. **Delete** all the boilerplate code.
    *   **Paste** the complete code from the project's `supabase/functions/get-whois/index.ts` file into the editor.
    *   Click the **"Save and Deploy"** button.
4.  **For `check-domains`:**
    *   Click **"Create a function"**. Name it `check-domains` and click **"Create function"**.
    *   Delete the boilerplate code.
    *   **Paste** the complete code from the project's `supabase/functions/check-domains/index.ts` file into the editor.
    *   Click **"Save and Deploy"**.

> **Note:** For the functions to work, you may also need to create and paste the content of `supabase/functions/_shared/whois-logic.ts` if the online editor requires it, or use the CLI deployment method which handles shared files automatically.

#### Step 2: Set the Required Secrets
The functions need API keys and a cron secret to work. These are stored securely in your project's settings and are never exposed to the public.

1.  **Generate a Cron Secret:**
    *   Use an online password generator to create a strong, random string. Copy this secret value.

2.  **Add Secrets in Supabase:**
    *   In the Supabase Dashboard, go to **Settings** -> **Edge Functions**.
    *   Click **"+ Add new secret"** for each of the following. The names are case-sensitive and must not have the `VITE_` prefix.
        *   `CRON_SECRET`: Paste the secret string you generated.
        *   `WHOIS_API_KEY`: Your key from WhoisXMLAPI.
        *   `APILAYER_API_KEY`: Your key from apilayer.com.
        *   ... and so on for any other WHOIS API keys you have. Add at least one provider for the functions to work.

#### Step 3: Enable the Cron Extension
Before you can schedule jobs, you need to enable the `pg_cron` extension for your database. This only needs to be done once per project.

1.  In your Supabase project dashboard, go to the **Integrations** section.
2.  Find and enable **Cron**.

#### Step 4: Schedule the Cron Job for `check-domains`
Now you can schedule the `check-domains` job to run automatically.

1.  On the Cron integration page, navigate to the **"Jobs"** tab.
2.  Click **"Create job"**.
3.  Fill out the form:
    *   **Name**: `Daily Domain Check`.
    *   **Schedule**: Use the preset for "Run once a day" (`0 0 * * *`).
    *   **Type**: **Supabase Edge Function**.
    *   **Edge Function**: Choose `check-domains`.
    *   **HTTP Headers**:
        *   **Name**: `Authorization`.
        *   **Value**: `Bearer YOUR_CRON_SECRET` (replace with your actual secret).
4.  Click **"Create cron job"**.

---

### Method 2: Using the Supabase CLI (For Developers)

This method is faster if you are familiar with the command line.

#### 1. Install, Link, and Set Secrets

```bash
# Install the CLI
npm install supabase --save-dev

# Log in to your Supabase account
npx supabase login

# Link your local project to your remote Supabase project
npx supabase link --project-ref <your-project-ref>
```

##### Set Secrets for the Edge Functions
Run these commands in your terminal, replacing the placeholders.

```bash
# Required: Secret to authorize the cron job
npx supabase secrets set CRON_SECRET=YOUR_SUPER_SECRET_STRING_HERE

# Required: WHOIS API Keys (add at least one)
npx supabase secrets set WHOIS_API_KEY=YOUR_WHOISXMLAPI_KEY
npx supabase secrets set APILAYER_API_KEY=YOUR_APILAYER_KEY
npx supabase secrets set WHOISFREAKS_API_KEY=YOUR_WHOISFREAKS_KEY
npx supabase secrets set WHOAPI_COM_API_KEY=YOUR_WHOAPI_COM_KEY
npx supabase secrets set RAPIDAPI_KEY=YOUR_RAPIDAPI_KEY

# Optional: for a self-hosted who-dat instance
# npx supabase secrets set WHO_DAT_URL=https://your-who-dat-instance.vercel.app
# npx supabase secrets set WHO_DAT_AUTH_KEY=YOUR_WHO_DAT_SECRET_KEY
```

#### 2. Deploy the Edge Functions

Deploy both functions. The CLI automatically handles shared files.

```bash
npx supabase functions deploy get-whois
npx supabase functions deploy check-domains
```

After deploying, enable the Cron extension and schedule the job for `check-domains` using the Supabase Dashboard as described in **Steps 3 and 4** of Method 1.

---

## Supabase Configuration & Troubleshooting

(This section on troubleshooting common Supabase issues like login redirects and provider errors remains unchanged and can be found in the original `deployment.md`)
