create table if not exists public.whois_provider_telemetry (
  provider_id text primary key,
  month_key text not null,
  estimated_month_used integer not null default 0 check (estimated_month_used >= 0),
  recent_starts timestamptz[] not null default '{}',
  blocked_until timestamptz,
  block_reason text,
  quota jsonb,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.whois_provider_telemetry enable row level security;

create index if not exists idx_whois_provider_telemetry_blocked_until
  on public.whois_provider_telemetry (blocked_until);

create or replace function public.claim_whois_provider_attempt(
  p_provider_id text,
  p_month_key text,
  p_per_minute_limit integer default null,
  p_monthly_limit integer default null
)
returns table (
  allowed boolean,
  reason text,
  retry_after timestamptz,
  estimated_month_used integer,
  recent_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_row public.whois_provider_telemetry%rowtype;
  v_recent timestamptz[];
  v_retry_after timestamptz;
begin
  insert into public.whois_provider_telemetry (provider_id, month_key)
  values (p_provider_id, p_month_key)
  on conflict (provider_id) do nothing;

  select *
    into v_row
    from public.whois_provider_telemetry
   where provider_id = p_provider_id
   for update;

  if v_row.month_key <> p_month_key then
    update public.whois_provider_telemetry
       set month_key = p_month_key,
           estimated_month_used = 0,
           recent_starts = '{}',
           blocked_until = null,
           block_reason = null,
           quota = null,
           updated_at = v_now
     where provider_id = p_provider_id
     returning * into v_row;
  end if;

  select coalesce(array_agg(started_at order by started_at), '{}'::timestamptz[])
    into v_recent
    from unnest(coalesce(v_row.recent_starts, '{}'::timestamptz[])) as recent(started_at)
   where started_at > v_now - interval '1 minute';

  if v_row.blocked_until is not null and v_row.blocked_until > v_now then
    update public.whois_provider_telemetry
       set recent_starts = v_recent,
           updated_at = v_now
     where provider_id = p_provider_id;

    allowed := false;
    reason := coalesce(v_row.block_reason, 'Provider is temporarily blocked.');
    retry_after := v_row.blocked_until;
    estimated_month_used := v_row.estimated_month_used;
    recent_count := cardinality(v_recent);
    return next;
    return;
  end if;

  if p_per_minute_limit is not null and cardinality(v_recent) >= p_per_minute_limit then
    select min(started_at) + interval '1 minute'
      into v_retry_after
      from unnest(v_recent) as recent(started_at);

    update public.whois_provider_telemetry
       set recent_starts = v_recent,
           updated_at = v_now
     where provider_id = p_provider_id;

    allowed := false;
    reason := 'Provider per-minute limit reached.';
    retry_after := v_retry_after;
    estimated_month_used := v_row.estimated_month_used;
    recent_count := cardinality(v_recent);
    return next;
    return;
  end if;

  if p_monthly_limit is not null and v_row.estimated_month_used >= p_monthly_limit then
    v_retry_after := date_trunc('month', v_now) + interval '1 month';

    update public.whois_provider_telemetry
       set recent_starts = v_recent,
           blocked_until = v_retry_after,
           block_reason = 'Provider monthly free-tier estimate is exhausted.',
           updated_at = v_now
     where provider_id = p_provider_id;

    allowed := false;
    reason := 'Provider monthly free-tier estimate is exhausted.';
    retry_after := v_retry_after;
    estimated_month_used := v_row.estimated_month_used;
    recent_count := cardinality(v_recent);
    return next;
    return;
  end if;

  v_recent := array_append(v_recent, v_now);

  update public.whois_provider_telemetry
     set recent_starts = v_recent,
         estimated_month_used = v_row.estimated_month_used + 1,
         blocked_until = null,
         block_reason = null,
         last_used_at = v_now,
         updated_at = v_now
   where provider_id = p_provider_id
   returning * into v_row;

  allowed := true;
  reason := null;
  retry_after := null;
  estimated_month_used := v_row.estimated_month_used;
  recent_count := cardinality(v_recent);
  return next;
end;
$$;

revoke all on public.whois_provider_telemetry from anon, authenticated;
revoke execute on function public.claim_whois_provider_attempt(text, text, integer, integer) from anon, authenticated;

comment on table public.whois_provider_telemetry is
  'Server-side WHOIS provider quota/rate-limit telemetry used to skip exhausted providers across Edge Function instances.';
