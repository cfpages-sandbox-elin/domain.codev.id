create table if not exists public.domain_monitoring_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default true,
  max_checks_per_run integer not null default 25 check (max_checks_per_run between 1 and 100),
  grace_interval_hours integer not null default 168 check (grace_interval_hours between 1 and 720),
  pre_drop_start_days integer not null default 45 check (pre_drop_start_days between 1 and 180),
  pre_drop_interval_hours integer not null default 24 check (pre_drop_interval_hours between 1 and 168),
  estimated_drop_days integer not null default 65 check (estimated_drop_days between 1 and 365),
  active_window_before_hours integer not null default 36 check (active_window_before_hours between 0 and 336),
  active_window_after_hours integer not null default 348 check (active_window_after_hours between 0 and 720),
  active_interval_minutes integer not null default 60 check (active_interval_minutes between 15 and 1440),
  post_window_interval_hours integer not null default 6 check (post_window_interval_hours between 1 and 168),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.domain_monitoring_settings enable row level security;

drop policy if exists "Users can read their monitoring settings" on public.domain_monitoring_settings;
drop policy if exists "Users can insert their monitoring settings" on public.domain_monitoring_settings;
drop policy if exists "Users can update their monitoring settings" on public.domain_monitoring_settings;

create policy "Users can read their monitoring settings"
  on public.domain_monitoring_settings for select to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert their monitoring settings"
  on public.domain_monitoring_settings for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their monitoring settings"
  on public.domain_monitoring_settings for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

revoke all on public.domain_monitoring_settings from anon;
grant select, insert, update on public.domain_monitoring_settings to authenticated;

comment on table public.domain_monitoring_settings is
  'Per-user quota-aware WHOIS target/drop scheduling policy.';
