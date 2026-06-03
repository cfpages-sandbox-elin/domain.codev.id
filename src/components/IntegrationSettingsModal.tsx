import React, { useEffect, useMemo, useState } from 'react';
import { IntegrationClient, IntegrationScope } from '../types';
import * as SupabaseService from '../services/supabaseService';
import Modal from './Modal';
import Spinner from './Spinner';
import Tooltip from './Tooltip';
import { CheckCircleIcon, CommandLineIcon, CopyIcon, TrashIcon } from './icons';

interface IntegrationSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  addLog: (message: string) => void;
}

const ALL_SCOPES: Array<{ scope: IntegrationScope; label: string; description: string }> = [
  { scope: 'domains:read', label: 'Read domains', description: 'List and inspect tracked domains.' },
  { scope: 'domains:write', label: 'Add domains', description: 'Create domains from external clients.' },
  { scope: 'whois:check', label: 'Re-check WHOIS', description: 'Trigger quota-aware WHOIS refreshes.' },
  { scope: 'alerts:read', label: 'Read alerts', description: 'Read computed expiry/drop alerts.' },
  { scope: 'webhooks:write', label: 'Manage webhooks', description: 'Reserved for webhook channel setup.' },
];

const DEFAULT_SCOPES: IntegrationScope[] = ['domains:read', 'domains:write', 'whois:check', 'alerts:read'];

const generateToken = () => {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const body = Array.from(bytes)
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
  return `dcv_live_${body}`;
};

const sha256Hex = async (value: string) => {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
};

const formatDateTime = (value: string | null) => {
  if (!value) return 'Never';
  return new Date(value).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getApiBaseUrl = () => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!supabaseUrl) return '/functions/v1/external-api/api/v1';
  return `${supabaseUrl.replace(/\/$/, '')}/functions/v1/external-api/api/v1`;
};

const IntegrationSettingsModal: React.FC<IntegrationSettingsModalProps> = ({ isOpen, onClose, addLog }) => {
  const [clients, setClients] = useState<IntegrationClient[]>([]);
  const [name, setName] = useState('Hermes WhatsApp');
  const [selectedScopes, setSelectedScopes] = useState<IntegrationScope[]>(DEFAULT_SCOPES);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const apiBaseUrl = useMemo(getApiBaseUrl, []);

  const activeClients = clients.filter(client => !client.revoked_at);
  const revokedClients = clients.filter(client => client.revoked_at);

  const refreshClients = async () => {
    setIsLoading(true);
    const data = await SupabaseService.getIntegrationClients();
    if (data) {
      setClients(data);
      addLog(`✅ Loaded ${data.length} integration client(s).`);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      void refreshClients();
    }
  }, [isOpen]);

  const toggleScope = (scope: IntegrationScope) => {
    setSelectedScopes(current => current.includes(scope)
      ? current.filter(item => item !== scope)
      : [...current, scope]);
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      alert('Integration name is required.');
      return;
    }
    if (selectedScopes.length === 0) {
      alert('Choose at least one scope.');
      return;
    }

    setIsLoading(true);
    const token = generateToken();
    const tokenHash = await sha256Hex(token);
    const created = await SupabaseService.createIntegrationClient({
      name,
      tokenHash,
      scopes: selectedScopes,
    });

    if (created) {
      setNewToken(token);
      setClients(current => [created, ...current]);
      addLog(`✅ Created integration token for ${created.name}.`);
    }
    setIsLoading(false);
  };

  const handleRevoke = async (client: IntegrationClient) => {
    const confirmed = window.confirm(`Revoke integration token for ${client.name}? Existing clients using it will stop working.`);
    if (!confirmed) return;

    setIsLoading(true);
    const revoked = await SupabaseService.revokeIntegrationClient(client.id);
    if (revoked) {
      setClients(current => current.map(item => item.id === revoked.id ? revoked : item));
      addLog(`✅ Revoked integration token for ${client.name}.`);
    }
    setIsLoading(false);
  };

  const copy = async (value: string, label: string, key: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(current => current === key ? null : current), 1800);
      addLog(`✅ Copied ${label}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      addLog(`❌ Failed to copy ${label}: ${message}`);
      alert(`Could not copy ${label}. Please copy it manually.`);
    }
  };

  const curlExample = `curl -X POST "${apiBaseUrl}/domains" \\
  -H "Authorization: Bearer ${newToken || 'dcv_live_...'}" \\
  -H "Content-Type: application/json" \\
  -d "{\"domains\":[{\"domainName\":\"example.com\",\"tag\":\"mine\"}],\"source\":\"hermes-whatsapp\"}"`;

  const hermesPrompt = `You are connected to my Domain Codev domain tracker.

Use this API for domain tracking actions:
API_BASE_URL=${apiBaseUrl}
API_TOKEN=${newToken || 'dcv_live_...'}

Authentication:
- Send every request with: Authorization: Bearer ${newToken || 'dcv_live_...'}
- Send JSON requests with: Content-Type: application/json

Available actions:
1. Add domain:
POST {API_BASE_URL}/domains
Body:
{
  "domains": [
    { "domainName": "example.com", "tag": "mine" }
  ],
  "source": "hermes-whatsapp",
  "checkWhois": true
}

2. Add target/to-snatch domain:
POST {API_BASE_URL}/domains
Body:
{
  "domains": [
    { "domainName": "example.com", "tag": "to-snatch" }
  ],
  "source": "hermes-whatsapp",
  "checkWhois": true
}

3. List domains:
GET {API_BASE_URL}/domains?filter=all
Useful filters: all, mine, to-snatch, available, missing-data, expiring-soon.

4. Recheck missing WHOIS data:
POST {API_BASE_URL}/domains/recheck
Body:
{
  "mode": "missing-data",
  "reason": "requested-by-hermes"
}

5. Read due alerts:
GET {API_BASE_URL}/alerts/due

Behavior rules:
- When I say "add DOMAIN as mine", call the add-domain endpoint with tag "mine".
- When I say "track DOMAIN", "watch DOMAIN", or "to snatch DOMAIN", use tag "to-snatch".
- Confirm before deleting, changing ownership/tag, or doing broad rechecks.
- Never expose the API token in WhatsApp messages.
- Summarize API results briefly: created, skipped, failed, status, and expiry date if present.
- If WHOIS is unknown or missing data, tell me the domain was saved and can be rechecked later.`;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Integration API">
      <div className="space-y-5 text-sm text-slate-700 dark:text-slate-300">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950">
          <div className="mb-2 flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
            <CommandLineIcon className="h-5 w-5 text-brand-blue" />
            API base URL
          </div>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 break-all rounded bg-white px-2 py-1 text-xs text-slate-800 dark:bg-slate-900 dark:text-slate-100">{apiBaseUrl}</code>
            <Tooltip content="Copy API base URL">
              <button
                type="button"
                onClick={() => copy(apiBaseUrl, 'API base URL', 'api-base-url')}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                aria-label={copiedKey === 'api-base-url' ? 'Copied API base URL' : 'Copy API base URL'}
              >
                {copiedKey === 'api-base-url' ? <CheckCircleIcon className="h-4 w-4" /> : <CopyIcon className="h-4 w-4" />}
              </button>
            </Tooltip>
          </div>
        </div>

        {newToken && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900/70 dark:bg-emerald-950/40">
            <div className="mb-2 flex items-center gap-2 font-semibold text-emerald-800 dark:text-emerald-200">
              <CheckCircleIcon className="h-5 w-5" />
              New token. Copy it now; it will not be shown again.
            </div>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 break-all rounded bg-white px-2 py-1 text-xs text-emerald-900 dark:bg-slate-950 dark:text-emerald-100">{newToken}</code>
              <Tooltip content="Copy new token">
                <button
                  type="button"
                  onClick={() => copy(newToken, 'new integration token', 'new-token')}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-emerald-600 text-white hover:bg-emerald-700"
                  aria-label={copiedKey === 'new-token' ? 'Copied new integration token' : 'Copy new integration token'}
                >
                  {copiedKey === 'new-token' ? <CheckCircleIcon className="h-4 w-4" /> : <CopyIcon className="h-4 w-4" />}
                </button>
              </Tooltip>
            </div>
          </div>
        )}

        {newToken && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-900/70 dark:bg-blue-950/30">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="font-semibold text-blue-900 dark:text-blue-100">Hermes setup prompt</div>
              <Tooltip content="Copy Hermes setup prompt with API token">
                <button
                  type="button"
                  onClick={() => copy(hermesPrompt, 'Hermes setup prompt', 'hermes-prompt')}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-brand-blue text-white hover:bg-blue-600"
                  aria-label={copiedKey === 'hermes-prompt' ? 'Copied Hermes setup prompt' : 'Copy Hermes setup prompt'}
                >
                  {copiedKey === 'hermes-prompt' ? <CheckCircleIcon className="h-4 w-4" /> : <CopyIcon className="h-4 w-4" />}
                </button>
              </Tooltip>
            </div>
            <pre className="max-h-64 overflow-auto rounded bg-slate-900 p-3 text-xs leading-relaxed text-slate-100"><code>{hermesPrompt}</code></pre>
          </div>
        )}

        <div className="grid gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
          <label className="block">
            <span className="mb-1 block font-semibold text-slate-900 dark:text-white">Create token</span>
            <input
              value={name}
              onChange={event => setName(event.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-blue-900"
              placeholder="Hermes WhatsApp"
            />
          </label>

          <div className="grid gap-2 sm:grid-cols-2">
            {ALL_SCOPES.map(item => (
              <label key={item.scope} className="flex cursor-pointer gap-2 rounded-md border border-slate-200 p-2 dark:border-slate-700">
                <input
                  type="checkbox"
                  checked={selectedScopes.includes(item.scope)}
                  onChange={() => toggleScope(item.scope)}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-blue focus:ring-brand-blue"
                />
                <span>
                  <span className="block font-medium text-slate-900 dark:text-white">{item.label}</span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400">{item.description}</span>
                </span>
              </label>
            ))}
          </div>

          <button
            type="button"
            onClick={handleCreate}
            disabled={isLoading}
            className="inline-flex w-fit items-center gap-2 rounded-md bg-brand-blue px-3 py-2 text-sm font-semibold text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? <Spinner size="sm" color="border-white" /> : <CommandLineIcon className="h-4 w-4" />}
            Create token
          </button>
        </div>

        <div>
          <div className="mb-2 font-semibold text-slate-900 dark:text-white">Active clients</div>
          {isLoading && clients.length === 0 ? (
            <Spinner />
          ) : activeClients.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-300 p-3 text-slate-500 dark:border-slate-700 dark:text-slate-400">No active integration clients.</p>
          ) : (
            <div className="space-y-2">
              {activeClients.map(client => (
                <div key={client.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-900 dark:text-white">{client.name}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">Scopes: {client.scopes.join(', ')}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">Last used: {formatDateTime(client.last_used_at)}</div>
                  </div>
                  <Tooltip content="Revoke token">
                    <button
                      type="button"
                      onClick={() => handleRevoke(client)}
                      className="rounded-full p-2 text-brand-red hover:bg-red-100 dark:hover:bg-red-950"
                      aria-label={`Revoke ${client.name}`}
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  </Tooltip>
                </div>
              ))}
            </div>
          )}
        </div>

        {revokedClients.length > 0 && (
          <details className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
            <summary className="cursor-pointer font-semibold text-slate-900 dark:text-white">Revoked clients</summary>
            <div className="mt-2 space-y-2">
              {revokedClients.map(client => (
                <div key={client.id} className="rounded-md bg-slate-50 p-2 text-xs text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                  {client.name} · revoked {formatDateTime(client.revoked_at)}
                </div>
              ))}
            </div>
          </details>
        )}

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950">
          <div className="mb-2 font-semibold text-slate-900 dark:text-white">Quick test</div>
          <pre className="max-h-40 overflow-auto rounded bg-slate-900 p-3 text-xs text-slate-100"><code>{curlExample}</code></pre>
        </div>
      </div>
    </Modal>
  );
};

export default IntegrationSettingsModal;
