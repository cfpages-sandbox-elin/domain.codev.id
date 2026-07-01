alter table public.notification_deliveries
  drop constraint if exists notification_deliveries_user_id_dedupe_key_key;

create unique index if not exists idx_notification_deliveries_channel_dedupe
  on public.notification_deliveries (channel_id, dedupe_key);
