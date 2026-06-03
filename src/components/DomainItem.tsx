import React, { useState, useEffect } from 'react';
import { Domain, DomainStatus, WhoisData } from '../types';
import { useCompactMode } from '../contexts/CompactModeContext';
import { TrashIcon, InfoIcon, ShoppingCartIcon, RefreshIcon, HomeIcon, TargetIcon } from './icons';
import Spinner from './Spinner';
import Tooltip from './Tooltip';

interface DomainItemProps {
  domain: Domain;
  whoisDetails?: WhoisData;
  onRemove: (id: number) => void;
  onShowInfo: (domain: Domain) => void;
  onToggleTag: (id: number) => void;
  onRecheck: (id: number) => Promise<void>;
}

const formatDate = (dateString: string | null) => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

const formatDateWithTime = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString('en-GB', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
};

const StatusBadge: React.FC<{ status: DomainStatus, isCompact: boolean }> = ({ status, isCompact }) => {
    const statusStyles: { [key in DomainStatus]: string } = {
        available: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
        dropped: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
        registered: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
        expired: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
        unknown: 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300',
    };
    
    const statusText = status === 'dropped' ? 'available' : status;

    return (
        <span className={`px-2 font-semibold rounded-full capitalize ${statusStyles[status]} ${isCompact ? 'py-0 text-[9px]' : 'py-0.5 text-[10px]'}`}>
            {statusText}
        </span>
    );
};

const getRowStyles = (status: DomainStatus, tag: 'mine' | 'to-snatch', daysUntilExpiry: number | null): string => {
    const tagStyles = tag === 'mine'
      ? 'bg-indigo-50/90 border-indigo-200 dark:bg-indigo-950/30 dark:border-indigo-900/80'
      : 'bg-teal-50/90 border-teal-200 dark:bg-teal-950/30 dark:border-teal-900/80';

    const statusStyles: Partial<Record<DomainStatus, string>> = {
        available: 'bg-green-50/90 border-green-200 dark:bg-green-950/30 dark:border-green-900/80',
        dropped: 'bg-green-50/90 border-green-200 dark:bg-green-950/30 dark:border-green-900/80',
        expired: 'bg-red-50/90 border-red-200 dark:bg-red-950/30 dark:border-red-900/80',
        unknown: 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700',
    };

    const urgency = getUrgencyStyles(status, daysUntilExpiry);
    return `${statusStyles[status] || tagStyles} ${urgency}`;
};

const getDomainTextStyles = (status: DomainStatus): string => {
    const statusStyles: { [key in DomainStatus]: string } = {
        available: 'text-green-800 hover:text-green-700 dark:text-green-300 dark:hover:text-green-200',
        dropped: 'text-green-800 hover:text-green-700 dark:text-green-300 dark:hover:text-green-200',
        registered: 'text-blue-900 hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-200',
        expired: 'text-red-900 hover:text-red-700 dark:text-red-300 dark:hover:text-red-200',
        unknown: 'text-slate-900 hover:text-slate-700 dark:text-white dark:hover:text-slate-200',
    };
    return statusStyles[status];
};

const getUrgencyStyles = (status: DomainStatus, daysUntilExpiry: number | null): string => {
    if (status === 'expired') {
        return 'ring-1 ring-red-500/80';
    }
    if (daysUntilExpiry === null) {
        return '';
    }
    if (daysUntilExpiry <= 7) {
        return 'ring-1 ring-red-500';
    }
    if (daysUntilExpiry <= 30) {
        return 'ring-1 ring-orange-500';
    }
    if (daysUntilExpiry <= 90) {
        return 'ring-1 ring-yellow-400';
    }
    return '';
};

const getDaysUntilExpiry = (dateString: string | null): number | null => {
    if (!dateString) return null;
    const expiryDate = new Date(dateString);
    const now = new Date();
    // Use Math.ceil to correctly handle fractions of a day
    return Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 3600 * 24));
};

const humanizeRegistryStatus = (status: string) => {
  const normalized = status.replace(/^https?:\/\/icann\.org\/epp#/i, '');
  const labels: Record<string, string> = {
    autoRenewPeriod: 'Automatic renewal period',
    clientTransferProhibited: 'Transfer locked by registrar',
    clientUpdateProhibited: 'Updates locked by registrar',
    clientDeleteProhibited: 'Deletion locked by registrar',
    serverTransferProhibited: 'Transfer blocked by registry',
    pendingDelete: 'Pending deletion',
    redemptionPeriod: 'Redemption period',
    ok: 'No special restrictions',
  };

  return labels[normalized] || normalized
    .replace(/^https?:\/\/icann\.org\/epp#/i, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
};

const explainRegistryStatus = (status: string) => {
  const normalized = status.replace(/^https?:\/\/icann\.org\/epp#/i, '');
  const explanations: Record<string, string> = {
    autoRenewPeriod: 'The registry automatically renewed the domain after expiry. The owner can still renew it or let it lapse.',
    clientTransferProhibited: 'Transfer is locked by the registrar. This usually protects the domain from unauthorized transfer.',
    clientUpdateProhibited: 'Updates are locked by the registrar.',
    clientDeleteProhibited: 'Deletion is locked by the registrar.',
    serverTransferProhibited: 'Transfer is blocked at the registry level.',
    pendingDelete: 'The domain is in the final deletion phase and may become available soon.',
    redemptionPeriod: 'The domain expired and is in a recovery period for the current owner.',
    ok: 'The domain has no special restrictions reported.',
  };
  return explanations[normalized] || 'Registry status reported by the WHOIS provider.';
};

const DetailRow: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="grid grid-cols-[92px_1fr] gap-2">
    <span className="text-slate-400 dark:text-slate-500">{label}</span>
    <span className="text-slate-700 dark:text-slate-200">{value}</span>
  </div>
);

const PlainTooltipText: React.FC<{ title: string; body?: string }> = ({ title, body }) => (
  <span>
    <span className="block font-semibold text-slate-800 dark:text-slate-100">{title}</span>
    {body && <span className="mt-0.5 block text-slate-500 dark:text-slate-400">{body}</span>}
  </span>
);

const DomainItem: React.FC<DomainItemProps> = ({ domain, whoisDetails, onRemove, onShowInfo, onToggleTag, onRecheck }) => {
  const [selectedRegistrar, setSelectedRegistrar] = useState<string>('');
  const [isRechecking, setIsRechecking] = useState(false);
  const { isCompact } = useCompactMode();
  
  const isIdDomain = domain.domain_name.endsWith('.id');
  const registrars: Record<string, string> = isIdDomain
    ? { 
        'idwebhost.com': 'IDWebHost', 
        'idcloudhost.com': 'IDCloudHost', 
        'cloudkilat.com': 'CloudKilat' 
      }
    : { 
        'cosmotown.com': 'Cosmotown', 
        'sav.com': 'Sav.com', 
        'spaceship.com': 'Spaceship' 
      };

  useEffect(() => {
    setSelectedRegistrar(Object.keys(registrars)[0]);
  }, [domain.domain_name]);

  const handleBuyClick = () => {
    let url = '';
    const name = encodeURIComponent(domain.domain_name);
    switch (selectedRegistrar) {
        case 'cosmotown.com': url = `https://www.cosmotown.com/products/domains/search?query=${name}`; break;
        case 'sav.com': url = `https://www.sav.com/search?q=${name}`; break;
        case 'spaceship.com': url = `https://www.spaceship.com/domain-search?query=${name}`; break;
        case 'idwebhost.com': url = `https://idwebhost.com/domain-murah?domain=${name}`; break;
        case 'idcloudhost.com': url = `https://my.idcloudhost.com/cart.php?a=add&domain=register&query=${name}`; break;
        case 'cloudkilat.com': url = `https://portal.cloudkilat.com/orders/domains/register/${name}`; break;
        default: return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleRecheck = async () => {
    setIsRechecking(true);
    try {
      await onRecheck(domain.id);
    } finally {
      setIsRechecking(false);
    }
  };

  const daysUntilExpiry = getDaysUntilExpiry(domain.expiration_date);
  const isAvailableStatus = domain.status === 'available' || domain.status === 'dropped';
  const effectiveTag = isAvailableStatus ? 'to-snatch' : domain.tag;
  const rowStyles = getRowStyles(domain.status, effectiveTag, daysUntilExpiry);
  const isAvailableForPurchase = isAvailableStatus;
  const canShowDropTimeline = domain.status === 'expired' && Boolean(domain.expiration_date);
  const actionButtonClass = 'p-1.5 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-wait';
  const registryStatuses = domain.domain_statuses || whoisDetails?.domainStatuses || [];
  const nameServers = domain.name_servers || whoisDetails?.nameServers || [];
  const whoisUrl = `https://www.whois.com/whois/${encodeURIComponent(domain.domain_name)}`;
  const TagIconComponent = effectiveTag === 'mine' ? HomeIcon : TargetIcon;
  const tagLabel = effectiveTag === 'mine' ? 'Mine' : 'To Snatch';
  const tagIconClass = effectiveTag === 'mine'
    ? 'h-5 w-5 text-indigo-700 dark:text-indigo-300'
    : 'h-5 w-5 text-teal-700 dark:text-teal-300';
  const selectedRegistrarName = registrars[selectedRegistrar] || selectedRegistrar;
  const buyTooltip = (
    <PlainTooltipText
      title={`Open ${selectedRegistrarName}`}
      body="Confirm availability at the registrar before buying. WHOIS providers can return stale or unsupported-TLD results."
    />
  );

  const tooltipContent = (
    <div className="space-y-3">
      <div className="space-y-1">
        <DetailRow label="Domain" value={domain.domain_name} />
        <DetailRow label="Status" value={domain.status === 'dropped' ? 'available' : domain.status} />
        <DetailRow label="Tag" value={tagLabel} />
        <DetailRow label="Expires" value={formatDate(domain.expiration_date)} />
        <DetailRow label="Registered" value={formatDate(domain.registered_date)} />
        <DetailRow label="Registrar" value={domain.registrar || 'N/A'} />
        <DetailRow label="Last check" value={formatDateWithTime(domain.last_checked)} />
        {whoisDetails?.providerLabel && <DetailRow label="Provider" value={whoisDetails.providerLabel} />}
      </div>

      <div>
        <p className="mb-1 font-semibold text-slate-700 dark:text-slate-200">Registry status</p>
        {registryStatuses.length > 0 ? (
          <ul className="space-y-1">
            {registryStatuses.map(status => (
              <li key={status}>
                <span className="font-medium text-slate-800 dark:text-slate-100">{humanizeRegistryStatus(status)}</span>
                <span className="block text-slate-500 dark:text-slate-400">{explainRegistryStatus(status)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-slate-500 dark:text-slate-400">No registry status details stored yet. Re-check the domain to refresh provider details.</p>
        )}
      </div>

      <div>
        <p className="mb-1 font-semibold text-slate-700 dark:text-slate-200">Name servers</p>
        {nameServers.length > 0 ? (
          <ul className="space-y-0.5">
            {nameServers.map(server => <li key={server} className="font-mono text-[11px]">{server}</li>)}
          </ul>
        ) : (
          <p className="text-slate-500 dark:text-slate-400">No name server details stored yet.</p>
        )}
      </div>
    </div>
  );

  return (
    <div className={`rounded-md border transition-all ${rowStyles} ${isCompact ? 'px-3 py-2' : 'px-4 py-3'}`}>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(180px,1.5fr)_minmax(110px,0.7fr)_minmax(120px,0.8fr)_minmax(160px,0.9fr)_auto] md:items-center">
        <div className="min-w-0">
          <Tooltip content={tooltipContent}>
            <a
              href={whoisUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`font-semibold underline-offset-2 hover:underline break-all leading-snug ${getDomainTextStyles(domain.status)} ${isCompact ? 'text-sm' : 'text-base'}`}
            >
              {domain.domain_name}
            </a>
          </Tooltip>
        </div>

        <div className="flex items-center gap-2">
          <StatusBadge status={domain.status} isCompact={isCompact} />
        </div>

        <div className="text-sm font-medium text-slate-700 dark:text-slate-200">
          {formatDate(domain.expiration_date)}
          {daysUntilExpiry !== null && daysUntilExpiry <= 90 && domain.status !== 'unknown' && (
            <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400">
              {domain.status === 'expired' ? 'Expired' : `${daysUntilExpiry} days left`}
            </span>
          )}
          {domain.status === 'unknown' && (
            <span className="block text-xs font-semibold text-yellow-700 dark:text-yellow-300">Re-check needed</span>
          )}
        </div>

        <div className="min-h-[32px]">
          {isAvailableForPurchase ? (
            <div className="flex items-center gap-1.5 md:justify-end">
              <select
                value={selectedRegistrar}
                onChange={(e) => setSelectedRegistrar(e.target.value)}
                className="min-w-0 w-full max-w-[132px] px-2 py-1.5 text-xs bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-brand-blue focus:border-brand-blue"
                aria-label={`Select registrar for ${domain.domain_name}`}
              >
                {Object.entries(registrars).map(([value, name]) => (
                  <option key={value} value={value}>{name}</option>
                ))}
              </select>
              <Tooltip content={buyTooltip}>
                <button
                  onClick={handleBuyClick}
                  className="inline-flex h-8 w-8 items-center justify-center text-white bg-brand-green hover:bg-green-600 rounded-md transition-colors"
                  aria-label={`Open registrar page for ${domain.domain_name} on ${selectedRegistrarName}`}
                >
                  <ShoppingCartIcon className="w-4 h-4" />
                </button>
              </Tooltip>
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-start gap-1 md:justify-end">
          <Tooltip content={<PlainTooltipText title="Re-check WHOIS data" body="Refresh status, expiry, registry status, and name servers." />}>
            <button
              onClick={handleRecheck}
              disabled={isRechecking}
              className={actionButtonClass}
              aria-label={`Re-check WHOIS data for ${domain.domain_name}`}
            >
              {isRechecking ? <Spinner size="sm" color="border-brand-blue" /> : <RefreshIcon className="w-5 h-5" />}
            </button>
          </Tooltip>
          {canShowDropTimeline && (
            <Tooltip content={<PlainTooltipText title="Show drop timeline" body="Estimate grace, redemption, and release timing." />}>
              <button
                onClick={() => onShowInfo(domain)}
                className={actionButtonClass}
                aria-label={`Show drop timeline for ${domain.domain_name}`}
              >
                <InfoIcon className="w-5 h-5" />
              </button>
            </Tooltip>
          )}
          {isAvailableStatus ? (
            <Tooltip content={<PlainTooltipText title="To Snatch" body="Available domains are treated as target domains. Re-check before buying." />}>
              <span
                className="inline-flex h-8 w-8 cursor-default items-center justify-center"
                aria-label={`${domain.domain_name} is marked To Snatch because it is available`}
              >
                <TargetIcon className={tagIconClass} />
              </span>
            </Tooltip>
          ) : (
            <Tooltip content={<PlainTooltipText title={`Tag: ${tagLabel}`} body={`Click to switch to ${effectiveTag === 'mine' ? 'To Snatch' : 'Mine'}.`} />}>
              <button
                onClick={() => onToggleTag(domain.id)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-slate-200 dark:hover:bg-slate-700"
                aria-label={`Switch tag for ${domain.domain_name}`}
              >
                <TagIconComponent className={tagIconClass} />
              </button>
            </Tooltip>
          )}
          <Tooltip content={<PlainTooltipText title="Remove domain" body="Delete this domain from your tracking list." />}>
            <button
              onClick={() => onRemove(domain.id)}
              className="p-1.5 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-md transition-colors"
              aria-label={`Remove ${domain.domain_name} from tracking list`}
            >
              <TrashIcon className="w-5 h-5" />
            </button>
          </Tooltip>
        </div>
      </div>

      {isAvailableStatus && domain.tag === 'mine' && (
        <div className="sr-only">
          Provider says available, but the saved tag is Mine. The row is shown as To Snatch until re-checked.
        </div>
      )}
    </div>
  );
};

export default DomainItem;
