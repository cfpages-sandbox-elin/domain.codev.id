# Monitoring Configuration

Progress tracker and reference for user-configurable WHOIS scheduling.

## Why

Supabase cron can wake every 15 minutes without calling a WHOIS provider every 15 minutes. The per-user policy decides which domains are due. This keeps drop monitoring responsive while protecting limited free-provider quotas.

## Configurable Policy

| Setting | Balanced default | Purpose | Status |
| --- | ---: | --- | --- |
| Automatic monitoring | Enabled | Pause/resume scheduled WHOIS calls without removing domains. | ✅ Implemented |
| Maximum checks per cron run | 25 | Bounds one user's provider usage and rotates oldest due domains first. | ✅ Implemented |
| Grace/redemption interval | 168 hours | Low-frequency checks immediately after target expiry. | ✅ Implemented |
| Pre-drop start | 45 days after expiry | Starts closer monitoring before estimated release. | ✅ Implemented |
| Pre-drop interval | 24 hours | Cadence between pre-drop start and active window. | ✅ Implemented |
| Estimated drop day | 65 days after expiry | Configurable fallback where registry-specific timing is unavailable. | ✅ Implemented |
| Active window before estimate | 36 hours | Starts intensive checks before estimated release. | ✅ Implemented |
| Active window after estimate | 348 hours | Keeps intensive checks running after the estimate. | ✅ Implemented |
| Active polling interval | 60 minutes | Main quota/latency tradeoff; cron remains every 15 minutes. | ✅ Implemented |
| Post-window interval | 6 hours | Continues monitoring indefinitely without hourly quota pressure. | ✅ Implemented |

## Presets

| Preset | Active cadence | Post-window | Run cap | Intended use |
| --- | ---: | ---: | ---: | --- |
| Quota saver | 180 minutes | 24 hours | 10 | Few free requests; accepts slower detection. |
| Balanced | 60 minutes | 6 hours | 25 | Default compromise for free providers. |
| Aggressive | 15 minutes | 1 hour | 50 | Critical targets with sufficient provider quota. |

## Runtime Rules

- Cron runs every 15 minutes, but WHOIS is called only when a domain is due under this policy.
- Available, dropped, and reserved domains remain terminal and consume no automatic quota.
- `mine` and `others` renewal cadence remains conservative and code-defined; this page controls target/drop monitoring.
- The global server cap `WHOIS_CRON_MAX_CHECKS` remains a final safety ceiling across all users.
- The Schedule page uses the same user's persisted settings when projecting due times.

## Implementation Tracker

| Task | Status |
| --- | --- |
| Persist one validated policy row per user with RLS. | ✅ Done |
| Add frontend service types/read/write operations. | ✅ Done |
| Apply policy to the Edge Function scheduler and per-user run cap. | ✅ Done |
| Apply policy to the Schedule page projection. | ✅ Done |
| Add dedicated Settings → Monitoring UI with presets and advanced controls. | ✅ Done |
| Add scheduler regression tests for configurable cadence and pause. | ✅ Done |
| Deploy migration and `check-domains`; verify tests/lint/build. | ✅ Done |
