# Migration Decision: Supabase vs Better Auth + Cloudflare D1

Last updated: 2026-06-03 13:51 WIB.

## Short Answer

Migration is delayed for now.

The practical path is:

1. Keep Supabase temporarily.
2. Fix the current data-safety issue where provider results can make owned domains look available.
3. Improve the UI so wrong/stale data is visible and recoverable.
4. Revisit D1 after the existing app is stable enough to export clean data.

Reason: D1 still looks like a better long-term fit, but migrating while the current domain data is messy risks carrying bad assumptions into the new database. Stabilize first, migrate later.

## Current Direction: Stabilize First

| Focus | Decision | Why |
| --- | --- | --- |
| Auth | Keep Supabase Auth | Login works, so changing auth now is wasted risk. |
| Database | Keep Supabase temporarily | Fix behavior and recover data before deciding what to export. |
| WHOIS writes | Make conservative | Provider results should not automatically change ownership tags. |
| UI | Improve now | Admin rows need last-check visibility, aligned data, and low clutter. |
| D1 | Delay | Revisit once the app has clean semantics and recoverable data. |

## Updated Direction: Auth-Last Migration

This is still the likely migration shape if/when migration resumes.

| Piece | Migrate now? | Why |
| --- | --- | --- |
| Domain database | Yes | This is where the current app feels broken and hard to repair in Supabase. |
| Domain CRUD API | Yes | The frontend should stop writing directly through Supabase database client calls. |
| WHOIS on-demand route | Yes | Put provider keys and normalization in Cloudflare Workers. |
| Scheduled checks | Yes | Cloudflare Cron + D1 is a natural fit for simple domain monitoring. |
| Auth | Not first | Supabase login works. Keep it temporarily to avoid changing everything at once. |
| Better Auth | Later | Add it after D1 is stable, or skip it if Supabase Auth remains acceptable. |

This is not the purest final architecture, but it is the most pragmatic migration path from the current broken state.

## Current Implementation

| Area | Current stack |
| --- | --- |
| Auth | Supabase Auth with Google OAuth |
| Database | Supabase Postgres `domains` table assumed by frontend |
| Server logic | Supabase Edge Functions: `get-whois`, `check-domains` |
| Scheduler | Supabase cron setup documented |
| Frontend coupling | `src/App.tsx`, `src/services/supabaseService.ts`, `src/services/whoisService.ts`, and `Header/Auth` components depend on Supabase session/client behavior |

## Platform Notes

| Platform | Current relevant fact |
| --- | --- |
| Supabase | Supabase's pricing page says Free projects are paused after 1 week of inactivity. This matches your concern for a hobby project that may sit unused. Source: https://supabase.com/pricing |
| Cloudflare D1 | D1 is serverless SQLite on Cloudflare. Current D1 free limits include 10 databases, 500 MB max database size, 5 GB total account storage, 5 million rows read/day, and 100,000 rows written/day. Sources: https://developers.cloudflare.com/d1/platform/limits/ and https://developers.cloudflare.com/d1/ |
| Better Auth | Better Auth supports framework-agnostic auth handlers, client session helpers, social providers, and Cloudflare Workers usage. It can be used with relational databases including SQLite/D1-style setups through supported adapter patterns. Sources: https://better-auth.com/docs/installation and https://better-auth.com/docs/adapters/other-relational-databases |

## Pros And Cons: Staying On Supabase

| Pros | Cons |
| --- | --- |
| Already implemented. No migration work needed right now. | You dislike the platform behavior, especially inactive free project pausing. |
| Auth, database, RLS, Edge Functions, and cron are already integrated. | Supabase is overkill for a small domain tracker if you only need auth + a few tables + scheduled checks. |
| Postgres is powerful and flexible if the app grows. | More moving parts than the app's core needs: Supabase Auth, Postgres, RLS, Edge Functions, secrets, scheduler. |
| RLS gives built-in data isolation when configured correctly. | The frontend is tightly coupled to Supabase client/session APIs. |
| Google OAuth is already working. | Supabase Edge Functions use Deno-specific code; this does not directly transfer to Cloudflare Workers. |
| Fastest path to keep building UI features. | If the project goes inactive, resuming may require manually unpausing/restoring the Supabase project. |
| Good managed dashboard for database inspection. | Hobby projects can feel dependent on a hosted backend lifecycle you do not control. |

## Pros And Cons: Migrating To Better Auth + D1

| Pros | Cons |
| --- | --- |
| Better matches your preference: simple Cloudflare-native backend for a simple app. | Migration is not just auth. It requires replacing auth, database CRUD, WHOIS routes, and scheduled checks. |
| D1 is lightweight SQLite, good for a domain tracking table and check history. | D1 has no Supabase-style RLS; every API route must enforce `user_id` manually. |
| Cloudflare Workers + D1 can scale to zero and are less likely to annoy you for inactive hobby usage. | You must own more backend code: routes, sessions, migrations, authorization, error handling. |
| Same ecosystem as Cloudflare Pages deployment. | Better Auth setup with D1/Workers is more DIY than Supabase Auth dashboard setup. |
| Easier to keep all server logic in one place: `/api/auth`, `/api/domains`, `/api/whois`, cron. | Migration introduces risk of auth/session bugs if rushed. |
| D1 free limits are more than enough for a personal domain tracker. | D1 is SQLite, not Postgres; advanced relational/query features are more limited. |
| Import jobs, check history, and notifications can be modeled cleanly with small tables. | You need migration scripts to move Supabase users/domains into Better Auth/D1. |
| No need to keep Supabase dependency just for a few domain records. | Current app already works conceptually, so migration work delays feature polish. |

## What Is Better If We Stay With Supabase

| Better with Supabase | Why |
| --- | --- |
| Short-term velocity | You can immediately improve UI, bulk import, sorting, notifications, and provider handling without rewriting backend infrastructure. |
| Managed auth convenience | Google OAuth and session refresh are already handled by Supabase JS. |
| Built-in data isolation | RLS is a strong safety net if policies are correct. |
| Fewer custom backend decisions today | You do not need to design Worker routes, Better Auth schema, D1 migrations, or session middleware yet. |
| Easier debugging for current code | The app's README, services, and Edge Functions already explain the Supabase path. |

## What Is Better If We Migrate

| Better with Better Auth + D1 | Why |
| --- | --- |
| Better fit for a hobby app | A small domain tracker does not need the full Supabase platform. |
| Better alignment with Cloudflare deployment | Frontend, API routes, cron, secrets, and database can live in the Cloudflare ecosystem. |
| Better inactive-project ergonomics | D1/Workers are better suited to apps that may sit idle. |
| Simpler long-term mental model | One Worker backend owns auth, domain CRUD, WHOIS checks, imports, and cron. |
| More control | You are not tied to Supabase Auth/project lifecycle decisions. |
| Cleaner bulk workflow | D1 + Workers/Queues can support persistent import jobs and check history better than browser-side batching. |

## What Is Better With A Partial D1 Migration

| Better with Supabase Auth + D1 first | Why |
| --- | --- |
| Solves the current pain first | Your login works; your domain data/storage does not. |
| Lower migration risk | You avoid changing auth, database, API, WHOIS, and cron all in one step. |
| Faster path to Cloudflare dashboard control | Domain data moves to the dashboard you already prefer. |
| Easier self-healing | Workers can create/check tables, run schema assertions, and repair missing domain metadata workflows more directly. |
| Keeps future options open | After D1 works, you can either keep Supabase Auth or replace it with Better Auth. |

| Tradeoff | Detail |
| --- | --- |
| Two auth/data systems temporarily | Login remains Supabase while app data lives in D1. |
| Worker must verify Supabase identity | API routes need a reliable way to trust the current Supabase user/session. |
| Later Better Auth migration still exists | This path delays auth migration; it does not remove it unless you decide Supabase Auth is fine. |

## Complexity Comparison

| Task | Stay Supabase | Migrate to Better Auth + D1 |
| --- | --- | --- |
| Add dashboard summary | Easy | Easy after API exists |
| Fix sort bug | Easy | Easy |
| Improve bulk import UI | Easy | Easy |
| Make bulk import reliable server-side | Medium | Medium, but cleaner long-term |
| Add persistent notifications | Medium | Medium |
| Auth changes | Already done | Medium/high |
| Database migration | None | Medium |
| WHOIS route migration | None | Medium |
| Cron migration | None | Medium |
| Long-term maintenance | Medium, managed but platform-coupled | Medium, self-owned but simpler stack |

## My Recommendation

I would not spend energy fixing broken Supabase domain data unless the fix is trivial.

Your instinct is right: the app is simple enough that D1 is a better fit for the domain database. The core product is:

- user account
- list of domains
- WHOIS checks
- check history
- expiration/drop notifications
- bulk import/export

That maps cleanly to Cloudflare Workers + D1. Better Auth is still a good final auth target, but it does not need to be the first migration step if Supabase login is currently fine.

The smarter sequence is to stop using Supabase for domain storage first.

## Recommended Migration Plan

| Phase | Goal | Result |
| --- | --- | --- |
| 1 | Create D1 schema | Add domain, check history, import job, and notification tables. |
| 2 | Build Cloudflare Worker API | Add protected domain routes, WHOIS route, and cron/check route. |
| 3 | Keep Supabase Auth temporarily | Use existing session/user identity to authorize Worker API calls. |
| 4 | Switch domain service | Replace Supabase domain CRUD and `get-whois` function calls with Worker API calls. |
| 5 | Recover/import data | Rebuild domain rows from export, pasted list, or manual bulk add into D1. Do not waste energy on Supabase repair unless needed. |
| 6 | Stabilize D1 workflows | Add self-healing schema checks, import jobs, check history, and dashboard-level inspection. |
| 7 | Decide auth | Keep Supabase Auth if it remains painless, or migrate to Better Auth once D1 is stable. |

## Decision Table

| If this is true | Choose |
| --- | --- |
| You want the fastest path to usable features this week | Stay on Supabase for now |
| Supabase pausing/inactivity already frustrates you enough to stop using the app | Migrate |
| Login works but domain data is broken and annoying to fix | Migrate database/API to D1 first |
| You want to learn Cloudflare D1 and own the backend | Migrate |
| You want minimum backend code | Stay on Supabase |
| You want minimum platform complexity for a small tracker | Migrate |
| You want lowest immediate risk | Stay on Supabase |
| You want best long-term fit for this exact hobby app | Better Auth + D1 |

## Final Position

Best immediate choice: migrate the domain database/API to D1 while keeping Supabase Auth temporarily.

Best long-term choice: Cloudflare D1 for data, Cloudflare Workers for backend logic, and either Supabase Auth or Better Auth depending on how much auth ownership you want.

The migration is worth it because the broken part is the database side. Do not do a piecemeal auth swap first. Move the domain data and WHOIS workflows to D1, then decide whether Better Auth is still necessary.
