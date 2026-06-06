# AGENTS.md

Guidance for AI coding agents working in this repository.

## Operating Style

- Be proactive: when you notice a bug, missing test, fragile implementation, security risk, UX issue, or simpler architecture, record your own recommendation in `docs/SUGGESTION.md`.
- `docs/SUGGESTION.md` is for agent-originated suggestions based on codebase analysis. Do not use it as a changelog for user-requested changes or as a place to restate the user's own product suggestions.
- Keep `docs/CODEBASE.md` current when changing file responsibilities, runtime flow, database schema, Edge Function behavior, or major UI/data logic. Treat it as the quick project map for future context.
- Keep user-facing progress reports short. Prefer finishing the task, verifying it, then reporting the result.
- Focus on finishing the requested task end-to-end before reporting back. Avoid frequent progress narration unless work is long-running, blocked, or needs authorization/user input.
- Save tokens where practical: read targeted files, summarize long docs instead of pasting them, use `rg` for search, and avoid repeating unchanged context.
- Do not sacrifice implementation quality for brevity. Token saving must not reduce code correctness, verification, or maintainability.
- Before editing, inspect the relevant existing patterns and keep changes scoped.
- Before larger edits, check `docs/CODEBASE.md` for the current architecture map, then update it after the implementation if the map changed.
- Before Supabase CLI work, check `docs/SUPABASE.md` for the current project ref, secret names, and command rules.
- Do not revert user changes unless explicitly asked.
- Code modularly from now on: keep large UI, service, and Edge Function files split by responsibility where practical. Prefer focused components, hooks, pure utility modules, provider adapters, and route-handler modules over adding more unrelated logic to already-large files.

## Suggestions Log

When adding a suggestion, insert it at the top of the table in `docs/SUGGESTION.md`.

Only add entries for recommendations that come from the agent noticing something useful while reading or changing the code. If the user directly asks for a change and you implement it, do not add that as a suggestion unless the implementation reveals a separate follow-up improvement the user did not already ask for.

Required columns:

| Date/Time (WIB) | Status | Area | Suggestion | Why it matters | Implementation note |
| --- | --- | --- | --- | --- | --- |

Status emoji:

- ✅ Implemented
- ❌ Not implemented
- 🟡 Partially implemented

Use WIB time format: `YYYY-MM-DD HH:mm WIB`.

## Project Direction

- Target backend direction: Cloudflare Workers/Pages Functions plus Cloudflare D1.
- Target auth direction: Better Auth.
- Current implementation still uses Supabase Auth, Supabase database assumptions, and Supabase Edge Functions.
- The app goal is practical domain tracking: bulk enter owned or target domains, fetch WHOIS/availability metadata, track expiration/drop status, and surface renewal/snatch timing clearly.
- Keep project documentation in `docs/` by default. Do not add new planning/research docs at the repository root unless the filename is a common root convention like `README.md` or `AGENTS.md`.
- Current migration preference: delay migration. First make the existing Supabase-backed app safer and usable; revisit D1 after the current data/UI problems are under control.

## Engineering Preferences

- Use `pnpm` for package scripts and dependency operations. Do not use `npm run`, `npm install`, or npm-generated lockfiles in this repository; the project is pnpm-managed to avoid extra storage use.
- Do not start a local dev server unless the user explicitly asks for it. This repo normally verifies locally with `pnpm run build`, then deploys and checks the production app directly.
- After running `pnpm run build` for verification, delete generated build artifacts such as `dist/` to save local storage unless the user explicitly asks to keep them.
- Clean up temporary logs or helper files created during verification, especially `.tmp/` dev-server logs created by agents.
- For Supabase Edge Function deploys or bundling verification, use the newer Dockerless CLI path: `npx supabase@latest functions deploy ... --use-api`. Do not rely on the local `pnpm exec supabase` CLI for deploys because it may require Docker Desktop.
- For Supabase secrets, use `npx supabase@latest secrets set NAME='value' --project-ref ...` without `--use-api`; the latest CLI rejects `--use-api` for `secrets set`.
- Prefer Cloudflare-native services for the next backend iteration: D1 for relational data, Workers/Pages Functions for API routes and cron, Workers Secrets for API keys.
- Keep WHOIS provider keys server-side only.
- Build domain checks as queued/batched work; avoid firing unbounded API calls from the browser.
- Treat D1 as SQLite: design explicit indexes, avoid full scans, and paginate list views.
- Keep auth/session checks in server routes because D1 does not provide Supabase-style row-level security.
