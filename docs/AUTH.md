# Auth Study And Better Auth Migration Guide

Last researched: 2026-06-03.

## Current Auth Implementation

Current auth is Supabase Google OAuth.

| File | Behavior |
| --- | --- |
| `src/services/supabaseService.ts` | Creates Supabase client from `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; exposes `getSession`, `signInWithGoogle`, `signOut`, and domain CRUD. |
| `src/components/Auth.tsx` | Shows a Google sign-in button and calls `signInWithGoogle()`. |
| `src/App.tsx` | Stores `Session | null`, calls `getSession`, subscribes to `supabase.auth.onAuthStateChange`, and gates dashboard/docs behind a session. |
| `src/components/Header.tsx` | Shows `session.user.email` and calls Supabase `signOut`. |
| `supabase/functions/get-whois/index.ts` | Uses Supabase Auth context to ensure only authenticated users can invoke WHOIS checks. |

Why Supabase feels heavy here:

- The app needs a small auth + database + cron backend, not a full managed Postgres platform.
- Supabase free/hobby policies can be inconvenient for inactive side projects.
- Current architecture spreads app behavior across frontend, Supabase DB, Supabase Auth, Supabase Edge Functions, and Supabase scheduler.

## Better Auth Fit

Better Auth is a TypeScript auth framework with email/password, social sign-on, session helpers, plugin ecosystem, and framework-agnostic handlers. Official docs show Cloudflare Workers support by routing `/api/auth/*` to `auth.handler(request)`. Docs also note Workers should enable `nodejs_compat` or `nodejs_als` compatibility flags for AsyncLocalStorage support.

Sources:

- https://better-auth.com/docs/installation
- https://better-auth.com/docs/basic-usage
- https://better-auth.com/docs/adapters/other-relational-databases
- https://better-auth.com/docs/concepts/database

## Migration Strategy

Do not swap only the login screen first. Supabase auth, data access, and WHOIS auth are coupled. Migrate auth together with the Worker API layer.

Recommended order:

1. Create Cloudflare Worker/Pages Functions backend.
2. Add Better Auth handler at `/api/auth/*`.
3. Configure Google social provider.
4. Generate/apply Better Auth D1 migrations.
5. Create D1 app tables from `docs/DB.md`.
6. Add protected domain API routes that read Better Auth session server-side.
7. Replace Supabase client service with an app API client.
8. Replace Supabase WHOIS function invocation with Worker route.
9. Remove Supabase dependency after export/import is complete.

## Better Auth Server Sketch

This is a direction sketch, not drop-in code for the current app.

```ts
import { betterAuth } from "better-auth";

export function createAuth(env: Env) {
  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
      },
    },
    // Configure D1/Kysely adapter here after choosing the exact adapter setup.
  });
}
```

Worker route shape:

```ts
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);
    const auth = createAuth(env);

    if (url.pathname.startsWith("/api/auth")) {
      return auth.handler(request);
    }

    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) return new Response("Unauthorized", { status: 401 });

    // Route protected domain APIs here.
    return new Response("Not found", { status: 404 });
  },
};
```

## Frontend Replacement

Replace Supabase session usage with Better Auth client.

Target frontend service:

```ts
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_AUTH_BASE_URL,
});
```

Usage direction:

- `authClient.useSession()` replaces `SupabaseService.getSession()` and `onAuthStateChange`.
- `authClient.signIn.social({ provider: "google" })` replaces Supabase Google OAuth.
- `authClient.signOut()` replaces Supabase sign-out.
- Domain CRUD should call `/api/domains`, not D1 directly from the browser.

## Authorization Rules

D1 has no Supabase-style RLS. Every Worker route must enforce:

```sql
WHERE user_id = ?
```

Never accept `user_id` from the browser for reads/writes. Always derive it from the Better Auth session.

## Environment Variables / Secrets

| Name | Where | Purpose |
| --- | --- | --- |
| `BETTER_AUTH_SECRET` | Worker secret | Auth encryption/signing secret. |
| `BETTER_AUTH_URL` | Worker env/secret | Public auth base URL. |
| `GOOGLE_CLIENT_ID` | Worker secret | Google OAuth client ID. |
| `GOOGLE_CLIENT_SECRET` | Worker secret | Google OAuth client secret. |
| WHOIS provider keys | Worker secrets | Server-only provider API keys. |
| `VITE_AUTH_BASE_URL` | Frontend env | Optional auth/API base URL if not same-origin. |

## Single-User Shortcut

If this remains only your private tracker, Better Auth can still be useful, but the data model can stay simpler. Keep multi-user-safe `user_id` columns anyway; it costs little and prevents a future migration.
