create table if not exists public.integration_clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  token_hash text not null unique,
  scopes text[] not null default '{}'
    check (
      cardinality(scopes) > 0
      and scopes <@ array['domains:read', 'domains:write', 'whois:check', 'alerts:read', 'webhooks:write']::text[]
    ),
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.integration_events (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.integration_clients(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  idempotency_key text,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'received' check (status in ('received', 'processed', 'failed')),
  created_at timestamptz not null default now()
);

create table if not exists public.notification_channels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('webhook', 'hermes', 'whatsapp-cloud')),
  name text not null check (char_length(trim(name)) > 0),
  config jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  domain_id bigint references public.domains(id) on delete cascade,
  channel_id uuid references public.notification_channels(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  dedupe_key text not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'acknowledged')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  next_attempt_at timestamptz not null default now(),
  last_error text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  acknowledged_at timestamptz,
  unique (user_id, dedupe_key)
);

create index if not exists idx_integration_clients_user_id
  on public.integration_clients (user_id);

create index if not exists idx_integration_clients_token_hash
  on public.integration_clients (token_hash);

create index if not exists idx_integration_events_client_created
  on public.integration_events (client_id, created_at desc);

create unique index if not exists idx_integration_events_idempotency
  on public.integration_events (client_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists idx_notification_channels_user_id
  on public.notification_channels (user_id);

create index if not exists idx_notification_deliveries_due
  on public.notification_deliveries (status, next_attempt_at);

alter table public.integration_clients enable row level security;
alter table public.integration_events enable row level security;
alter table public.notification_channels enable row level security;
alter table public.notification_deliveries enable row level security;

drop policy if exists "Users can read their integration clients"
  on public.integration_clients;

drop policy if exists "Users can create their integration clients"
  on public.integration_clients;

drop policy if exists "Users can revoke their integration clients"
  on public.integration_clients;

drop policy if exists "Users can read their integration events"
  on public.integration_events;

drop policy if exists "Users can manage their notification channels"
  on public.notification_channels;

drop policy if exists "Users can read their notification deliveries"
  on public.notification_deliveries;

create policy "Users can read their integration clients"
  on public.integration_clients for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can create their integration clients"
  on public.integration_clients for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can revoke their integration clients"
  on public.integration_clients for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can read their integration events"
  on public.integration_events for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can manage their notification channels"
  on public.notification_channels for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can read their notification deliveries"
  on public.notification_deliveries for select
  to authenticated
  using (auth.uid() = user_id);

revoke all on public.integration_clients from anon;
revoke all on public.integration_events from anon;
revoke all on public.notification_channels from anon;
revoke all on public.notification_deliveries from anon;

comment on table public.integration_clients is
  'External API clients such as Hermes, n8n, scripts, or future apps. Only token hashes are stored.';

comment on table public.integration_events is
  'Audit and idempotency records for external integration API calls.';

comment on table public.notification_channels is
  'External notification targets, including Hermes or webhook adapters.';

comment on table public.notification_deliveries is
  'Durable notification delivery queue for expiry/drop/WHOIS alerts.';
