# External Integrations Plan

Last updated: 2026-07-02 WIB

This document plans how Hermes Agent, WhatsApp, and future external apps should talk to this domain tracker.

## Progress Tracker

| Status | Phase | Updated | Notes |
| --- | --- | --- | --- |
| ✅ Implemented | Integration tables | 2026-06-04 WIB | Added `integration_clients`, `integration_events`, `notification_channels`, and `notification_deliveries` migration. |
| ✅ Implemented | App-owned API function | 2026-06-04 WIB | Added `supabase/functions/external-api` with scoped bearer-token auth, idempotency records, domain listing, domain add, WHOIS recheck, and computed due-alert read endpoints. |
| ✅ Implemented | Dashboard token management | 2026-06-04 WIB | Added an Integration API modal for creating/revoking tokens. Raw tokens are generated in-browser and shown once; only SHA-256 hashes are stored. The modal also shows a copyable Hermes setup prompt with the API base URL and new token. |
| ✅ Implemented | Alert support | 2026-07-02 WIB | Polling alert endpoints remain available; `check-domains` now queues deduplicated drop deliveries with detection timestamps and dispatches/retries them to enabled Hermes/webhook channels. |
| ⬜ Pending | Webhook registration endpoints | 2026-06-04 WIB | Tables exist, but `/api/v1/webhooks` is not implemented yet. |
| ✅ Implemented | Notification dispatcher | 2026-07-02 WIB | `check-domains` dispatches pending/failed deliveries on every cron invocation with exponential retry. Channel setup and recent delivery status are exposed in Integration API settings. |
| ⬜ Pending | Hermes-side skill/prompt | 2026-06-04 WIB | This app now exposes the API Hermes needs, but Hermes still needs tool/prompt configuration. |

## Goal

Expose a small, secure integration layer so other apps can:

- add one or many domains
- ask for current domain status
- trigger safe WHOIS refreshes
- receive expiring-domain alerts
- send notification delivery results back to this app

Hermes Agent should be one integration client, not a special case. WhatsApp should be treated as a notification and command channel owned by Hermes or a WhatsApp provider.

## Current State

| Area | Current implementation | Integration gap |
| --- | --- | --- |
| Auth | Supabase Google OAuth for browser users. | External apps cannot use a browser session. |
| External auth | `integration_clients` stores scoped token hashes for external clients. | Token UI exists; token rotation/reissue history can be improved later. |
| Domain CRUD | Browser still uses `src/services/supabaseService.ts`; external clients use `external-api`. | Update/delete endpoints are not exposed externally yet. |
| WHOIS checks | Browser uses `get-whois`; external clients can use `POST /api/v1/domains/recheck`. | Broad recheck policy may need stricter cost previews later. |
| Scheduled checks | `check-domains` Supabase Edge Function uses `CRON_SECRET`. | It updates data, but does not yet enqueue durable external notification deliveries. |
| Notifications | Browser-only in-app notification state plus computed external due-alert endpoint. | No durable notification dispatcher yet. |

## Hermes And WhatsApp Findings

Hermes can connect to WhatsApp through either a WhatsApp Web bridge or the Meta Business API. The Hermes guide recommends the WhatsApp Web bridge for personal/free use and Meta Business API for production-style outbound messaging. Hermes also exposes an OpenAI-compatible API server with bearer-token auth, plus a jobs API for scheduled/background agent runs.

Practical implication:

- Use Hermes as the WhatsApp interface and natural-language interpreter.
- Do not make this app depend on Hermes internals.
- Give Hermes a normal API key for this app.
- Let Hermes call this app when you say: "add filtrasi.com as mine".
- Let this app call a Hermes webhook or a notification webhook when a domain is close to expiry.

## Recommended Architecture

```text
WhatsApp
  |
  v
Hermes Agent
  |
  | Bearer token / signed requests
  v
Domain Codev Integration API
  |
  +-- Supabase Auth/DB/Edge Functions today
  |
  +-- Cloudflare Worker + D1 later
```

Outbound alerts should use the opposite direction:

```text
check-domains scheduled function
  |
  v
notification queue
  |
  v
webhook delivery adapter
  |
  +-- Hermes webhook/API -> WhatsApp message
  +-- n8n webhook
  +-- direct WhatsApp Cloud API later
```

This keeps the project reusable. Hermes, n8n, a mobile shortcut, a CLI script, or a future browser extension can all use the same API.

## Integration API Shape

Use versioned HTTP endpoints. The public shape should stay the same even if the backend moves from Supabase to D1.

Base path:

```text
/api/v1
```

### Authentication

Start with per-client API tokens.

```http
Authorization: Bearer dcv_live_...
Idempotency-Key: optional-client-generated-id
```

Token rules:

- store only a token hash in the database
- support scopes
- support optional expiration
- allow revoke/rotate
- never expose Supabase service role keys to Hermes or any external app

Recommended scopes:

| Scope | Allows |
| --- | --- |
| `domains:read` | List and inspect domains. |
| `domains:write` | Add, update, and delete domains. |
| `whois:check` | Trigger WHOIS refreshes. |
| `alerts:read` | Read pending alert state. |
| `webhooks:write` | Register or update webhook targets. |

### Add Domains

```http
POST /api/v1/domains
```

```json
{
  "domains": [
    { "domainName": "filtrasi.com", "tag": "mine" },
    { "domainName": "precast.id", "tag": "to-snatch" },
    { "domainName": "clientbrand.id", "tag": "others" }
  ],
  "source": "hermes-whatsapp",
  "checkWhois": true
}
```

Response:

```json
{
  "created": [
    {
      "domainName": "filtrasi.com",
      "status": "registered",
      "expirationDate": "2026-06-14",
      "tag": "mine"
    }
  ],
  "skipped": [],
  "failed": []
}
```

Rules:

- normalize domains the same way the UI bulk modal does
- dedupe against existing user domains
- available domains must be saved as `to-snatch`
- if WHOIS fails, still save the row as `unknown`
- support idempotency so Hermes can retry without creating duplicates

Implementation status: ✅ implemented in `supabase/functions/external-api/index.ts`.

### List Domains

```http
GET /api/v1/domains?filter=expiring-soon
```

Useful filters:

- `all`
- `mine`
- `to-snatch`
- `others`
- `available`
- `missing-data`
- `expiring-soon`

Implementation status: ✅ implemented in `supabase/functions/external-api/index.ts`.

### Recheck Domains

```http
POST /api/v1/domains/recheck
```

```json
{
  "mode": "missing-data",
  "domains": ["filtrasi.com"],
  "reason": "requested-by-hermes"
}
```

Rules:

- use the same quota-aware WHOIS waterfall as the dashboard
- cap batch size
- return provider attempts and retry guidance
- reject broad rechecks unless the client has `whois:check`

Implementation status: ✅ implemented for named domains and `missing-data` mode in `supabase/functions/external-api/index.ts`.

### Pending Alerts

```http
GET /api/v1/alerts/due
```

Returns alerts that have not been delivered or acknowledged.

```json
{
  "alerts": [
    {
      "id": "alert_123",
      "domainName": "example.com",
      "tag": "mine",
      "severity": "renew-soon",
      "expirationDate": "2026-06-14",
      "message": "example.com expires on 14 June 2026."
    }
  ]
}
```

### Exact Target Drop Alert

```http
GET /api/v1/alerts/drop/{domainName}
```

Returns the current drop-watch alert for one tracked `to-snatch` domain, including estimated drop timing when an expiry or registration timestamp is available.

```json
{
  "domain": {
    "domainName": "target.example",
    "tag": "to-snatch",
    "status": "expired"
  },
  "alert": {
    "event": "domain.dropping-now",
    "severity": "drop-window-now",
    "dropTiming": {
      "estimatedDropAt": "2026-08-09T14:30:00.000Z",
      "windowStart": "2026-08-09T02:30:00.000Z",
      "windowEnd": "2026-08-10T02:30:00.000Z",
      "confidence": "expiry-time"
    }
  }
}
```

Implementation status: ✅ implemented in `supabase/functions/external-api/index.ts`.

### Acknowledge Alerts

```http
POST /api/v1/alerts/{alertId}/ack
```

Use this when Hermes confirms the WhatsApp message was sent or when you reply "done".

Implementation status: ⬜ pending.

## Webhook Delivery

External apps can register webhook targets for alerts.

```http
POST /api/v1/webhooks
```

```json
{
  "name": "Hermes WhatsApp",
  "url": "https://hermes.example.com/domain-codev/webhook",
  "events": ["domain.expiring", "domain.dropped", "whois.failed"]
}
```

Outgoing webhook request:

```http
POST https://hermes.example.com/domain-codev/webhook
X-Domain-Codev-Event: domain.expiring
X-Domain-Codev-Timestamp: 2026-06-04T09:00:00+07:00
X-Domain-Codev-Signature: sha256=...
Idempotency-Key: evt_...
```

```json
{
  "event": "domain.expiring",
  "domain": {
    "domainName": "example.com",
    "tag": "mine",
    "status": "registered",
    "expirationDate": "2026-06-14",
    "daysUntilExpiry": 10
  },
  "recommendedAction": "Renew this domain before the expiry date."
}
```

Signature:

```text
sha256_hmac(webhook_secret, timestamp + "." + raw_body)
```

Delivery rules:

- retry failed deliveries with backoff
- store delivery attempts
- avoid sending the same alert repeatedly
- include idempotency keys
- keep payloads small and predictable

Implementation status: ⬜ pending. Tables exist, but registration and dispatch endpoints are not implemented yet.

## WhatsApp Notification Options

| Option | How it works | Pros | Cons | Recommendation |
| --- | --- | --- | --- | --- |
| Hermes WhatsApp Web bridge | This app sends an alert webhook to Hermes; Hermes sends WhatsApp through its linked session. | Good for personal hobby use, likely cheapest, simple mental model. | Depends on WhatsApp Web session/phone stability; less production-grade. | Best first path. |
| Hermes Meta Business API | Hermes handles Meta WhatsApp Business API delivery. | Better for production-style messaging and managed routing. | Requires Meta setup and may involve templates/rules. | Good later if Web bridge is unreliable. |
| Direct Meta WhatsApp Cloud API from this app | This app stores Meta credentials and sends messages directly. | No Hermes dependency for alerts. | Adds WhatsApp-specific complexity, template rules, webhook verification, and token management. | Avoid at first. |
| n8n / automation webhook | This app calls n8n; n8n sends WhatsApp via a provider. | Flexible and visual. | Another moving part. | Optional if you already use n8n. |

## Hermes Command Design

Hermes should translate natural language into explicit API calls.

Examples:

| WhatsApp message | API action |
| --- | --- |
| `add filtrasi.com as mine` | `POST /api/v1/domains` with one `mine` domain. |
| `track precast.id to snatch` | `POST /api/v1/domains` with one `to-snatch` domain. |
| `track clientbrand.id as client domain` | `POST /api/v1/domains` with one `others` domain. |
| `add these as mine: a.com b.id c.co.id` | `POST /api/v1/domains` bulk request. |
| `what expires this month?` | `GET /api/v1/domains?filter=expiring-soon`. |
| `recheck missing data` | `POST /api/v1/domains/recheck` with `mode: missing-data`. |
| `mark example.com renewed` | update domain only after confirmation, or recheck WHOIS first. |

Hermes should confirm destructive or quota-heavy actions:

- deleting domains
- rechecking all domains
- changing `mine` to `to-snatch`
- broad bulk imports

## Data Model Additions

For Supabase now, these can be Postgres tables. For D1 later, the same model maps cleanly to SQLite.

### `integration_clients`

| Column | Purpose |
| --- | --- |
| `id` | Primary key. |
| `user_id` | Owner Supabase user ID. |
| `name` | Example: `Hermes WhatsApp`. |
| `token_hash` | Hash of API token. |
| `scopes` | Text array or JSON list. |
| `last_used_at` | Audit/debugging. |
| `expires_at` | Optional expiration. |
| `revoked_at` | Token revocation. |
| `created_at` | Creation time. |

### `integration_events`

| Column | Purpose |
| --- | --- |
| `id` | Event ID. |
| `client_id` | Client that caused or received event. |
| `event_type` | Example: `domain.created`, `domain.expiring`. |
| `idempotency_key` | Deduplication key. |
| `payload` | JSON payload. |
| `status` | `received`, `processed`, `failed`. |
| `created_at` | Creation time. |

### `notification_channels`

| Column | Purpose |
| --- | --- |
| `id` | Channel ID. |
| `user_id` | Owner user ID. |
| `type` | `webhook`, `hermes`, `whatsapp-cloud`. |
| `name` | Display name. |
| `config` | Encrypted/sealed JSON config. |
| `enabled` | Whether delivery is active. |
| `created_at` | Creation time. |

### `notification_deliveries`

| Column | Purpose |
| --- | --- |
| `id` | Delivery ID. |
| `domain_id` | Related domain. |
| `channel_id` | Delivery channel. |
| `event_type` | Alert event. |
| `dedupe_key` | Prevent repeated alerts. |
| `status` | `pending`, `sent`, `failed`, `acknowledged`. |
| `attempt_count` | Retry count. |
| `next_attempt_at` | Retry scheduling. |
| `last_error` | Last delivery error. |
| `created_at` | Creation time. |
| `sent_at` | Sent time. |
| `acknowledged_at` | Acknowledged time. |

## Alert Rules

Use the existing targeted expiry logic, but separate "WHOIS refresh" from "notify user".

For `mine` domains:

- notify at 30 days before expiry
- notify at 14 days
- notify at 7 days
- notify daily from 3 days before expiry until acknowledged or renewed
- message should say renew, not buy/snatch

For `to-snatch` domains:

- notify when entering the expiry month
- notify at 14 days and 7 days before expiry
- notify daily after expiry during likely grace/redemption period
- notify every 3 hours only near estimated drop window if this project can afford quota
- message should say prepare/watch, not renew

Deduplication examples:

```text
domain:{domain_id}:mine:expires_in_30
domain:{domain_id}:mine:expires_in_7
domain:{domain_id}:snatch:drop_window:2026-08-12
```

## Supabase-First Implementation Plan

### Phase 1: App-Owned API

Create a Supabase Edge Function, for example:

```text
supabase/functions/external-api/index.ts
```

It should:

- authenticate API tokens from `integration_clients`
- route `/api/v1/domains`, `/api/v1/domains/recheck`, `/api/v1/alerts/due`
- reuse shared WHOIS logic
- write events for idempotency and audit
- return small JSON responses suitable for agents

Status: ✅ implemented for core domain and alert polling endpoints.

### Phase 2: Token Management In Dashboard

Add a small settings panel:

- create integration token
- choose scopes
- copy token once
- revoke token
- show last used time

For now this can be admin-only for the logged-in user.

Status: ✅ implemented with the Integration API modal.

The modal also generates a copyable Hermes setup prompt immediately after token creation. Use it as the fastest path to wire Hermes into this app without manually rewriting endpoint details.

### Phase 3: Alert Queue

Extend `check-domains`:

- after deciding/update-checking domains, create pending notification deliveries
- do not send WhatsApp directly inside the WHOIS update loop
- keep delivery state durable

Status: ✅ implemented for confirmed `domain.dropped` transitions. Other expiry/reminder event types remain future work.

### Phase 4: Webhook Dispatcher

Create another scheduled function:

```text
supabase/functions/dispatch-notifications/index.ts
```

It should:

- read pending notification deliveries
- send signed webhooks to Hermes/n8n/other apps
- retry with backoff
- mark sent/failed

Status: ⬜ pending.

### Phase 5: Hermes Skill Or Prompt

Configure Hermes with:

- `DOMAIN_CODEV_API_URL`
- `DOMAIN_CODEV_API_TOKEN`
- optional `DOMAIN_CODEV_WEBHOOK_SECRET`

Hermes tool behavior:

1. Parse WhatsApp command.
2. Validate domain names locally.
3. Call Domain Codev API.
4. Summarize created/skipped/failed domains back to WhatsApp.
5. For alerts, receive webhook and send concise WhatsApp message.

Status: ⬜ pending on the Hermes side. The app API token and endpoint are now available from the dashboard modal.

## Later Cloudflare/D1 Version

When migrating to Cloudflare:

- keep the same `/api/v1` contract
- move API routes to Cloudflare Workers
- move tables to D1
- use Worker Cron Triggers for alert queue and dispatch
- use Workers Secrets for webhook secrets
- keep Hermes unchanged except for `DOMAIN_CODEV_API_URL`

This is why the integration API should not expose Supabase-specific names or assumptions.

## Security Checklist

- API tokens are hashed at rest.
- Tokens have scopes.
- Webhook payloads are HMAC-signed.
- Incoming webhook timestamps expire after 5 minutes.
- Every write endpoint supports idempotency.
- Every bulk endpoint has a max item count.
- WHOIS-triggering endpoints enforce quota caps.
- CORS remains browser-only and narrow.
- Service role keys never leave server functions.
- Logs never print tokens, webhook secrets, or WhatsApp tokens.

## Recommendation

Implement this as an app-owned REST plus webhook integration layer.

For the first version, do not integrate direct WhatsApp Cloud API into this app. Let Hermes handle WhatsApp because it already supports WhatsApp, allowed contacts, and agent command parsing. This app should own domains, WHOIS, alerts, and secure API contracts.

The first useful milestone is:

1. `external-api` Edge Function with `POST /api/v1/domains`.
2. API token table with one Hermes token.
3. Hermes WhatsApp command: "add example.com as mine".
4. Notification queue for expiring `mine` domains.
5. Signed webhook from this app to Hermes for WhatsApp delivery.

## Sources

- Hermes WhatsApp integration: https://hermes-agent.ai/integrations/whatsapp
- Hermes WhatsApp setup guide: https://hermes-agent.ai/how-to/connect-whatsapp-to-hermes
- Hermes webhook integration: https://hermes-agent.ai/integrations/webhooks
- Hermes API server docs: https://hermes.dhuar.com/en/user-guide/features/api-server/
- Meta WhatsApp Cloud API overview/reference index: https://www.postman.com/meta/workspace/whatsapp-business-platform/documentation/13382743-84d01ff8-4253-4720-b454-af661f36acc2
