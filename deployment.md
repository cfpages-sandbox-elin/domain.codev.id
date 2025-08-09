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

Choose one of the following methods based on your comfort level.

---

### Method 1: Using the Supabase Dashboard (Recommended for Beginners)

This method uses the Supabase website interface and is perfect if you are not comfortable with command-line tools.

#### Step 1: Get the Function Code

You'll need to copy the code for our `check-domains` function. Click the button below to expand the code, then copy all of it.

<details>
<summary>Click to show/hide the Edge Function code</summary>

```typescript
// Follow this guide to deploy and schedule this function:
// https://supabase.com/docs/guides/functions/cron-jobs

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

console.log('✅ "check-domains" function loaded');

//-------------------------------------------------
// Types
//-------------------------------------------------
type DomainTag = 'mine' | 'to-snatch';
type DomainStatus = 'available' | 'registered' | 'expired' | 'dropped' | 'unknown';

interface Domain {
  id: number;
  domain_name: string;
  status: DomainStatus;
  tag: DomainTag;
}

interface DomainUpdate {
  tag?: DomainTag;
  status?: DomainStatus;
  expiration_date?: string | null;
  registered_date?: string | null;
  registrar?: string | null;
  last_checked?: string | null;
}

interface WhoisData {
  status: DomainStatus;
  expirationDate: string | null;
  registeredDate: string | null;
  registrar: string | null;
}

//-------------------------------------------------
// WHOIS Provider Logic (self-contained)
//-------------------------------------------------
// @ts-ignore
const WHO_DAT_URL = Deno.env.get('VITE_WHO_DAT_URL');
// @ts-ignore
const WHO_DAT_AUTH_KEY = Deno.env.get('VITE_WHO_DAT_AUTH_KEY');
// @ts-ignore
const WHOISXMLAPI_KEY = Deno.env.get('VITE_WHOIS_API_KEY');
// @ts-ignore
const APILAYER_KEY = Deno.env.get('VITE_APILAYER_API_KEY');
// @ts-ignore
const WHOISFREAKS_KEY = Deno.env.get('VITE_WHOISFREAKS_API_KEY');
// @ts-ignore
const WHOAPI_COM_KEY = Deno.env.get('VITE_WHOAPI_COM_API_KEY');
// @ts-ignore
const RAPIDAPI_KEY = Deno.env.get('VITE_RAPIDAPI_KEY');


const getWhoisDataFromWhoDat = async (domainName: string): Promise<WhoisData> => {
    const headers = new Headers();
    if (WHO_DAT_AUTH_KEY) headers.append('Authorization', `Bearer ${WHO_DAT_AUTH_KEY}`);
    const response = await fetch(`${WHO_DAT_URL!}/${domainName}`, { headers });
    if (!response.ok) throw new Error(`who-dat failed: ${response.status}`);
    const data = await response.json();
    if (data.error) throw new Error(`who-dat error: ${data.error}`);
    const status = data.isAvailable ? 'available' : (new Date(data.dates?.expiry) < new Date() ? 'expired' : 'registered');
    return {
        status,
        expirationDate: data.dates?.expiry || null,
        registeredDate: data.dates?.created || null,
        registrar: data.registrar?.name || null,
    };
};

const getWhoisDataFromWhoisXmlApi = async (domainName: string): Promise<WhoisData> => {
    if (!WHOISXMLAPI_KEY) throw new Error("WhoisXMLAPI Key not provided.");
    const url = `https://www.whoisxmlapi.com/whoisserver/WhoisService?apiKey=${WHOISXMLAPI_KEY}&domainName=${domainName}&outputFormat=JSON&da=2`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`WhoisXMLAPI failed: ${response.status}`);
    const data = await response.json();
    if (data.ErrorMessage) throw new Error(`WhoisXMLAPI Error: ${data.ErrorMessage.msg}`);
    const record = data.WhoisRecord;
    if (!record) throw new Error('Invalid API response from WhoisXMLAPI');
    const expiryDateStr = record.registryData?.expiresDate || record.expiresDate;
    const status = record.domainAvailability === 'AVAILABLE' ? 'available' : (expiryDateStr && new Date(expiryDateStr) < new Date() ? 'expired' : 'registered');
    return {
        status,
        expirationDate: expiryDateStr || null,
        registeredDate: record.registryData?.createdDate || record.createdDate || null,
        registrar: record.registrarName || null,
    };
};

const APILAYER_SUPPORTED_TLDS = new Set(['com', 'me', 'net', 'org', 'sh', 'io', 'co', 'club', 'biz', 'mobi', 'info', 'us', 'domains', 'cloud', 'fr', 'au', 'ru', 'uk', 'nl', 'fi', 'br', 'hr', 'ee', 'ca', 'sk', 'se', 'no', 'cz', 'it', 'in', 'icu', 'top', 'xyz', 'cn', 'cf', 'hk', 'sg', 'pt', 'site', 'kz', 'si', 'ae', 'do', 'yoga', 'xxx', 'ws', 'work', 'wiki', 'watch', 'wtf', 'world', 'website', 'vip', 'ly', 'dev', 'network', 'company', 'page', 'rs', 'run', 'science', 'sex', 'shop', 'solutions', 'so', 'studio', 'style', 'tech', 'travel', 'vc', 'pub', 'pro', 'app', 'press', 'ooo', 'de']);

const getWhoisDataFromApiLayer = async (domainName: string): Promise<WhoisData> => {
    if (!APILAYER_KEY) throw new Error("apilayer.com Key not provided.");
    const tld = domainName.split('.').pop();
    if (!tld || !APILAYER_SUPPORTED_TLDS.has(tld)) {
        throw new Error(`TLD ".${tld}" is not supported by apilayer.com`);
    }
    const response = await fetch(`https://api.apilayer.com/whois/check?domain=${domainName}`, { headers: { 'apikey': APILAYER_KEY } });
    if (!response.ok) throw new Error(`apilayer.com failed: ${response.status}`);
    const data = await response.json();
    if (data.message || !data.result) throw new Error(`apilayer.com Error: ${data.message || 'Invalid response'}`);
    const { result } = data;
    const status = result.status === 'available' ? 'available' : (result.expiration_date && new Date(result.expiration_date) < new Date() ? 'expired' : 'registered');
    return {
        status,
        expirationDate: result.expiration_date || null,
        registeredDate: result.creation_date || null,
        registrar: result.registrar || null,
    };
}

const getWhoisDataFromWhoisFreaks = async (domainName: string): Promise<WhoisData> => {
    if (!WHOISFREAKS_KEY) throw new Error("WhoisFreaks Key not provided.");
    const url = `https://api.whoisfreaks.com/v1.0/whois?apiKey=${WHOISFREAKS_KEY}&whois=live&domainName=${domainName}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`WhoisFreaks failed: ${response.status}`);
    const data = await response.json();
    if (!data.status || data.error) throw new Error(`WhoisFreaks Error: ${data.error?.message || 'Request failed'}`);
    const status = data.domain_registered === 'no' ? 'available' : (data.expiry_date && new Date(data.expiry_date) < new Date() ? 'expired' : 'registered');
    return {
        status,
        expirationDate: data.expiry_date || null,
        registeredDate: data.create_date || null,
        registrar: data.domain_registrar?.registrar_name || null,
    };
};

const getWhoisDataFromWhoapi = async (domainName: string): Promise<WhoisData> => {
    if (!WHOAPI_COM_KEY) throw new Error("whoapi.com API Key not provided.");
    const url = `http://api.whoapi.com/?apikey=${WHOAPI_COM_KEY}&r=whois&domain=${domainName}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`whoapi.com failed: ${response.status}`);
    const data = await response.json();
    if (data.status !== '0') throw new Error(`whoapi.com Error: ${data.status_desc || `Status ${data.status}`}`);
    const expiryDateStr = data.date_expires;
    const status = !data.registered ? 'available' : (expiryDateStr && new Date(expiryDateStr) < new Date() ? 'expired' : 'registered');
    const registrarContact = data.contacts?.find((c: any) => c.type === 'registrar');
    const registrarName = registrarContact?.organization || data.whois_name || null;
    return {
        status,
        expirationDate: expiryDateStr || null,
        registeredDate: data.date_created || null,
        registrar: registrarName,
    };
};

const getWhoisDataFromRapidApi = async (domainName: string): Promise<WhoisData> => {
    if (!RAPIDAPI_KEY) throw new Error("RapidAPI Key not provided.");

    const url = `https://domain-whois-lookup-api.p.rapidapi.com/whois?domain_name=${domainName}`;
    const response = await fetch(url, {
        headers: {
            'x-rapidapi-key': RAPIDAPI_KEY,
            'x-rapidapi-host': 'domain-whois-lookup-api.p.rapidapi.com'
        }
    });
    
    const data = await response.json();

    if (!response.ok) {
        if (response.status === 404 && data.status === 'Available for registration') {
            return {
                status: 'available',
                expirationDate: null,
                registeredDate: null,
                registrar: null,
            };
        }
        throw new Error(`RapidAPI request failed with status ${response.status}: ${data.error || JSON.stringify(data)}`);
    }

    const expiryDateStr = data.expiration_date;
    const status = expiryDateStr && new Date(expiryDateStr) < new Date() ? 'expired' : 'registered';
    
    return {
        status,
        expirationDate: data.expiration_date || null,
        registeredDate: data.creation_date || null,
        registrar: data.registrar || null,
    };
};

const getWhoisData = async (domainName: string): Promise<WhoisData> => {
    if (WHO_DAT_URL) {
        try { return await getWhoisDataFromWhoDat(domainName); } catch (e) { console.error(e.message); }
    }
    if (WHOISXMLAPI_KEY) {
        try { return await getWhoisDataFromWhoisXmlApi(domainName); } catch (e) { console.error(e.message); }
    }
    if (APILAYER_KEY) {
        try { return await getWhoisDataFromApiLayer(domainName); } catch (e) { console.error(e.message); }
    }
    if (WHOISFREAKS_KEY) {
        try { return await getWhoisDataFromWhoisFreaks(domainName); } catch (e) { console.error(e.message); }
    }
    if (WHOAPI_COM_KEY) {
        try { return await getWhoisDataFromWhoapi(domainName); } catch (e) { console.error(e.message); }
    }
    if (RAPIDAPI_KEY) {
        try { return await getWhoisDataFromRapidApi(domainName); } catch (e) { console.error(e.message); }
    }
    console.error(`❌ All WHOIS providers failed for ${domainName}.`);
    return { status: 'unknown', expirationDate: null, registeredDate: null, registrar: 'Error' };
};


//-------------------------------------------------
// Main Server Logic
//-------------------------------------------------
serve(async (req) => {
  try {
    // Check for the cron secret from the Authorization header
    // @ts-ignore
    const cronSecret = Deno.env.get('CRON_SECRET');
    if (!cronSecret) {
      console.error('CRON_SECRET is not set in environment variables. Function cannot run securely.');
      return new Response('Configuration error: Cron secret not set.', { status: 500 });
    }
    
    const authHeader = req.headers.get('Authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
      console.warn('Unauthorized cron job access attempt.');
      return new Response('Unauthorized', { status: 401 });
    }
    
    console.log('✅ Cron job authorized.');

    // Create a Supabase client with the service_role key
    // @ts-ignore
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    // @ts-ignore
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Fetch domains that are registered and past their expiry date, or already marked as expired.
    const now = new Date().toISOString();
    const { data: domains, error: fetchError } = await supabaseAdmin
      .from('domains')
      .select('id, domain_name, status, tag')
      .or(`(status.eq.registered,expiration_date.lt.${now}),status.eq.expired`);
    
    if (fetchError) throw fetchError;

    if (!domains || domains.length === 0) {
      console.log('No domains require checking at this time.');
      return new Response(JSON.stringify({ message: 'No domains to check.' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      });
    }
    console.log(`Found ${domains.length} domains to check.`);

    // Process each domain
    const updatePromises = domains.map(async (domain: Domain) => {
      console.log(`➡️ Checking ${domain.domain_name}...`);
      const whoisData = await getWhoisData(domain.domain_name);

      if (whoisData.status === 'unknown') {
        console.log(`⚠️ WHOIS check failed for ${domain.domain_name}. Skipping update.`);
        return null; // Skip update if WHOIS fails
      }
      
      const newStatus = (domain.status === 'expired' && whoisData.status === 'available') 
        ? 'dropped' 
        : whoisData.status;

      const payload: DomainUpdate & { id: number } = {
        id: domain.id,
        status: newStatus,
        expiration_date: whoisData.expirationDate,
        registered_date: whoisData.registeredDate,
        registrar: whoisData.registrar,
        last_checked: new Date().toISOString(),
      };

      if ((newStatus === 'available' || newStatus === 'dropped') && domain.tag === 'mine') {
        payload.tag = 'to-snatch';
        console.log(`✅ Switching tag for ${domain.domain_name} to "to-snatch" as it is now available.`);
      }
      
      console.log(`✅ Update for ${domain.domain_name}: status -> ${newStatus}`);
      return payload;
    });

    const results = await Promise.all(updatePromises);
    const updatesToApply = results.filter(Boolean); // Filter out nulls

    // Batch update the domains in the database
    if (updatesToApply.length > 0) {
      console.log(`Applying ${updatesToApply.length} updates...`);
      const { error: updateError } = await supabaseAdmin
        .from('domains')
        .upsert(updatesToApply);

      if (updateError) throw updateError;
      console.log('✅ Batch update successful.');
    } else {
        console.log('No domains needed updates.');
    }

    return new Response(JSON.stringify({ message: `Checked ${domains.length} domains. Updated ${updatesToApply.length}.` }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (err) {
    console.error('An error occurred:', err.message);
    return new Response(String(err?.message ?? err), { status: 500 });
  }
});
```
</details>

#### Step 2: Create the Function in Supabase
1.  Go to your project on the [Supabase Dashboard](https://app.supabase.com).
2.  In the left sidebar, click on the **Edge Functions** icon (a lightning bolt).
3.  Click the **"Create a function"** button.
4.  A modal will pop up. Name the function `check-domains` and click **"Create function"**.
5.  You will be taken to an online code editor. **Delete** all the boilerplate code that is pre-filled in the editor.
6.  **Paste** the complete function code you copied from Step 1 into the editor.
7.  Click the **"Save and Deploy"** button at the top right. It may take a minute to deploy. You'll see a notification when it's successful.

#### Step 3: Set the Required Secrets
The function needs API keys to work. It also needs a secret key to prevent unauthorized execution. You'll set these in your project's settings.

1.  **Generate a Cron Secret:**
    *   First, you need a strong, random string. You can use an online password generator like [1Password's Generator](https://1password.com/password-generator/) to create a long, random string. Copy this secret value.
    *   This key will authorize scheduled jobs to run your function, protecting it from public access.

2.  **Add Secrets in Supabase:**
    *   In the Supabase Dashboard, go to **Settings** (the gear icon in the left sidebar).
    *   Click on **Edge Functions**.
    *   Click the **"+ Add new secret"** button.
    *   You will now add each secret one by one. The name is case-sensitive.
        *   **Name:** `CRON_SECRET`, **Value:** Paste the secret string you generated.
        *   **Name:** `VITE_WHOIS_API_KEY`, **Value:** Your key from WhoisXMLAPI.
        *   **Name:** `VITE_APILAYER_API_KEY`, **Value:** Your key from apilayer.com.
        *   ... and so on for any other WHOIS API keys you have.

    > **Important:** You only need to add secrets for the WHOIS services you plan to use. However, you **must** add the `CRON_SECRET`.

#### Step 4: Schedule the Function
Now you'll set up a "Cron Job" to run your function automatically every day.

1.  Go back to **Edge Functions** in the left sidebar.
2.  Click on the `check-domains` function you just created.
3.  In the function's details page, find the **"Invoke on a schedule"** section.
4.  Enter a **Name** for your job, like `Daily Domain Check`.
5.  In the **"Cron schedule"** input, you can choose a preset. Select **"Run once a day"**. This will automatically fill in the expression `0 0 * * *`, which means it will run at midnight UTC.
6.  Click **Create schedule**.

That's it! Your application is now fully configured to automatically monitor your domains every day, all without using the command line.

---

### Method 2: Using the Supabase CLI (For Developers)

This method is faster if you are familiar with the command line. It uses the Supabase CLI to deploy the function and set secrets from your local machine.

#### 1. Install, Link, and Set Secrets

First, install the Supabase CLI, link it to your project, and set the required secrets. This requires [Node.js](https://nodejs.org/) (version 18 or newer) to be installed.

```bash
# Install the CLI
npm install supabase --save-dev

# Log in to your Supabase account
npx supabase login

# Link your local project to your remote Supabase project
npx supabase link --project-ref <your-project-ref>
```

##### Set Secrets for the Edge Function
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
    npx supabase secrets set VITE_RAPIDAPI_KEY=YOUR_RAPIDAPI_KEY

    # Optional: Set these if you are using a self-hosted who-dat instance
    # npx supabase secrets set VITE_WHO_DAT_URL=https://your-who-dat-instance.vercel.app
    # npx supabase secrets set VITE_WHO_DAT_AUTH_KEY=YOUR_WHO_DAT_SECRET_KEY
    ```

#### 2. Deploy the Edge Function

Deploy the `check-domains` function included in this project.

```bash
npx supabase functions deploy check-domains
```

After deploying, you can schedule the job using the Supabase Dashboard as described in **Step 4** of Method 1, or use an external cron service like [fastcron.com](https://fastcron.com/).

---

## Supabase Configuration & Troubleshooting

(This section on troubleshooting common Supabase issues like login redirects and provider errors remains unchanged and can be found in the original `deployment.md`)