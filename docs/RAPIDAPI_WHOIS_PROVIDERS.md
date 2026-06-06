# RapidAPI WHOIS Provider Research

Last researched: 2026-06-06 WIB.

This document records the RapidAPI WHOIS/domain APIs listed for possible backup-provider expansion. Pricing and quota data were read from the public RapidAPI listing page state on 2026-06-06. RapidAPI plans can change, so re-check before implementation or billing-sensitive bulk use.

RapidAPI distinguishes:

- `FREE`: free API/plan metadata with no overage in the parsed plan.
- `FREEMIUM`: a free Basic tier with overage pricing; treat as credit-card/overage risk unless the account page proves otherwise.
- `PAID`/`PERUSE`: not a no-cost plan.

## Summary

| API | RapidAPI host | Free tier found | Basic quota | Limit | Main endpoints/capability | Fit for this app |
| --- | --- | --- | --- | --- | --- | --- |
| [Domains API](https://rapidapi.com/layered-layered-default/api/domains-api) | `domains-api.p.rapidapi.com` | Yes, `FREE` | 500/month | Hard | Domain lookup, WHOIS, RDAP, DNS records, history, TLD data | Strong candidate. It combines lookup, WHOIS, and RDAP in one API. |
| [Whois Lookup](https://rapidapi.com/Zozor54/api/whois-lookup) | `zozor54-whois-lookup-v1.p.rapidapi.com` | Yes, `FREE` | 500/month | Hard | WHOIS, DNS lookup, SSL certificate, reverse WHOIS by IP | Medium. Useful breadth, but provider confidence needs live validation. |
| [WHOIS Lookup 10](https://rapidapi.com/wucarderapproved/api/whois-lookup10) | `whois-lookup10.p.rapidapi.com` | Yes, `FREE` | 1,000/month | Hard | Domain WHOIS and hosting lookup | Medium. Simple quota is useful; response quality unknown. |
| [Domain Checker API](https://rapidapi.com/JustMobi/api/domain-checker-api) | `domain-checker-api.p.rapidapi.com` | Yes, `FREE` | 30/month | Hard | Domain availability/checker endpoint | Low/availability-only. Too small for routine WHOIS checks. |
| [Bulk Whois](https://rapidapi.com/backend_box/api/bulk-whois) | `pointsdb-bulk-whois-v1.p.rapidapi.com` | Yes, `FREE` | 24/month | Hard | Bulk WHOIS endpoint | Low/targeted. Interesting for batches, but free quota is tiny. |
| [Whois Lookup Service](https://rapidapi.com/evlar-evlar-default/api/whois-lookup-service) | `whois-lookup-service.p.rapidapi.com` | Yes, `FREE` | 50/month | Hard | Domain, ASN, and IP WHOIS | Low/medium. Multi-target WHOIS, but low quota. |
| [Whois Lookup API](https://rapidapi.com/yukticode/api/whois-lookup-api) | `whois-lookup-api.p.rapidapi.com` | Yes, `FREE` | 500/month | Hard | Domain overview via RDAP/WHOIS, availability beta, DNS, SSL, IP, TLD data | Strong candidate after live validation. Good endpoint coverage. |
| [Live Whois Lookup](https://rapidapi.com/jfreaks-jfreaks-default/api/live-whois-lookup) | `live-whois-lookup.p.rapidapi.com` | Yes, `FREEMIUM` | 50/month | Soft, `$0.01` overage | Live WHOIS | Medium with caution. Known-ish provider branding, but overage risk. |
| [Whois Info API](https://rapidapi.com/trustapi-trustapi-default/api/whois-info-api) | `whois-info-api.p.rapidapi.com` | Yes, `FREE` | 25/month | Hard | Check/query, RDAP, SSL, TLD endpoints | Low/medium. Good shape, but free quota is tiny. |
| [Whois55](https://rapidapi.com/iaminwinter/api/whois55) | `whois55.p.rapidapi.com` | Yes, `FREE` | 500,000/month | Hard | WHOIS endpoint | Experimental. Huge free quota from a small/unknown listing needs live reliability checks. |
| [Whois40](https://rapidapi.com/devXprite/api/whois40) | `whois40.p.rapidapi.com` | Yes, `FREE` | 5,000/day | Hard | WHOIS endpoint | Experimental. Very large free quota; validate correctness and rate behavior before trusting. |
| [WHOIS by API Ninjas](https://rapidapi.com/apininjas/api/whois-by-api-ninjas) | `whois-by-api-ninjas.p.rapidapi.com` | Yes, `FREE` | 3,000/month | Hard | `/v1/whois` | Strong candidate. Clear quota and known API Ninjas provider. |
| [WHOIS API Domain Whois Checker](https://rapidapi.com/turulabs-technologies-turulabs-technologies-default/api/whois-api-domain-whois-checker) | Not exposed during this pass | Unverified | Unverified | Unverified | Page did not expose plan/host/endpoint metadata in parsed state | Skip until manually verified. |
| [Wobado Domain API](https://rapidapi.com/Wobado/api/wobado-domain-api) | `wobado-domain-api.p.rapidapi.com` | Yes, `FREE` | 5/month | Hard | Domain information | Low. Free quota is only enough for smoke tests. |
| [Domain Whois Lookup 1](https://rapidapi.com/navii/api/domain-whois-lookup1) | `domain-whois-lookup1.p.rapidapi.com` | Yes, `FREE` | 10/month | Hard | Domain WHOIS via POST | Low. Free quota is tiny. |
| [Whois Lookup 1](https://rapidapi.com/iamnikhil/api/whois-lookup1) | `whois-lookup1.p.rapidapi.com` | Yes, `FREE` | 600/month | Hard | WHOIS lookup | Medium. Useful free quota; response quality unknown. |
| [Whois v2](https://rapidapi.com/whoisapi/api/whois-v2) | `whoisapi-whois-v2-v1.p.rapidapi.com` | Plan metadata says `FREE`, but quota is `0/month` | 0/month | Soft | WHOIS lookup v2 | Not useful as-is. Likely requires WhoisXMLAPI-side account/credits or a changed plan. |
| [Whois Lookup 5](https://rapidapi.com/belchiorarkad-FqvHs2EDOtP/api/whois-lookup5) | `whois-lookup5.p.rapidapi.com` | Yes, `FREE` | 80/month | Hard | Domain info, WHOIS, similarity, DNS, NS lookup | Low/medium. Some useful extras, but low quota. |
| [Whois Domain Lookup API](https://rapidapi.com/sharmadhirajnp2/api/whois-domain-lookup-api) | `whois-domain-lookup-api.p.rapidapi.com` | Yes, `FREEMIUM` | 100/month | Soft, `$0.0001` overage | Domain info | Medium with overage caution. |
| [Netlas All-In-One Host](https://rapidapi.com/netlas-netlas-default/api/netlas-all-in-one-host) | `netlas-all-in-one-host.p.rapidapi.com` | Plan metadata says `FREE`, but quota is `0/month` | 0/month | Not shown | Host intelligence endpoint | Not a WHOIS provider. Keep for security enrichment only, not domain expiry/availability. |

## Best Candidates To Test First

| Priority | API | Why |
| --- | --- | --- |
| 1 | Domains API | Best overall endpoint coverage: normalized domain lookup, WHOIS, RDAP, DNS, history, TLDs; 500 free requests/month. |
| 2 | WHOIS by API Ninjas | 3,000 free requests/month and known provider reputation. Likely the cleanest RapidAPI-only backup. |
| 3 | Whois Lookup API | Broad endpoint coverage, including RDAP, WHOIS, availability beta, DNS, SSL, and IP/TLD data; 500 free requests/month. |
| 4 | WHOIS Lookup 10 | 1,000 free requests/month with simple domain endpoint; needs response validation. |
| 5 | Whois Lookup 1 | 600 free requests/month; low implementation complexity if response is clean. |
| 6 | Whois40 / Whois55 | Large stated free quotas, but treat as experimental until tested against known domains and unsupported/available domains. |

## Implementation Notes

- Do not treat all RapidAPI WHOIS APIs as one provider. Each listing has a different `x-rapidapi-host`, endpoint path, parameter shape, response shape, quota, and reliability profile.
- Keep the project-wide `RAPIDAPI_KEY` secret as the credential, but model each candidate as a distinct provider id such as `rapidapi-domains-api`, `rapidapi-api-ninjas-whois`, or `rapidapi-yukticode-whois`.
- Implemented now: `rapidapi-domains-api` uses `domains-api.p.rapidapi.com` with the `/domains/{domain}/whois` endpoint, a 500/month hard Basic quota, and RapidAPI quota-header capture. It runs late in the provider waterfall so it acts as a backup.
- The older generic `rapidapi` provider remains implemented but is ordered after `rapidapi-domains-api`, because it targets a different RapidAPI listing and may fail if the account is only subscribed to Domains API.
- Add candidates behind disabled/default-off registry entries first. Enable only after live response validation.
- Capture RapidAPI billing headers for every call. RapidAPI documents usage/quota headers and says quota monitoring is the subscriber's responsibility.
- Prefer providers that return expiry date, registrar, status, name servers, and availability in structured JSON. Reject a `registered` result without expiry date so the waterfall continues.
- Treat `FREEMIUM` providers as overage-risk providers. They may be fine for manual fallback, but should not be used for bulk jobs unless provider telemetry and hard caps are active.

## Live Validation Checklist

Before implementing any adapter, test at least:

| Test domain | Expected use |
| --- | --- |
| `example.com` | Known registered domain with stable WHOIS/RDAP data. |
| A known owned domain from the app | Verify registrar, expiry, name server mapping against current records. |
| A definitely invalid domain string | Confirm validation/error shape. |
| A likely available random domain | Confirm availability semantics and whether the provider charges/returns empty WHOIS. |
| `.id` / Indonesian second-level TLD if relevant | Confirm local portfolio TLD coverage. |

Record raw response fields before writing a normalizer.

## Sources

- RapidAPI pricing/plan pages linked in the table above.
- RapidAPI pricing behavior docs: https://docs.rapidapi.com/v2.0.0/docs/api-pricing
- RapidAPI connection/subscription docs: https://docs.rapidapi.com/docs/connecting-to-an-api
