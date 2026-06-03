# WHOIS Provider Dashboard And Backup Guide

Last updated: 2026-06-03 13:58 WIB.

## Position

Yes, WHOIS provider health and quota should be visible in the dashboard.

This project depends on external WHOIS APIs. If a provider is exhausted, misconfigured, unsupported for a TLD, or returning false availability, the domain list can become misleading. The dashboard should show provider status before the user trusts bulk re-check results.

## Dashboard Goals

| Goal | Why |
| --- | --- |
| Show configured providers | The user should know which providers are active, missing keys, or only documented. |
| Show quota/limit status | Prevent accidental bulk checks from burning the free tier. |
| Show last provider used per check | Makes wrong data debuggable. |
| Show provider errors | Distinguish "domain available" from "provider failed" or "TLD unsupported". |
| Show fallback order | Helps explain why a result came from provider B instead of provider A. |
| Warn before bulk re-check | Bulk actions should estimate API cost before running. |

## Supabase UI Setup

Use this if you prefer the Supabase website instead of CLI commands.

### 1. Deploy `get-whois-providers`

1. Open https://supabase.com and go to your project.
2. In the left sidebar, open **Edge Functions**.
3. Click **Create a function**.
4. Name it `get-whois-providers`.
5. Open the new function editor.
6. Delete the default starter code.
7. Copy the full contents of `supabase/functions/get-whois-providers/index.ts` from this repository.
8. Paste it into the Supabase function editor.
9. Click **Save and deploy**.

### 2. Make sure shared WHOIS logic is available

The `get-whois-providers` function imports:

```ts
import { getWhoisProviderStatuses } from '../_shared/whois-logic.ts'
```

If the Supabase Dashboard editor does not automatically include shared files, deploy with the Supabase CLI instead, because the CLI handles the `_shared` folder cleanly:

```bash
npx supabase functions deploy get-whois-providers
```

If you want to stay fully in the UI, check whether your project's Edge Function editor exposes the `_shared/whois-logic.ts` file. If it does, paste the current contents of `supabase/functions/_shared/whois-logic.ts` there too. If it does not, use the CLI for this function.

### 3. Add optional backup provider secrets

1. In the Supabase project sidebar, open **Project Settings**.
2. Open **Edge Functions**.
3. Find **Secrets**.
4. Click **Add new secret**.
5. Add any optional backup provider keys you want to activate:

| Secret name | Required? | Purpose |
| --- | --- | --- |
| `WHOISJSON_API_KEY` | Optional | Enables the WhoisJSON backup provider. |
| `IP2WHOIS_API_KEY` | Optional | Enables the IP2WHOIS / IP2Location.io backup provider. |

6. Save the secrets.
7. Re-deploy affected Edge Functions if Supabase prompts you or if the dashboard still shows the provider as missing-key.

### 4. Confirm in the app

1. Open the app dashboard.
2. Find the **WHOIS Providers** panel.
3. Click **Refresh**.
4. Confirm these states:

| Expected state | Meaning |
| --- | --- |
| `Active` | Provider code exists and the required secret/config is present. |
| `Missing key` | Provider is implemented but its secret is not set. |
| `Disabled` | Provider exists but is disabled in code. |
| `Not implemented` | Known provider is documented but no adapter exists yet. |

The panel does not expose secret values. It only reports whether required environment keys are configured.

### 5. Existing provider secret names

If you want all currently implemented providers visible as active, configure the relevant secrets:

| Provider | Secret name(s) |
| --- | --- |
| who-dat | `WHO_DAT_URL`, optional `WHO_DAT_AUTH_KEY` |
| WhoisXMLAPI | `WHOIS_API_KEY` or legacy `VITE_WHOIS_API_KEY` |
| APILayer Whois API | `APILAYER_API_KEY` or legacy `VITE_APILAYER_API_KEY` |
| WhoisFreaks | `WHOISFREAKS_API_KEY` or legacy `VITE_WHOISFREAKS_API_KEY` |
| WhoAPI | `WHOAPI_COM_API_KEY` or legacy `VITE_WHOAPI_COM_API_KEY` |
| RapidAPI Domain WHOIS Lookup | `RAPIDAPI_KEY` or legacy `VITE_RAPIDAPI_KEY` |
| WhoisJSON | `WHOISJSON_API_KEY` or legacy `VITE_WHOISJSON_API_KEY` |
| IP2WHOIS / IP2Location.io | `IP2WHOIS_API_KEY` or legacy `VITE_IP2WHOIS_API_KEY` |

For hobby use, do not enable every provider at once unless you need them. Start with one or two reliable providers, then add backups after checking quota behavior.

## Recommended Dashboard Widget

Add a compact "WHOIS Providers" panel above or beside the domain list.

| Field | Example | Source |
| --- | --- | --- |
| Provider | APILayer | Static provider registry |
| Status | Active / Missing key / Rate limited / Disabled / Not implemented | Runtime health state |
| Priority | 1, 2, 3 | Provider waterfall config |
| Monthly quota | 3,000 | Static plan config or provider response headers |
| Remaining quota | 2,241 | Provider response headers, API account endpoint, or local counter |
| Daily remaining | 84 | Provider response headers or local counter |
| Last success | 2026-06-03 13:42 WIB | Local app telemetry |
| Last error | 429 rate limit | Local app telemetry |
| Supported TLD note | Limited list | Static provider metadata |

## Current Provider Implementation Status

| Provider | Implemented now? | Current env key(s) | Current role | Notes |
| --- | --- | --- | --- | --- |
| `who-dat` | Yes | `WHO_DAT_URL`, `WHO_DAT_AUTH_KEY` | Primary if URL exists | Self-hosted/custom option. Quota depends on deployment. |
| WhoisXMLAPI | Yes | `WHOIS_API_KEY` | Backup | Good parsed WHOIS fallback. |
| APILayer Whois API | Yes | `APILAYER_API_KEY` | Backup | Current code uses `/whois/check`; APILayer docs also expose `/check` and `/query`. Good quota headers. |
| WhoisFreaks | Yes | `WHOISFREAKS_API_KEY` | Backup | Uses live WHOIS endpoint. |
| WhoAPI | Yes | `WHOAPI_COM_API_KEY` | Backup | Implemented, but current free-tier status should be verified before relying on it. |
| RapidAPI Domain WHOIS Lookup API | Yes | `RAPIDAPI_KEY` | Last fallback | Marketplace APIs vary by provider and plan. Treat as optional. |
| WhoisJSON | Yes | `WHOISJSON_API_KEY` | New backup | 1,000 free monthly requests across endpoints. Adapter added, but response mapping needs live validation. |
| IP2WHOIS / IP2Location.io | Yes | `IP2WHOIS_API_KEY` | New backup | 500 domain WHOIS API queries/month on free tier per IP2Location.io pricing. Adapter added, but response mapping needs live validation. |
| JsonWhois.io | No | Proposed `JSONWHOIS_API_KEY` | Optional backup | Has availability and WHOIS endpoints; pricing model needs confirmation before implementation. |
| RDAP direct lookup | No | None | Future no-key fallback | Useful for common TLDs but response formats vary by registry. |

## Current Public Free-Tier / Limit Notes

These numbers were checked on 2026-06-03. Verify before coding billing-sensitive behavior.

| Provider | Free/limit data found | Dashboard confidence | Source |
| --- | --- | --- | --- |
| APILayer Whois API | Free plan: 3,000 requests/month, free for lifetime, no credit card required. Docs expose `x-ratelimit-limit-month`, `x-ratelimit-remaining-month`, `x-ratelimit-limit-day`, and `x-ratelimit-remaining-day` response headers. | High | https://marketplace.apilayer.com/whois-api and https://marketplace.apilayer.com/whois-api/tabs/api_docs |
| WhoisXMLAPI WHOIS API | Free tier: 500 WHOIS queries. | High | https://whois.whoisxmlapi.com/pricing |
| WhoisFreaks | Free 500 API credits on signup. Live API rate listed as 80 rpm on API credit plans. Credits can be lifetime for one-time packages. | Medium | https://whoisfreaks.com/pricing/api-plans |
| WhoisJSON | 1,000 free monthly requests shared across WHOIS, DNS, SSL, availability, subdomain discovery, and monitoring. Returns HTTP 429 after quota is reached. | High | https://whoisjson.com/ and https://whoisjson.com/pricing |
| IP2WHOIS / IP2Location.io | 500 Domain WHOIS API queries/month on free tier. | High | https://www.ip2location.io/pricing |
| RapidAPI marketplace WHOIS APIs | Free plans vary by individual API. RapidAPI says quota monitoring is the subscriber's responsibility. | Low/varies | https://docs.rapidapi.com/v2.0/docs/api-pricing |
| WhoAPI | Current free quota not confirmed in this pass. | Low | Verify from account/pricing page before implementation. |
| JsonWhois.io | Current free quota not confirmed in this pass. | Low | Verify from account/pricing page before implementation. |

## Data Model For Provider Telemetry

Even before migrating to D1, keep this model in mind. In Supabase/Postgres, it can be tables. In D1 later, it can map directly to SQLite.

```sql
CREATE TABLE whois_provider_status (
  provider_id text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT true,
  implemented boolean NOT NULL DEFAULT false,
  configured boolean NOT NULL DEFAULT false,
  priority integer NOT NULL,
  plan_name text,
  quota_period text CHECK (quota_period IN ('day', 'month', 'credits', 'unknown')),
  quota_limit integer,
  quota_remaining integer,
  quota_reset_at timestamptz,
  last_success_at timestamptz,
  last_error_at timestamptz,
  last_error_code text,
  last_error_message text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE whois_provider_attempts (
  id bigserial PRIMARY KEY,
  domain_id bigint,
  domain_name text NOT NULL,
  provider_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('success', 'failed', 'skipped')),
  result_status text,
  http_status integer,
  error_code text,
  error_message text,
  quota_remaining integer,
  latency_ms integer,
  checked_at timestamptz NOT NULL DEFAULT now()
);
```

## Runtime Provider Registry

Add a server-side provider registry. The dashboard should read this registry plus runtime telemetry.

```ts
type WhoisProviderConfig = {
  id: string;
  label: string;
  implemented: boolean;
  enabled: boolean;
  priority: number;
  envKeys: string[];
  freeTierLabel: string;
  supportsQuotaHeaders: boolean;
  supportedTlds?: string[];
};
```

Example registry entries:

```ts
export const WHOIS_PROVIDER_REGISTRY: WhoisProviderConfig[] = [
  {
    id: 'apilayer',
    label: 'APILayer Whois API',
    implemented: true,
    enabled: true,
    priority: 3,
    envKeys: ['APILAYER_API_KEY'],
    freeTierLabel: '3,000 requests/month',
    supportsQuotaHeaders: true,
  },
  {
    id: 'whoisjson',
    label: 'WhoisJSON',
    implemented: false,
    enabled: false,
    priority: 7,
    envKeys: ['WHOISJSON_API_KEY'],
    freeTierLabel: '1,000 requests/month shared across endpoints',
    supportsQuotaHeaders: false,
  },
];
```

## How To Track Limits

| Method | Works for | Implementation |
| --- | --- | --- |
| Response headers | APILayer | Read quota headers after each response and update provider status. |
| Account/quota endpoint | Some providers | If available, call it on dashboard load or daily cron. |
| Local counters | All providers | Increment per attempted request. Reset counters based on known quota period. |
| Manual config | Providers without quota APIs | Store plan/quota in config and show "estimated". |
| 429 handling | All HTTP APIs | Mark provider rate limited and skip it until reset. |

For the current Supabase Edge Function implementation, response-header quota capture must happen inside `supabase/functions/_shared/whois-logic.ts`, because provider calls happen server-side.

## Dashboard UX Recommendation

Add two compact dashboard sections:

1. Provider summary cards:

| Card | Display |
| --- | --- |
| Active providers | `3 active / 6 implemented / 9 known` |
| Lowest remaining quota | `APILayer: 84 daily remaining` |
| Last provider failure | `WhoisXMLAPI: 401 missing/invalid key` |
| Bulk re-check risk | `Visible list: 42 requests minimum` |

2. Provider table:

| Provider | State | Priority | Free limit | Remaining | Last success | Last error | Action |
| --- | --- | --- | --- | --- | --- | --- | --- |
| APILayer | Active | 3 | 3,000/mo | 2,241/mo | 13:42 | - | Test |
| WhoisJSON | Not implemented | 7 | 1,000/mo | - | - | - | Guide |

## Backup Provider Implementation Guide

### 1. Add Provider Adapter

Add a function in `supabase/functions/_shared/whois-logic.ts`:

```ts
const getWhoisDataFromWhoisJson = async (domainName: string): Promise<WhoisData> => {
  if (!WHOISJSON_API_KEY) throw new Error('WhoisJSON key not provided.');

  const response = await fetch(`https://whoisjson.com/api/v1/whois?domain=${encodeURIComponent(domainName)}`, {
    headers: { Authorization: `Bearer ${WHOISJSON_API_KEY}` },
  });

  const data = await response.json();
  if (!response.ok) throw new Error(`WhoisJSON failed: ${response.status}`);

  return {
    status: data.available ? 'available' : 'registered',
    expirationDate: data.expires_at || data.expiration_date || null,
    registeredDate: data.created_at || data.creation_date || null,
    registrar: data.registrar || data.registrar_name || null,
  };
};
```

Treat this as pseudocode until response fields are confirmed against the provider's docs/sample response.

### 2. Add Env Var

```ts
const WHOISJSON_API_KEY = Deno.env.get('WHOISJSON_API_KEY');
```

### 3. Add Provider To Waterfall

Place the backup after implemented providers with better confidence, or before weaker providers:

```ts
if (WHOISJSON_API_KEY) {
  try { return await getWhoisDataFromWhoisJson(domainName); }
  catch (e) { console.error(`WhoisJSON failed for ${domainName}: ${e.message}`); }
}
```

### 4. Add Telemetry Capture

For every provider attempt, record:

- provider id
- domain
- success/failure
- normalized result
- HTTP status
- error message
- latency
- quota headers if present

### 5. Add Dashboard State

Expose a server endpoint/function that returns:

```ts
type WhoisProviderDashboardState = {
  id: string;
  label: string;
  implemented: boolean;
  configured: boolean;
  enabled: boolean;
  priority: number;
  freeTierLabel: string;
  quotaLimit: number | null;
  quotaRemaining: number | null;
  quotaResetAt: string | null;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastErrorMessage: string | null;
};
```

## Implementation Order

1. Create provider registry in shared WHOIS logic.
2. Capture provider attempts and errors.
3. Capture quota headers for APILayer first because it explicitly exposes quota headers.
4. Show provider registry/status on dashboard.
5. Validate WhoisJSON response mapping with real API output.
6. Validate IP2WHOIS response mapping with real API output.
7. Add a "Test provider" action for one harmless domain such as `example.com`.
8. Add bulk re-check quota estimate before running visible-list re-check.

## Product Rule

Never let a provider result silently rewrite ownership intent.

Provider status can update `status`, `expiration_date`, `registered_date`, `registrar`, and `last_checked`. It should not automatically change `tag` from `mine` to `to-snatch`. The tag is user intent; provider output is evidence.
