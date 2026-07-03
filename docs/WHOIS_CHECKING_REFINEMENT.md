# WHOIS Checking Refinement

Progress tracker for reserved domains, WHOIS completeness, drop-window scheduling, and external alerts.

## Decisions

| Area | Decision | Status |
| --- | --- | --- |
| WHOIS completeness | A checked registered/expired domain can be complete without name servers. Some registries/providers return expiry, registrar, and statuses but no name-server data. | ✅ Implemented |
| Reserved domains | Add `reserved` as a first-class domain status. Reserved domains are not buyable and should not be automatically rechecked by dashboard repair or cron. | ✅ Implemented |
| Drop-window checks | Do not check expired target domains aggressively throughout the whole post-expiry period. Check lightly during grace/redemption, then aggressively only around the estimated drop window. | ✅ Implemented |
| Drop timing | Use the precise expiry timestamp when available. If expiry time is absent, use the registration timestamp hour as a weak fallback because many domains preserve lifecycle timing around the original registration hour. If neither exists, use a wider day-level window. | ✅ Implemented |
| External alerts | Keep `GET /api/v1/alerts/due` for broad polling and add an exact-domain target drop alert endpoint for integrations that are watching one domain closely. | ✅ Implemented |
| Owned expired domains | Emphasize expired `mine` domains in UI and include them in external due alerts as urgent renewal alerts. | ✅ Implemented |

## Implementation Checklist

| Task | Status | Notes |
| --- | --- | --- |
| Add `reserved` to frontend, Edge Function, and shared WHOIS status types. | ✅ Implemented | Added Supabase enum migration. |
| Detect reserved signals from provider/RDAP response statuses, remarks, notices, and common text fields. | ✅ Implemented | Conservative text/status scan. |
| Remove `name_servers` from missing/incomplete WHOIS predicates. | ✅ Implemented | Applied in dashboard auto-repair, row overlay, missing filter, and external API missing-data mode. |
| Skip reserved domains in cron and dashboard automatic repair. | ✅ Implemented | Manual re-check remains available. |
| Tune cron check cadence for target expired domains. | ✅ Implemented | User-configurable phases and presets; balanced defaults to hourly active checks and six-hour post-window checks. |
| Add exact-domain drop alert endpoint. | ✅ Implemented | Path: `GET /api/v1/alerts/drop/{domainName}`. |
| Update docs/CODEBASE.md, docs/WHOIS.md, docs/INTEGRATIONS.md, docs/DB.md, README schema note. | ✅ Implemented | Keep docs as project map, not changelog. |
| Verify with `pnpm` commands only. | ✅ Implemented | `pnpm exec tsc --noEmit --pretty false` and `pnpm run build` passed. Build emitted the existing-style Vite >500 kB chunk warning; `dist` was removed after verification. |

## Scheduling Model

For target domains (`tag = to-snatch`) with an expiry timestamp:

| Phase | Window | Automatic check cadence |
| --- | --- | --- |
| Before expiry | More than 0 days before expiry | Existing low-frequency expiry-watch cadence. |
| Grace/redemption | 0-44 days after expiry | Every 7 days. |
| Pre-drop watch | 45-57 days after expiry | Every 24 hours. |
| Active drop watch | Configurable before/after offsets around estimated release | Configurable from 15 minutes to 24 hours; balanced default is 60 minutes. |
| Past drop watch | After the configured active window | Configurable from 1 hour to 7 days; balanced default is 6 hours. |

Balanced defaults estimate drop at `expiry + 65 days`, start active watch 36 hours before, and keep it active for 348 hours after. All four values are configurable in Settings → Monitoring. If expiry has no useful time component but `registered_date` has an hour, that registration hour remains the lower-confidence time fallback.
