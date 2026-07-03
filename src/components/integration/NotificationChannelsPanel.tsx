import { useCallback, useEffect, useState } from 'react';
import { NotificationChannel, NotificationDelivery } from '../../types';
import * as SupabaseService from '../../services/supabaseService';
import { BellIcon, CheckCircleIcon, ExclamationTriangleIcon, TrashIcon } from '../icons';
import Spinner from '../Spinner';
import Tooltip from '../Tooltip';
import { useOutsideDismiss } from '../../hooks/useOutsideDismiss';

const generateSecret = () => {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(byte => byte.toString(16).padStart(2, '0')).join('');
};

const NotificationChannelsPanel = ({ addLog }: { addLog: (message: string) => void }) => {
  const [channels, setChannels] = useState<NotificationChannel[]>([]);
  const [deliveries, setDeliveries] = useState<NotificationDelivery[]>([]);
  const [name, setName] = useState('Hermes WhatsApp');
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isDeliveryHistoryOpen, setIsDeliveryHistoryOpen] = useState(false);
  const deliveryHistoryRef = useOutsideDismiss<HTMLDetailsElement>(isDeliveryHistoryOpen, () => setIsDeliveryHistoryOpen(false));

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const [nextChannels, nextDeliveries] = await Promise.all([
        SupabaseService.getNotificationChannels(),
        SupabaseService.getRecentNotificationDeliveries(),
      ]);
      setChannels(nextChannels);
      setDeliveries(nextDeliveries);
    } catch (error) {
      addLog(`❌ Could not load notification delivery settings: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoading(false);
    }
  }, [addLog]);

  useEffect(() => { void refresh(); }, [refresh]);

  const createChannel = async () => {
    if (!name.trim() || !/^https:\/\//i.test(url.trim())) {
      alert('Enter a name and an HTTPS webhook URL.');
      return;
    }
    setIsLoading(true);
    try {
      const channel = await SupabaseService.createNotificationChannel({
        name,
        type: 'hermes',
        url,
        secret: generateSecret(),
      });
      setChannels(current => [channel, ...current]);
      setUrl('');
      addLog(`✅ Enabled drop notifications through ${channel.name}.`);
    } catch (error) {
      alert(`Could not create notification channel: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleChannel = async (channel: NotificationChannel) => {
    await SupabaseService.setNotificationChannelEnabled(channel.id, !channel.enabled);
    setChannels(current => current.map(item => item.id === channel.id ? { ...item, enabled: !item.enabled } : item));
  };

  const removeChannel = async (channel: NotificationChannel) => {
    if (!window.confirm(`Delete ${channel.name}? Drop alerts will no longer be sent there.`)) return;
    await SupabaseService.removeNotificationChannel(channel.id);
    setChannels(current => current.filter(item => item.id !== channel.id));
  };

  return (
    <section className="space-y-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
      <div className="flex items-center gap-2">
        <BellIcon className="h-5 w-5 text-brand-blue" />
        <div>
          <h2 className="font-semibold text-slate-900 dark:text-white">Drop alert delivery</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Pushes exact detection time to a Hermes or automation webhook that sends your WhatsApp message.</p>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.4fr)_auto]">
        <input value={name} onChange={event => setName(event.target.value)} placeholder="Channel name" className="min-w-0 rounded-md border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
        <input value={url} onChange={event => setUrl(event.target.value)} inputMode="url" placeholder="https://your-hermes-webhook.example/..." className="min-w-0 rounded-md border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />
        <button type="button" onClick={createChannel} disabled={isLoading} className="rounded-md bg-brand-blue px-3 py-2 font-semibold text-white hover:bg-blue-600 disabled:opacity-50">Add channel</button>
      </div>

      {isLoading && channels.length === 0 ? <Spinner /> : channels.length === 0 ? (
        <p className="rounded-md border border-dashed border-amber-300 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">No delivery channel is configured. Integration API tokens do not send push alerts by themselves.</p>
      ) : (
        <div className="space-y-2">
          {channels.map(channel => (
            <div key={channel.id} className="flex items-center justify-between gap-3 rounded-md bg-slate-50 p-2 dark:bg-slate-950">
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-900 dark:text-white">{channel.name}</p>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">{channel.config.url}</p>
              </div>
              <div className="flex flex-none items-center gap-2">
                <label className="inline-flex items-center gap-1.5 text-xs">
                  <input type="checkbox" checked={channel.enabled} onChange={() => void toggleChannel(channel)} /> Enabled
                </label>
                <Tooltip content="Delete notification channel">
                  <button type="button" onClick={() => void removeChannel(channel)} className="rounded-full p-2 text-brand-red hover:bg-red-100 dark:hover:bg-red-950" aria-label={`Delete ${channel.name}`}><TrashIcon className="h-4 w-4" /></button>
                </Tooltip>
              </div>
            </div>
          ))}
        </div>
      )}

      {deliveries.length > 0 && (
        <details
          ref={deliveryHistoryRef}
          open={isDeliveryHistoryOpen}
          onToggle={event => setIsDeliveryHistoryOpen(event.currentTarget.open)}
        >
          <summary className="cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300">Recent delivery attempts ({deliveries.length})</summary>
          <ul className="mt-2 space-y-1.5">
            {deliveries.map(delivery => (
              <li key={delivery.id} className="flex items-start gap-2 rounded-md bg-slate-50 p-2 text-xs dark:bg-slate-950">
                {delivery.status === 'sent' ? <CheckCircleIcon className="h-4 w-4 flex-none text-green-600" /> : <ExclamationTriangleIcon className="h-4 w-4 flex-none text-amber-600" />}
                <span><strong>{delivery.event_type}</strong> · {delivery.status} · {new Date(delivery.sent_at || delivery.created_at).toLocaleString()}{delivery.last_error ? ` · ${delivery.last_error}` : ''}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
};

export default NotificationChannelsPanel;
