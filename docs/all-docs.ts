// This file centralizes the content of all markdown documentation files.
// This approach is used because we cannot directly read from the filesystem
// in a standard Vite/React web application build.

export interface DocContent {
    slug: string;
    title: string;
    content: string;
}

const functionCode = `
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
    if (WHO_DAT_AUTH_KEY) headers.append('Authorization', \`Bearer \${WHO_DAT_AUTH_KEY}\`);
    const response = await fetch(\`\${WHO_DAT_URL!}/\${domainName}\`, { headers });
    if (!response.ok) throw new Error(\`who-dat failed: \${response.status}\`);
    const data = await response.json();
    if (data.error) throw new Error(\`who-dat error: \${data.error}\`);
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
    const url = \`https://www.whoisxmlapi.com/whoisserver/WhoisService?apiKey=\${WHOISXMLAPI_KEY}&domainName=\${domainName}&outputFormat=JSON&da=2\`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(\`WhoisXMLAPI failed: \${response.status}\`);
    const data = await response.json();
    if (data.ErrorMessage) throw new Error(\`WhoisXMLAPI Error: \${data.ErrorMessage.msg}\`);
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
        throw new Error(\`TLD ".\${tld}" is not supported by apilayer.com\`);
    }
    const response = await fetch(\`https://api.apilayer.com/whois/check?domain=\${domainName}\`, { headers: { 'apikey': APILAYER_KEY } });
    if (!response.ok) throw new Error(\`apilayer.com failed: \${response.status}\`);
    const data = await response.json();
    if (data.message || !data.result) throw new Error(\`apilayer.com Error: \${data.message || 'Invalid response'}\`);
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
    const url = \`https://api.whoisfreaks.com/v1.0/whois?apiKey=\${WHOISFREAKS_KEY}&whois=live&domainName=\${domainName}\`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(\`WhoisFreaks failed: \${response.status}\`);
    const data = await response.json();
    if (!data.status || data.error) throw new Error(\`WhoisFreaks Error: \${data.error?.message || 'Request failed'}\`);
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
    const url = \`http://api.whoapi.com/?apikey=\${WHOAPI_COM_KEY}&r=whois&domain=\${domainName}\`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(\`whoapi.com failed: \${response.status}\`);
    const data = await response.json();
    if (data.status !== '0') throw new Error(\`whoapi.com Error: \${data.status_desc || \`Status \${data.status}\`}\`);
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

    const url = \`https://domain-whois-lookup-api.p.rapidapi.com/whois?domain_name=\${domainName}\`;
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
        throw new Error(\`RapidAPI request failed with status \${response.status}: \${data.error || JSON.stringify(data)}\`);
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
    console.error(\`❌ All WHOIS providers failed for \${domainName}.\`);
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
    if (authHeader !== \`Bearer \${cronSecret}\`) {
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
      .or(\`(status.eq.registered,expiration_date.lt.\${now}),status.eq.expired\`);
    
    if (fetchError) throw fetchError;

    if (!domains || domains.length === 0) {
      console.log('No domains require checking at this time.');
      return new Response(JSON.stringify({ message: 'No domains to check.' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      });
    }
    console.log(\`Found \${domains.length} domains to check.\`);

    // Process each domain
    const updatePromises = domains.map(async (domain: Domain) => {
      console.log(\`➡️ Checking \${domain.domain_name}...\`);
      const whoisData = await getWhoisData(domain.domain_name);

      if (whoisData.status === 'unknown') {
        console.log(\`⚠️ WHOIS check failed for \${domain.domain_name}. Skipping update.\`);
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
        console.log(\`✅ Switching tag for \${domain.domain_name} to "to-snatch" as it is now available.\`);
      }
      
      console.log(\`✅ Update for \${domain.domain_name}: status -> \${newStatus}\`);
      return payload;
    });

    const results = await Promise.all(updatePromises);
    const updatesToApply = results.filter(Boolean); // Filter out nulls

    // Batch update the domains in the database
    if (updatesToApply.length > 0) {
      console.log(\`Applying \${updatesToApply.length} updates...\`);
      const { error: updateError } = await supabaseAdmin
        .from('domains')
        .upsert(updatesToApply);

      if (updateError) throw updateError;
      console.log('✅ Batch update successful.');
    } else {
        console.log('No domains needed updates.');
    }

    return new Response(JSON.stringify({ message: \`Checked \${domains.length} domains. Updated \${updatesToApply.length}.\` }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (err) {
    console.error('An error occurred:', err.message);
    return new Response(String(err?.message ?? err), { status: 500 });
  }
});
`;

const setupChecksContent = `
## Setting Up Automated Domain Checks

To enable automatic daily checks, you need to deploy and schedule the \`check-domains\` Supabase Edge Function. This is a crucial step for the app's core functionality.

Choose one of the following methods based on your comfort level.

---

### Method 1: Using the Supabase Dashboard (Recommended for Beginners)

This method uses the Supabase website interface and is perfect if you are not comfortable with command-line tools.

#### Step 1: Get the Function Code

You'll need to copy the code for our \`check-domains\` function. Click the button below to expand the code, then copy all of it.

<details>
<summary>Click to show/hide the Edge Function code</summary>

\`\`\`typescript
${functionCode}
\`\`\`
</details>

#### Step 2: Create the Function in Supabase
1.  Go to your project on the [Supabase Dashboard](https://app.supabase.com).
2.  In the left sidebar, click on the **Edge Functions** icon (a lightning bolt).
3.  Click the **"Create a function"** button.
4.  A modal will pop up. Name the function \`check-domains\` and click **"Create function"**.
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
        *   **Name:** \`CRON_SECRET\`, **Value:** Paste the secret string you generated.
        *   **Name:** \`VITE_WHOIS_API_KEY\`, **Value:** Your key from WhoisXMLAPI.
        *   **Name:** \`VITE_APILAYER_API_KEY\`, **Value:** Your key from apilayer.com.
        *   ... and so on for any other WHOIS API keys you have.

    > **Important:** You only need to add secrets for the WHOIS services you plan to use. However, you **must** add the \`CRON_SECRET\`.

#### Step 4: Enable the Cron Extension
Before you can schedule jobs, you need to enable the \`pg_cron\` extension for your database.

1.  In your Supabase project dashboard, go to the **Integrations** section (the puzzle piece icon in the left sidebar).
2.  Find **Cron** in the list of integrations (you can use the search bar).
3.  Click on the **Cron** integration.
4.  You'll be taken to the integration's page. Click the green **"Enable pg_cron"** button. This only needs to be done once per project.

#### Step 5: Schedule the Cron Job
Now you can schedule the job to run automatically.

1.  On the Cron integration page, navigate to the **"Jobs"** tab.
2.  Click the green **"Create job"** button on the right.
3.  A "Create a new cron job" panel will appear. Fill it out as follows:
    *   **Name**: Give your job a descriptive name, like \`Daily Domain Check\`.
    *   **Schedule**: Use the "Run once a day" preset, which will fill in \`0 0 * * *\`. This means the job runs at midnight UTC every day.
    *   **Type**: Select **Supabase Edge Function**.
    *   **Edge Function**: Choose \`check-domains\` from the dropdown list.
    *   **Method**: Leave this set to \`POST\`.
    *   **HTTP Headers**: This part is critical for security.
        *   Click **"+ Add a new header"**.
        *   For the header **Name**, enter \`Authorization\`.
        *   For the header **Value**, enter \`Bearer YOUR_CRON_SECRET\`. **Important**: Replace \`YOUR_CRON_SECRET\` with the actual secret string you generated and saved in Step 3.
    *   **HTTP Request Body**: You can leave this empty.
4.  Review your settings, then click the green **"Create cron job"** button at the bottom to save and activate the schedule.

That's it! Your application is now fully configured to automatically monitor your domains every day.

---

### Method 2: Using the Supabase CLI (For Developers)

This method is faster if you are familiar with the command line. It uses the Supabase CLI to deploy the function and set secrets from your local machine.

#### 1. Install, Link, and Set Secrets

First, install the Supabase CLI, link it to your project, and set the required secrets. This requires [Node.js](https://nodejs.org/) (version 18 or newer) to be installed.

\`\`\`bash
# Install the CLI
npm install supabase --save-dev

# Log in to your Supabase account
npx supabase login

# Link your local project to your remote Supabase project
npx supabase link --project-ref <your-project-ref>
\`\`\`

##### Set Secrets for the Edge Function
The Edge Function needs API keys to work. It also needs a secret key to prevent unauthorized execution.

1.  **Create a Cron Secret:** Generate a strong, random string (e.g., using a password generator). This key will authorize the cron job service to run your function, protecting it from public access.

2.  **Set the Secrets:** Run these commands in your terminal, replacing the placeholders with your actual keys and the secret you just generated.

    \`\`\`bash
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
    \`\`\`

#### 2. Deploy the Edge Function

Deploy the \`check-domains\` function included in this project.

\`\`\`bash
npx supabase functions deploy check-domains
\`\`\`

After deploying, enable the Cron extension and schedule the job using the Supabase Dashboard as described in **Steps 4 and 5** of Method 1.
`;


const readmeContent = `
# Domain Codev

An aesthetically pleasing app to check domain availability and track domain expiration dates. It helps you renew your domains on time or snatch up expiring ones as soon as they drop, with all your data securely stored in your personal account.

![Domain Codev Screenshot](https://picsum.photos/1200/600)

## Features

*   **Secure User Accounts:** Sign in with your Google account to keep your domain list private and synced.
*   **Resilient Real-Time Domain Check:** Quickly see if a domain is available using a tiered approach with multiple fallbacks including WhoisXMLAPI, apilayer.com, whoisfreaks.com, whoapi.com, and rapidapi.com.
*   **Automated Daily Checks:** A secure, server-side Supabase Edge Function runs daily to automatically update the status of your tracked domains, checking for expirations and drops.
*   **Manual Re-check:** For any domain where the lookup failed, a simple "Re-check" button allows you to instantly try again.
*   **Direct Purchase Links:** For available domains, get quick links to recommended registrars to purchase the domain immediately.
*   **Advanced Expiration Alerts:** Get multi-level, color-coded visual alerts for domains expiring within 90, 30, and 7 days, plus a critical alert for already expired domains.
*   **Track Your Portfolio:** Add domains to a personal tracking list.
*   **Smart Tagging & Keyboard Shortcuts:** Tag domains as "Mine" or "To Snatch". Add them even faster using \`Enter\` (for Mine) and \`Shift+Enter\` (for To Snatch).
*   **Advanced Filtering:** Filter your list by tag, status, or urgency, including a dedicated "Available" filter.
*   **Drop-Catching Helper:** For expired domains, get an estimated timeline for when they might become available.
*   **Light/Dark Mode:** Beautifully designed interface that's easy on the eyes.
*   **Cloud Data Persistence:** Your list is securely saved to your Supabase account, accessible from anywhere.

## Tech Stack

*   **Vite** + **React 18** & **TypeScript**
*   **Tailwind CSS** for styling
*   **Supabase** for Authentication, Database, and Edge Functions
*   **Cron Job Schedulers**: Supabase Cron or external services (e.g., fastcron.com)
*   **\`who-dat\`** (self-hosted), **WhoisXMLAPI**, **apilayer.com API**, **whoisfreaks.com API**, **whoapi.com API**, & **rapidapi.com API** for live domain data

---

## Getting Started: Local Development

Follow these steps to set up and run the project on your local machine.

### Step 1: Clone the Repository

\`\`\`bash
git clone <repository-url>
cd <repository-directory>
\`\`\`

### Step 2: Install Dependencies

You need to have [Node.js](https://nodejs.org/) (version 18 or newer) installed.

\`\`\`bash
npm install
\`\`\`

### Step 3: Configure Environment Variables

1.  Create a new file named \`.env\` in the root of the project.
2.  Add the required variables for Supabase and the WHOIS APIs. You will need to get these keys from their respective services.

    \`\`\`env
    # Supabase Credentials (Required)
    VITE_SUPABASE_URL=YOUR_SUPABASE_PROJECT_URL
    VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY

    # WHOIS API Keys (Add at least one provider for full functionality)
    VITE_WHOIS_API_KEY=YOUR_WHOISXMLAPI_KEY
    VITE_APILAYER_API_KEY=YOUR_APILAYER_KEY
    VITE_WHOISFREAKS_API_KEY=YOUR_WHOISFREAKS_KEY
    VITE_WHOAPI_COM_API_KEY=YOUR_WHOAPI_COM_KEY
    VITE_RAPIDAPI_KEY=YOUR_RAPIDAPI_KEY
    
    # Optional: Self-hosted who-dat instance for WHOIS lookups
    # The public instance is not recommended due to rate limits and CORS issues.
    # See /docs/who-dat.md for deployment instructions.
    # VITE_WHO_DAT_URL=https://your-who-dat-instance.vercel.app
    # VITE_WHO_DAT_AUTH_KEY=YOUR_WHO_DAT_SECRET_KEY
    \`\`\`

    **Note:** The \`VITE_\` prefix is required for Vite to expose these variables to the application.

### Step 4: Set Up the Database Table
(Instructions for this step are unchanged and can be found in the original \`README.md\`)
\`\`\`sql
-- Create custom types for cleaner constraints
CREATE TYPE public.domain_tag_type AS ENUM ('mine', 'to-snatch');
CREATE TYPE public.domain_status_type AS ENUM ('available', 'registered', 'expired', 'dropped', 'unknown');

-- Create the 'domains' table
CREATE TABLE public.domains (
    id bigint NOT NULL GENERATED BY DEFAULT AS IDENTITY,
    user_id uuid NOT NULL DEFAULT auth.uid(),
    domain_name text NOT NULL,
    tag public.domain_tag_type NOT NULL,
    status public.domain_status_type NOT NULL,
    expiration_date timestamptz NULL,
    registered_date timestamptz NULL,
    registrar text NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    last_checked timestamptz NULL,
    CONSTRAINT domains_pkey PRIMARY KEY (id),
    CONSTRAINT domains_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE,
    CONSTRAINT domains_user_id_domain_name_key UNIQUE (user_id, domain_name)
);

-- Add comments to columns for clarity in the Supabase UI
COMMENT ON TABLE public.domains IS 'Stores domains tracked by users.';
COMMENT ON COLUMN public.domains.id IS 'Primary key for the domain entry.';
COMMENT ON COLUMN public.domains.user_id IS 'Foreign key linking to the user who owns this entry.';
COMMENT ON COLUMN public.domains.domain_name IS 'The domain name being tracked.';
COMMENT ON COLUMN public.domains.tag IS 'User-defined tag: "mine" or "to-snatch".';
COMMENT ON COLUMN public.domains.status IS 'Current status of the domain.';
COMMENT ON COLUMN public.domains.expiration_date IS 'The expiration date of the domain.';
COMMENT ON COLUMN public.domains.registered_date IS 'The registration date of the domain.';
COMMENT ON COLUMN public.domains.registrar IS 'The registrar of the domain.';
COMMENT ON COLUMN public.domains.last_checked IS 'Timestamp of the last successful WHOIS check.';
COMMENT ON COLUMN public.domains.created_at IS 'Timestamp when the domain was added to the tracker.';

-- Enable Row Level Security (RLS) for the table
ALTER TABLE public.domains ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- 1. Users can see their own domains
CREATE POLICY "Allow users to view their own domains"
ON public.domains
FOR SELECT
USING (auth.uid() = user_id);

-- 2. Users can insert new domains for themselves
CREATE POLICY "Allow users to insert their own domains"
ON public.domains
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- 3. Users can update their own domains
CREATE POLICY "Allow users to update their own domains"
ON public.domains
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 4. Users can delete their own domains
CREATE POLICY "Allow users to delete their own domains"
ON public.domains
FOR DELETE
USING (auth.uid() = user_id);
\`\`\`

### Step 5: Run the Development Server

\`\`\`bash
npm run dev
\`\`\`

---
${setupChecksContent}
`;

const deploymentContent = `
# Deployment Guide: Domain Codev on Cloudflare Pages

This guide provides step-by-step instructions for deploying the Domain Codev application to Cloudflare Pages.

## Prerequisites

1.  A Cloudflare account.
2.  A GitHub account with the application code pushed to a repository.
3.  All required API keys and Supabase credentials (see the main \`README.md\` for setup context).

## Deployment Steps

(Steps 1-5 for deploying the frontend application remain unchanged and can be found in the original \`deployment.md\`)

### Step 1: Push Your Code to GitHub
### Step 2: Create a Cloudflare Pages Project
### Step 3: Configure Build Settings
### Step 4: Add Environment Variables
### Step 5: Deploy the Application

---

## Setting Up Automated Domain Checks (Post-Deployment)
${setupChecksContent}

---

## Supabase Configuration & Troubleshooting

(This section on troubleshooting common Supabase issues like login redirects and provider errors remains unchanged and can be found in the original \`deployment.md\`)
`;

const whoDatContent = `
# \`who-dat\` Free & Open Source WHOIS Service

This document summarizes the key details for integrating \`who-dat\`, a free and open-source WHOIS lookup service. It's an excellent primary WHOIS provider as it can be self-hosted for free.

<div style="background-color: #fffbe6; border-left: 4px solid #facc15; padding: 1rem; margin-bottom: 1rem;">
  <p style="font-weight: bold; color: #713f12;">Important Notice</p>
  <p style="color: #713f12;">
    The public instance at <code>https://who-dat.as93.net</code> is **not recommended for production use**. It is frequently rate-limited and does not send the necessary CORS headers, which will cause requests from a web application to fail. For reliable WHOIS lookups, you **must** self-host your own instance of <code>who-dat</code>.
  </p>
</div>

## Overview

\`who-dat\` provides a simple, no-CORS, no-auth (by default) API for fetching WHOIS records.

-   **Public API Base URL**: \`https://who-dat.as93.net\` (For testing only, not for app integration)
-   **Self-Hosted URL**: Your own custom domain (e.g., from a Vercel deployment). **This is the recommended approach.**

## Endpoints

-   **Single Domain Lookup**: \`/[domain]\`
    -   Example: \`https://your-own-instance.com/example.com\`
-   **Multiple Domain Lookup**: \`/multi\`
-   **API Specification**: A full OpenAPI/Swagger spec is available at the root of the deployed instance for interactive testing.

## Authentication (Optional)

Authentication is optional and can be enabled by setting the \`AUTH_KEY\` environment variable in your hosting environment (e.g., Vercel).

-   If \`AUTH_KEY\` is set, requests must include it in the \`Authorization\` header.
-   **Supported Formats**:
    -   \`Authorization: your-secret-key\`
    -   \`Authorization: Bearer your-secret-key\`
-   If \`AUTH_KEY\` is not set, the API remains public.

## Deployment (Recommended)

Self-hosting is the recommended approach for stability and privacy.

-   **Option 1: Vercel (Easiest)**
    1.  Fork the [official repository](https://github.com/Lissy93/who-dat).
    2.  Import the forked repository into your Vercel account.
    3.  Vercel will automatically deploy it. No configuration is needed for a basic setup.
    4.  Use the **1-Click Deploy Button** on the GitHub page for an even faster setup.

-   **Option 2: Docker**
    -   A pre-built Docker image is available on DockerHub and GHCR.
    -   Run the container with: \`docker run -p 8080:8080 lissy93/who-dat\`

## Response Data

The API returns a JSON object with WHOIS information. Key fields include:

-   \`domainName\`: The queried domain.
-   \`isAvailable\`: A boolean indicating if the domain can be registered.
-   \`dates\`: An object containing...
    -   \`created\`: The registration date (ISO 8601 format).
    -   \`expiry\`: The expiration date (ISO 8601 format).
-   \`registrar\`: An object containing...
    -   \`name\`: The name of the registrar.
-   \`error\`: An error message if the lookup failed.
`;

const whoisXmlApiContent = `
# WhoisXMLAPI.com WHOIS Service Documentation

This document summarizes the key details for integrating the WhoisXMLAPI.com WHOIS Web Service.

## Overview

The service provides WHOIS registration data for domain names, IP addresses, and email addresses via a RESTful API.

-   **Endpoint**: \`https://www.whoisxmlapi.com/whoisserver/WhoisService\`
-   **Methods**: Supports \`GET\` (with query parameters) and \`POST\` (with a JSON body).
-   **Response Formats**: \`JSON\` or \`XML\`.

## Authentication

Authentication is required for every request.

-   **Method 1 (Recommended): Query Parameter**
    -   Add \`apiKey=YOUR_API_KEY\` to the request URL.
    -   Example: \`.../WhoisService?apiKey=at_xxx&domainName=google.com\`

-   **Method 2: Authorization Header**
    -   Use the \`Authorization\` header with a Bearer token.
    -   Format: \`Authorization: Bearer YOUR_API_KEY\`

> The \`apiKey\` query parameter has higher priority and will be used if both methods are present.

## Key Request Parameters

### Required

-   \`domainName\` (string): The domain name, IP address, or email to look up.

### Important Optional Parameters

-   \`outputFormat\` (string): The desired response format.
    -   **Value**: \`JSON\` (Recommended for web apps)
    -   **Default**: \`XML\`
-   \`da\` (integer): Checks domain availability.
    -   **Value**: \`2\` (Slower but more accurate check)
    -   **Default**: \`0\`
    -   The result is in the \`WhoisRecord.domainAvailability\` field (\`AVAILABLE\` or \`UNAVAILABLE\`).
-   \`_hardRefresh\` (integer): Forces a real-time lookup, bypassing the cache.
    -   **Value**: \`1\`
    -   **Note**: This costs 5 API credits per call. Use sparingly.
    -   **Default**: \`0\`

## Example Request (GET)

To get an accurate availability check for \`example.com\` in JSON format:

\`\`\`
https://www.whoisxmlapi.com/whoisserver/WhoisService?apiKey=YOUR_API_KEY&domainName=example.com&outputFormat=JSON&da=2
\`\`\`

## Response Data

When requesting JSON, the response contains a \`WhoisRecord\` object. Key fields to look for include:

-   \`WhoisRecord.domainName\`: The domain that was queried.
-   \`WhoisRecord.domainAvailability\`: \`AVAILABLE\` or \`UNAVAILABLE\`.
-   \`WhoisRecord.registryData.createdDate\`: Registration date (ISO 8601 format).
-   \`WhoisRecord.registryData.expiresDate\`: Expiration date (ISO 8601 format).
-   \`WhoisRecord.registrarName\`: The name of the registrar (e.g., "GoDaddy.com, LLC").
-   \`ErrorMessage\`: If an error occurs (e.g., invalid domain), this object will be present.
`;

const apiLayerContent = `
# apilayer.com Whois API Documentation

This document summarizes the key details for integrating the apilayer.com Whois API.

## Overview

The service provides WHOIS data for domain names via a RESTful API.

-   **Endpoint**: \`https://api.apilayer.com/whois/check\`
-   **Method**: \`GET\`
-   **Response Format**: \`JSON\`

## Authentication

Authentication is required for every request and is handled via a custom HTTP header.

-   **Header Name**: \`apikey\`
-   **Usage**: All requests must include the header \`apikey: YOUR_API_KEY\`.
-   **Security**: API keys must be kept secure and should not be exposed in client-side code. Use environment variables on the server or build environment.

## Request Parameters

-   \`domain\` (string, **required**): The domain name to look up. This is passed as a query string parameter.

## Example Request (cURL)

\`\`\`bash
curl --location --request GET 'https://api.apilayer.com/whois/check?domain=example.com' \\
--header 'apikey: YOUR_API_KEY'
\`\`\`

## Rate Limiting

-   Each subscription plan has daily and monthly rate limits.
-   When a limit is reached, the API will respond with an \`HTTP 429 Too Many Requests\` status code.
-   The response body for a rate-limited request will be:
    \`\`\`json
    {
        "message": "You have exceeded your daily/monthly API rate limit..."
    }
    \`\`\`
-   You can programmatically check your remaining limits via the following response headers sent with every successful request:
    -   \`x-ratelimit-limit-month\`: Your monthly request quota.
    -   \`x-ratelimit-remaining-month\`: Requests remaining this month.
    -   \`x-ratelimit-limit-day\`: Your daily request quota.
    -   \`x-ratelimit-remaining-day\`: Requests remaining today.

## Error Codes

The API uses standard HTTP status codes to indicate success or failure. A non-200 response indicates an error, and the JSON body will contain a \`message\` field with details.

-   **\`400 - Bad Request\`**: A required parameter (like \`domain\`) is missing or invalid.
-   **\`401 - Unauthorized\`**: The provided \`apikey\` is missing or invalid.
-   **\`404 - Not Found\`**: The requested resource does not exist.
-   **\`429 - Too many requests\`**: You have exceeded your API rate limit.
-   **\`5xx - Server Error\`**: An error occurred on apilayer's servers.
`;

const whoisFreaksContent = `
# WhoisFreaks.com WHOIS API Documentation

This document summarizes the key details for integrating the WhoisFreaks.com live WHOIS API.

## Overview

The service provides real-time ("live") WHOIS data for a given domain name via a RESTful API.

-   **Endpoint**: \`https://api.whoisfreaks.com/v1.0/whois\`
-   **Method**: \`GET\`
-   **Response Formats**: \`JSON\` (default) or \`XML\`.

## Authentication

Authentication is required for every request and is handled via a query parameter.

-   **Parameter Name**: \`apiKey\`
-   **Usage**: All requests must include \`apiKey=YOUR_API_KEY\` in the URL's query string.
-   **Security**: You can reset your API key from the billing dashboard if it is ever compromised.

## Key Request Parameters

### Required

-   \`apiKey\` (string): Your personal API key from the WhoisFreaks dashboard.
-   \`whois\` (string): Must be set to the value \`live\` for real-time lookups.
-   \`domainName\` (string): The domain name you want to query.

### Optional

-   \`format\` (string): The desired response format.
    -   **Values**: \`JSON\` | \`XML\`
    -   **Default**: \`JSON\`

## Example Request (GET)

To get live WHOIS data for \`whoisfreaks.com\` in the default JSON format:

\`\`\`
https://api.whoisfreaks.com/v1.0/whois?apiKey=YOUR_API_KEY&whois=live&domainName=whoisfreaks.com
\`\`\`

## Response Data

A successful response (HTTP 200) returns a JSON object. Key fields to look for include:

-   \`status\`: \`true\` on success.
-   \`domain_name\`: The domain that was queried.
-   \`domain_registered\`: \`"yes"\` or \`"no"\`.
-   \`create_date\`: Registration date (e.g., "2019-03-19").
-   \`expiry_date\`: Expiration date (e.g., "2025-03-19").
-   \`domain_registrar\`: An object containing...
    -   \`registrar_name\`: The name of the registrar (e.g., "NAMECHEAP INC").
-   \`error\`: If the \`status\` is \`false\`, this object may contain an error message.

## Error Handling

The API uses standard HTTP status codes to indicate issues. For example:

-   **\`400\`**: Invalid domain name.
-   **\`401\`**: Invalid or inactive API key, or insufficient credits.
-   **\`408\`**: Unable to fetch WHOIS data for the domain.
-   **\`429\`**: Maximum request limit reached.
`;

const whoapiContent = `
# WhoAPI.com WHOIS Service Documentation

This document summarizes the key details for integrating the WhoAPI.com WHOIS service.

## Overview

The service provides parsed WHOIS registration data for domain names programmatically.

-   **Endpoint**: \`http://api.whoapi.com/\`
-   **Method**: \`GET\`
-   **Response Format**: \`JSON\` (default) or \`XML\`.

## Authentication

Authentication is required for every request and is handled via a query parameter.

-   **Parameter Name**: \`apikey\`
-   **Usage**: All requests must include \`apikey=YOUR_API_KEY\` in the URL's query string.

## Key Request Parameters

### Required

-   \`apikey\` (string): Your personal API key from the WhoAPI dashboard.
-   \`r\` (string): Must be set to the value \`whois\` for a parsed WHOIS lookup.
-   \`domain\` (string): The domain name you want to query.

## Example Request (GET)

To get parsed WHOIS data for \`example.com\` in JSON format:

\`\`\`
http://api.whoapi.com/?domain=example.com&r=whois&apikey=YOUR_API_KEY
\`\`\`

## Response Data

A successful response (\`status: "0"\`) returns a JSON object. Key fields to look for include:

-   \`status\`: A string code. \`"0"\` indicates success.
-   \`registered\`: A boolean (\`true\` or \`false\`) indicating if the domain is registered.
-   \`date_created\`: Registration date (e.g., "2011-02-14 15:31:26").
-   \`date_expires\`: Expiration date (e.g., "2021-02-14 15:31:26").
-   \`whois_name\`: The name of the registrar (e.g., "PublicDomainRegistry").
-   \`contacts\`: An array of contact objects. The registrar's full name can often be found in the contact object where \`type\` is \`"registrar"\`.
-   \`requests_available\`: Your remaining API request quota.

## Error Handling

If a request fails, the \`status\` field will contain a non-zero value, and \`status_desc\` will provide a human-readable error message.
`;

const rapidApiContent = `
# RapidAPI Domain WHOIS Lookup API Documentation

This document summarizes the key details for integrating the RapidAPI Domain WHOIS Lookup API.

## Overview

The service provides WHOIS data for any registered domain name via a RESTful API.

-   **Endpoint**: \`https://domain-whois-lookup-api.p.rapidapi.com/whois\`
-   **Method**: \`GET\`
-   **Response Format**: \`JSON\`

## Authentication

Authentication is required for every request and is handled via custom HTTP headers.

-   **Host Header**: \`x-rapidapi-host: domain-whois-lookup-api.p.rapidapi.com\`
-   **API Key Header**: \`x-rapidapi-key: YOUR_RAPIDAPI_KEY\`

You must subscribe to the API on the [RapidAPI Marketplace](https://rapidapi.com/is-this-thing-on/api/domain-whois-lookup-api) to get your key.

## Request Parameters

-   \`domain_name\` (string, **required**): The domain name to look up, passed as a query string parameter.

## Example Request (cURL)

\`\`\`bash
curl --request GET \\
	--url 'https://domain-whois-lookup-api.p.rapidapi.com/whois?domain_name=example.com' \\
	--header 'x-rapidapi-host: domain-whois-lookup-api.p.rapidapi.com' \\
	--header 'x-rapidapi-key: YOUR_RAPIDAPI_KEY'
\`\`\`

## Response Data

A successful response returns a JSON object with the following key fields:

-   \`name\`: The name of the domain.
-   \`creation_date\`: The date when the domain was first registered (ISO 8601 format).
-   \`expiration_date\`: The date when the domain registration will expire (ISO 8601 format).
-   \`registrar\`: The name of the domain registrar.
-   \`registrant\`: The name of the domain registrant.
-   \`email\`: The email address of the domain registrant.

## Error Handling

The API uses standard HTTP status codes.

-   **\`400 - Bad Request\`**: An invalid domain name was provided. The response body will contain an error message.
    \`\`\`json
    { "error": "Invalid domain name" }
    \`\`\`
-   **\`404 - Not Found\`**: The domain is not found, which indicates it is available for registration. The response body will be:
    \`\`\`json
    { "status": "Available for registration" }
    \`\`\`

## Rate Limiting

-   The API limits requests to 1000 requests per day per IP address on the free (BASIC) plan.
`;


const troubleshootingContent = `
# Troubleshooting Guide

This document covers common issues and their solutions when working with this project.

## Issue: Supabase TypeScript errors like "Property 'Insert' does not exist" or "Type instantiation is excessively deep"

You might encounter TypeScript errors in \`src/services/supabaseService.ts\` when using the Supabase client, with messages like:

\`\`\`
src/services/supabaseService.ts(55,68): error TS2339: Property 'Insert' does not exist on type '{ Row: Domain; }'.
\`\`\`
or a more cryptic error like:
\`\`\`
Type instantiation is excessively deep and possibly infinite.
\`\`\`

### The Problem: Incomplete \`Database\` Type Definition

Both of these errors stem from the same root cause: an incomplete or incorrect type definition for the \`Database\` interface that is passed to the Supabase client (\`createClient<Database>\`).

The Supabase client relies on this interface to provide strong type safety for all database operations. For this to work, the interface must accurately describe the shape of your tables, including the types for a full record (\`Row\`), a new record to be inserted (\`Insert\`), and the fields that can be updated (\`Update\`).

An incomplete definition, for example one that only defines the \`Row\` type, will cause errors. When you try to access \`Database['public']['Tables']['domains']['Insert']\`, TypeScript correctly reports that the \`Insert\` property doesn't exist. Other incorrect definitions can confuse the TypeScript compiler, leading to the "excessively deep" error.

While the Supabase CLI can auto-generate a perfect \`Database\` interface from your live database, we cannot run it in this environment. Therefore, we must define it manually.

### The Solution: Define the Complete Interface

The most robust manual solution is to fully define the \`Row\`, \`Insert\`, and \`Update\` types within the \`Database\` interface itself. We will use TypeScript's utility types to derive \`Insert\` and \`Update\` from our primary \`Domain\` type, which serves as our single source of truth for a table row. This ensures consistency and makes maintenance easier.

#### Correct Implementation (\`src/services/supabaseService.ts\`)

The fix is to define the full \`Row\`, \`Insert\`, and \`Update\` types within the \`Database\` interface. This replaces any previous, incomplete versions.

**\`src/services/supabaseService.ts\`**
\`\`\`typescript
import { createClient, Session, SupabaseClient } from '@supabase/supabase-js';
import { Domain, DomainTag, DomainStatus } from '../types';

// Define the database schema. This is our single source of truth for types.
export interface Database {
  public: {
    Tables: {
      domains: {
        Row: Domain; // The type of a row from the database. (alias for our Domain type)
        // The type for inserting a new row. DB handles id, user_id, and created_at.
        Insert: Omit<Domain, 'id' | 'user_id' | 'created_at'>;
        // The type for updating a row. id, user_id and created_at should not be updatable.
        Update: Partial<Omit<Domain, 'id' | 'user_id' | 'created_at'>>;
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      domain_status_type: DomainStatus;
      domain_tag_type: DomainTag;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

// ... rest of the service file
\`\`\`

With this change, the types for inserting (\`DomainInsert\`) and updating (\`DomainUpdate\`) are correctly inferred from this complete definition, resolving the TypeScript errors and ensuring the application builds successfully.
`;


export const docs: DocContent[] = [
    {
        slug: 'readme',
        title: 'Project Overview',
        content: readmeContent
    },
    {
        slug: 'deployment',
        title: 'Deployment & Setup',
        content: deploymentContent
    },
    {
        slug: 'troubleshooting',
        title: 'Troubleshooting',
        content: troubleshootingContent
    },
    {
        slug: 'who-dat',
        title: 'Provider: who-dat',
        content: whoDatContent
    },
    {
        slug: 'whoisxmlapi',
        title: 'Provider: WhoisXMLAPI',
        content: whoisXmlApiContent
    },
    {
        slug: 'apilayer',
        title: 'Provider: apilayer.com',
        content: apiLayerContent
    },
    {
        slug: 'whoisfreaks',
        title: 'Provider: WhoisFreaks',
        content: whoisFreaksContent
    },
    {
        slug: 'whoapi',
        title: 'Provider: WhoAPI.com',
        content: whoapiContent
    },
    {
        slug: 'rapidapi',
        title: 'Provider: RapidAPI',
        content: rapidApiContent
    },
];