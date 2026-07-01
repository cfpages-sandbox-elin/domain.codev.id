import { Domain, DomainStatus } from './scheduler.ts';

type SupabaseAdmin = any;

interface NotificationChannel {
  id: string;
  user_id: string;
  type: 'webhook' | 'hermes' | 'whatsapp-cloud';
  config: Record<string, unknown>;
  enabled: boolean;
}

interface NotificationDelivery {
  id: string;
  channel_id: string;
  event_type: string;
  dedupe_key: string;
  attempt_count: number;
  payload: Record<string, unknown>;
}

const encoder = new TextEncoder();

const hex = (buffer: ArrayBuffer) => Array.from(new Uint8Array(buffer))
  .map(byte => byte.toString(16).padStart(2, '0'))
  .join('');

const signPayload = async (secret: string, timestamp: string, body: string) => {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return hex(await crypto.subtle.sign('HMAC', key, encoder.encode(`${timestamp}.${body}`)));
};

export const enqueueDropNotifications = async (
  supabaseAdmin: SupabaseAdmin,
  domain: Domain,
  newStatus: DomainStatus,
  detectedAt: string,
) => {
  if (domain.tag !== 'to-snatch' || (newStatus !== 'available' && newStatus !== 'dropped')) return 0;

  const { data: channels, error: channelError } = await supabaseAdmin
    .from('notification_channels')
    .select('id, user_id, type, config, enabled')
    .eq('user_id', domain.user_id)
    .eq('enabled', true);
  if (channelError) throw channelError;

  const payload = {
    event: 'domain.dropped',
    detectedAt,
    domain: {
      id: domain.id,
      domainName: domain.domain_name,
      tag: domain.tag,
      previousStatus: domain.status,
      status: newStatus,
      expirationDate: domain.expiration_date,
    },
    message: `${domain.domain_name} became available at ${detectedAt}. Attempt registration now.`,
    recommendedAction: 'Open your registrar immediately and attempt registration.',
  };

  const deliveries = ((channels || []) as NotificationChannel[]).map(channel => ({
    domain_id: domain.id,
    channel_id: channel.id,
    user_id: domain.user_id,
    event_type: 'domain.dropped',
    dedupe_key: `domain:${domain.id}:dropped:${domain.expiration_date || 'unknown'}`,
    payload,
  }));
  if (deliveries.length === 0) return 0;

  const { error } = await supabaseAdmin
    .from('notification_deliveries')
    .upsert(deliveries, { onConflict: 'channel_id,dedupe_key', ignoreDuplicates: true });
  if (error) throw error;
  return deliveries.length;
};

const sendWebhook = async (channel: NotificationChannel, delivery: NotificationDelivery) => {
  const url = typeof channel.config.url === 'string' ? channel.config.url : '';
  if (!/^https:\/\//i.test(url)) throw new Error('Notification channel requires an HTTPS webhook URL.');

  const body = JSON.stringify(delivery.payload);
  const timestamp = new Date().toISOString();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Domain-Codev-Event': delivery.event_type,
    'X-Domain-Codev-Timestamp': timestamp,
    'Idempotency-Key': delivery.dedupe_key,
  };
  if (typeof channel.config.secret === 'string' && channel.config.secret) {
    headers['X-Domain-Codev-Signature'] = `sha256=${await signPayload(channel.config.secret, timestamp, body)}`;
  }

  const response = await fetch(url, { method: 'POST', headers, body });
  if (!response.ok) throw new Error(`Webhook returned HTTP ${response.status}.`);
};

export const dispatchPendingNotifications = async (supabaseAdmin: SupabaseAdmin, limit = 25) => {
  const now = new Date();
  const { data: deliveries, error } = await supabaseAdmin
    .from('notification_deliveries')
    .select('id, channel_id, event_type, dedupe_key, attempt_count, payload')
    .in('status', ['pending', 'failed'])
    .lte('next_attempt_at', now.toISOString())
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error) throw error;
  if (!deliveries?.length) return { sent: 0, failed: 0 };

  const channelIds = Array.from(new Set((deliveries as NotificationDelivery[]).map(item => item.channel_id)));
  const { data: channels, error: channelError } = await supabaseAdmin
    .from('notification_channels')
    .select('id, user_id, type, config, enabled')
    .in('id', channelIds);
  if (channelError) throw channelError;
  const channelById = new Map(((channels || []) as NotificationChannel[]).map(channel => [channel.id, channel]));

  let sent = 0;
  let failed = 0;
  for (const delivery of deliveries as NotificationDelivery[]) {
    const channel = channelById.get(delivery.channel_id);
    try {
      if (!channel?.enabled) throw new Error('Notification channel is disabled or missing.');
      if (channel.type === 'whatsapp-cloud') throw new Error('Direct WhatsApp Cloud delivery is not configured; use a Hermes/webhook channel.');
      await sendWebhook(channel, delivery);
      await supabaseAdmin.from('notification_deliveries').update({
        status: 'sent',
        attempt_count: delivery.attempt_count + 1,
        last_error: null,
        sent_at: new Date().toISOString(),
      }).eq('id', delivery.id);
      sent += 1;
    } catch (deliveryError) {
      const attemptCount = delivery.attempt_count + 1;
      const retryMinutes = Math.min(5 * (2 ** Math.min(attemptCount - 1, 6)), 360);
      await supabaseAdmin.from('notification_deliveries').update({
        status: 'failed',
        attempt_count: attemptCount,
        last_error: deliveryError instanceof Error ? deliveryError.message : String(deliveryError),
        next_attempt_at: new Date(Date.now() + retryMinutes * 60 * 1000).toISOString(),
      }).eq('id', delivery.id);
      failed += 1;
    }
  }
  return { sent, failed };
};
