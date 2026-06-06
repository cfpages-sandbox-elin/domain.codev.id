# Supabase Operations Guide

Last updated: 2026-06-06 WIB.

This project still uses Supabase Auth, Postgres, and Edge Functions while the longer-term backend direction is Cloudflare Workers/D1.

## Project

- Project ref: `gfnjestxjgkfujzubiqr`
- Config source: `supabase/config.toml`
- Use access tokens only through `SUPABASE_ACCESS_TOKEN` in the shell environment. Do not commit or document token values.

## CLI Rules

- Use `npx supabase@latest` for remote Supabase operations. Avoid the older local CLI path when the task can require deploy/bundling behavior.
- Edge Function deploys should use the Dockerless API path:

```powershell
$env:SUPABASE_ACCESS_TOKEN='<token>'; npx supabase@latest functions deploy get-whois get-whois-providers check-domains external-api --project-ref gfnjestxjgkfujzubiqr --use-api
```

- Secret operations do **not** support `--use-api`. The latest CLI rejects that flag for `secrets set`. Use:

```powershell
$env:SUPABASE_ACCESS_TOKEN='<token>'; npx supabase@latest secrets set NAME='value' --project-ref gfnjestxjgkfujzubiqr
```

- Verify secret names without exposing values:

```powershell
$env:SUPABASE_ACCESS_TOKEN='<token>'; npx supabase@latest secrets list --project-ref gfnjestxjgkfujzubiqr
```

## Current Secret Names

WHOIS provider secrets used by shared Edge Function logic include:

- `WHOIS_API_KEY`
- `APILAYER_API_KEY` or legacy `VITE_APILAYER_API_KEY`
- `WHOISFREAKS_API_KEY` or legacy `VITE_WHOISFREAKS_API_KEY`
- `WHOAPI_COM_API_KEY` or legacy `VITE_WHOAPI_COM_API_KEY`
- `RAPIDAPI_KEY` or legacy `VITE_RAPIDAPI_KEY`
- `WHOISJSON_API_KEY`
- `IP2WHOIS_API_KEY`
- `OTI_LABS_API_KEY`, optional dedicated OTI Labs RapidAPI key. If absent, the OTI Labs adapter falls back to shared `RAPIDAPI_KEY`.
- `DOMAINDUCK_API_KEY`
- `RDAP_API_KEY`
- `WHO_DAT_URL`
- `WHO_DAT_AUTH_KEY`

Domainduck specifically uses `DOMAINDUCK_API_KEY`; per-user browser-entered credentials use provider id `domainduck` and are stored separately in `whois_provider_credentials`.

## Edge Functions

- `get-whois`: authenticated browser WHOIS checks.
- `get-whois-providers`: authenticated provider status/dashboard data.
- `check-domains`: cron-style scheduled checks; `verify_jwt = false` because it checks `CRON_SECRET` itself.
- `external-api`: scoped external API; `verify_jwt = false` because it validates integration bearer tokens itself.

After changing shared WHOIS modules or function entrypoints, deploy affected functions with `npx supabase@latest functions deploy ... --use-api`.
