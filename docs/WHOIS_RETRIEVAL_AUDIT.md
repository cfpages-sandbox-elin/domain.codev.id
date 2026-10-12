# Audit Report: Multi-Source WHOIS & RDAP Data Retrieval Architecture

- **Project**: `domain.codev.id`
- **Date**: 2026-10-12 (WIB)
- **Author**: Antigravity (Gemini 3.8 Flash Pair Programmer)
- **Status**: Complete & Actionable
- **Scope**: Robustness, scalability, and lifecycle accuracy of WHOIS retrieval across 14 upstream providers for hundreds of tracked domains.

---

## 1. Executive Summary

`domain.codev.id` tracks domain portfolios ranging from owned assets (`mine`), potential snatch targets (`to-snatch`), and passive monitoring (`others`). Managing hundreds of domains across diverse Top-Level Domains (gTLDs like `.com`, `.net`, `.io`, and ccTLDs like `.id`, `.co.id`, `.de`) requires high throughput, resilience against third-party rate limits, and precise lifecycle status inference.

Our audit examined the end-to-end retrieval stack:
1. Client-side trigger (`src/services/whoisService.ts`)
2. Edge proxy (`supabase/functions/get-whois/index.ts`)
3. Batch cron scheduler (`supabase/functions/check-domains/index.ts` & `scheduler.ts`)
4. Shared orchestration, provider registry, and adapters (`supabase/functions/_shared/*`)

### Verdict
The multi-provider registry concept is well-structured and extensible, but **currently lacks critical operational guardrails required to reliably process hundreds of domains**. Key vulnerabilities include unbounded network calls (no `AbortSignal.timeout`), EPP status code blindness during lifecycle inference, lack of circuit-breaking on failing providers, and suboptimal priority ordering that exhausts commercial credits before leveraging zero-cost IANA RDAP.

---

## 2. Inventory of Current Providers

The system registers 14 providers in `supabase/functions/_shared/whois-registry.ts`:

| Priority | Provider ID | Type | Cost / Quota | Limitations / Constraints |
|---|---|---|---|---|
| 1 | `who-dat` | Self-hosted Go proxy | Self-hosted | Requires dedicated server & `WHO_DAT_URL` |
| 2 | `whoisxmlapi` | Commercial SaaS | 500 free queries | Strict quota; requires API key |
| 3 | `apilayer` | Commercial SaaS | 3,000 req/month | Strict whitelist of ~60 TLDs (`APILAYER_SUPPORTED_TLDS`) |
| 4 | `whoisfreaks` | Commercial SaaS | 500 signup credits | Requires API key |
| 5 | `whoapi` | Commercial SaaS | Account-dependent | Requires API key |
| 7 | `whoisjson` | Commercial SaaS | 1,000 req/month, 20/min | Requires API key |
| 8 | `ip2whois` | Commercial SaaS | 500 req/month | Requires API key |
| 9 | `rdap-iana` | Zero-Key Direct RDAP | Free, no key | High speed, ICANN gTLDs & participating ccTLDs |
| 10 | `rdap-org` | Zero-Key RDAP Gateway | Free, no key | Rate-limited behind Cloudflare (10 req/10s) |
| 11 | `oti-labs` | RapidAPI | 1,000 req/month | Requires RapidAPI key |
| 12 | `domainduck` | Commercial SaaS | 2,500 req, 500/hr | Requires API key |
| 13 | `rdap-api` | Commercial SaaS | 7-day trial then paid | Requires API key |
| 14 | `rapidapi-domains-api` | RapidAPI | 500 req/month | Low throughput |
| 15 | `rapidapi` | RapidAPI | Marketplace plan | Last fallback |

---

## 3. Critical Findings & Failure Modes

### Finding 1: Unbounded Fetch Calls Risk Cascading Edge Function Timeouts
- **Problem**: In `supabase/functions/_shared/whois-adapters.ts`, all HTTP calls (`fetch(url, ...)`) lack `AbortSignal.timeout(ms)`.
- **Impact**: If a third-party API stalls on a TCP socket or enters heavy queuing, a single domain check can hang for 60+ seconds. In `check-domains/index.ts`, concurrency is 6 workers. If multiple workers stall, the entire Supabase Edge Function reaches its hard execution ceiling (150s), terminating the cron run prematurely and leaving dozens of domains unchecked.
- **Remedy**: Enforce a strict 6,000ms bounded timeout on every provider fetch via `AbortSignal.timeout(6000)`.

### Finding 2: Inverted Cost Priority (Burning Paid Credits Ahead of Free RDAP)
- **Problem**: `rdap-iana` (free, no key, highly accurate for .com/.net/.org/.io/.xyz) is currently at **Priority 9**, while commercial providers with 500-query lifetime limits (`whoisxmlapi`, `whoisfreaks`, `ip2whois`) sit at **Priorities 2–8**.
- **Impact**: Checking 200 common `.com` or `.org` domains exhausts monthly paid API quotas within hours, leaving no quota for obscure ccTLDs that actually require commercial fallback.
- **Remedy**: Dynamic execution routing: For gTLDs supported by IANA RDAP, attempt zero-cost `rdap-iana` first. Reserve commercial providers for ccTLDs or RDAP misses.

### Finding 3: EPP Lifecycle Blindness (Ignoring Redemption & PendingDelete)
- **Problem**: `whois-normalize.ts` extracts EPP codes into `domainStatuses: string[]` (`clientHold`, `redemptionPeriod`, `pendingDelete`, `autoRenewPeriod`), but `whois-status.ts`'s `inferDomainStatus` completely ignores them:
  ```ts
  export const inferDomainStatus = (isAvailable: boolean, expiryDateStr: string | null | undefined, ...evidence: unknown[]): DomainStatus => {
    if (hasReservedSignal(evidence)) return 'reserved';
    if (isAvailable) return 'available';
    return expiryDateStr && new Date(expiryDateStr) < new Date() ? 'expired' : 'registered';
  };
  ```
- **Impact**: When a domain expires, it progresses through:
  1. *Grace Period* (0–45 days)
  2. *Redemption Period* (30 days, EPP `redemptionPeriod`)
  3. *Pending Delete* (5 days, EPP `pendingDelete`) -> **Drop guaranteed within 5 days!**
  4. *Dropped / Available* (Registry releases domain)
  Because the engine lumps all past-expiry domains into a generic `'expired'` without evaluating EPP status codes, users cannot see whether an expired domain is in redemption or 24 hours away from deletion.
- **Remedy**: Upgrade `inferDomainStatus` and `scheduler.ts` to inspect EPP statuses:
  - If EPP includes `pendingDelete`, mark high urgency active drop watch (priority 120).
  - If EPP includes `redemptionPeriod`, mark confirmed not dropped yet.
  - Return `drop_stage: 'grace' | 'redemption' | 'pending-delete' | 'dropped'` in `WhoisData`.

### Finding 4: Absence of Circuit-Breaking on Failing Providers
- **Problem**: When a provider's key is invalid, account exhausted, or endpoint returns 502/504, `whois-logic.ts` logs an error and tries the next provider for the current domain. However, on the very next domain, it attempts that same failed provider again!
- **Impact**: In a batch of 100 domains, an offline provider is pinged 100 times, adding 100 * 6s = 600 seconds of unnecessary latency.
- **Remedy**: Implement a short-lived runtime circuit breaker in `whois-runtime.ts`: if a provider fails with 401, 403, 429, or 3 consecutive network timeouts, trip the breaker for 5 minutes (`blockedUntil = Date.now() + 300_000`).

### Finding 5: Redundant Query Spam on Manual Re-Checks
- **Problem**: Neither `src/services/whoisService.ts` nor `get-whois/index.ts` checks whether the domain was already queried seconds ago.
- **Impact**: If a user clicks recheck multiple times or multiple UI components trigger checks, full provider cascades are executed.
- **Remedy**: Add short-term idempotency: if a domain has `last_checked` within the last 10 minutes and `forceFresh` is false, return cached data; otherwise proceed with live lookup.

---

## 4. Hardening Roadmap

1. **Step 1: Network Resilience & Bounded Timeouts**
   - Wrap all provider fetch requests in `supabase/functions/_shared/whois-adapters.ts` with `AbortSignal.timeout(6000)`.
   - Prevent infinite socket hangs during edge function execution.

2. **Step 2: Lifecycle EPP Status & Drop Stage Inference**
   - Enhance `supabase/functions/_shared/whois-status.ts` to detect `pendingDelete`, `redemptionPeriod`, `autoRenewPeriod`, and `clientHold`.
   - Introduce EPP status analysis in `WhoisData` so the UI and scheduler distinguish:
     - `registered` (Active)
     - `expired` (In grace or redemption, confirmed not dropped)
     - `pending-delete` (Drop imminent within 1-5 days)
     - `dropped` / `available` (Released by registry)

3. **Step 3: Provider Execution Circuit Breaker**
   - Expand `markProviderFailure` in `supabase/functions/_shared/whois-runtime.ts` to trip a 5-minute cool-down after consecutive failures or auth errors (401/403/429/timeout).

4. **Step 4: Smart Zero-Cost Routing (Free RDAP for gTLDs First)**
   - Adjust `getProviderExecutionOrder()` to check domain TLD: for gTLDs with direct IANA RDAP support (.com, .net, .org, .xyz, .io, .dev, .app), elevate `rdap-iana` ahead of commercial tiers.

5. **Step 5: Frontend Alignment & Widescreen Layout**
   - Finish Section 13 UI items: remove dead spacer column in `DomainItem.tsx`, fluid widescreen container in `App.tsx` and `Header.tsx`.
   - Ensure the re-check button and drop status badges display the precise lifecycle stage without clipping.
