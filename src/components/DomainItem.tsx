import React, { useState, useEffect } from 'react';
import { Domain, DomainStatus } from '../types';
import { useCompactMode } from '../contexts/CompactModeContext';
import { TrashIcon, InfoIcon, TagIcon, SwitchHorizontalIcon, ShoppingCartIcon, RefreshIcon } from './icons';
import Spinner from './Spinner';

interface DomainItemProps {
  domain: Domain;
  onRemove: (id: number) => void;
  onShowInfo: (domain: Domain) => void;
  onToggleTag: (id: number) => void;
  onRecheck: (id: number) => Promise<void>;
}

const formatDate = (dateString: string | null) => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const formatDateWithTime = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
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

const getUrgencyStyles = (status: DomainStatus, daysUntilExpiry: number | null): string => {
    if (status === 'expired') {
        return 'bg-red-100 dark:bg-red-900/40 ring-1 ring-red-500/80';
    }
    if (daysUntilExpiry === null) {
        return 'bg-slate-50 dark:bg-slate-800/50';
    }
    if (daysUntilExpiry <= 7) {
        return 'bg-red-50 dark:bg-red-900/30 ring-1 ring-red-500';
    }
    if (daysUntilExpiry <= 30) {
        return 'bg-orange-50 dark:bg-orange-900/30 ring-1 ring-orange-500';
    }
    if (daysUntilExpiry <= 90) {
        return 'bg-yellow-50 dark:bg-yellow-900/20 ring-1 ring-yellow-400';
    }
    return 'bg-slate-50 dark:bg-slate-800/50';
};

const getDaysUntilExpiry = (dateString: string | null): number | null => {
    if (!dateString) return null;
    const expiryDate = new Date(dateString);
    const now = new Date();
    // Use Math.ceil to correctly handle fractions of a day
    return Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 3600 * 24));
};

const DomainItem: React.FC<DomainItemProps> = ({ domain, onRemove, onShowInfo, onToggleTag, onRecheck }) => {
  const [selectedRegistrar, setSelectedRegistrar] = useState<string>('');
  const [isRechecking, setIsRechecking] = useState(false);
  const { isCompact } = useCompactMode();
  
  const isIdDomain = domain.domain_name.endsWith('.id');
  const registrars = isIdDomain
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
  const urgencyStyles = getUrgencyStyles(domain.status, daysUntilExpiry);

  const tagStyles = {
    mine: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
    'to-snatch': 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300',
  };
  
  const isAvailableStatus = domain.status === 'available' || domain.status === 'dropped';
  const isAvailableForPurchase = isAvailableStatus && domain.tag === 'to-snatch';
  const canShowDropTimeline = domain.status === 'expired' && Boolean(domain.expiration_date);
  const dateTextSize = isCompact ? 'text-[11px]' : 'text-xs';
  const actionButtonClass = 'p-1.5 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-wait';

  return (
    <div className={`rounded-md border border-slate-200/80 dark:border-slate-700/80 transition-all ${urgencyStyles} ${isCompact ? 'px-3 py-2' : 'px-4 py-3'}`}>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(180px,1.4fr)_minmax(120px,0.8fr)_minmax(190px,1fr)_minmax(170px,1fr)_auto] md:items-center">
        <div className="min-w-0">
          <h3 className={`font-semibold text-slate-900 dark:text-white break-all leading-snug ${isCompact ? 'text-sm' : 'text-base'}`}>
            {domain.domain_name}
          </h3>
          <p className={`${dateTextSize} text-slate-500 dark:text-slate-400`}>
            Registrar: <span className="font-medium text-slate-700 dark:text-slate-300">{domain.registrar || 'N/A'}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={domain.status} isCompact={isCompact} />
          <span className={`px-2 font-semibold rounded-full capitalize inline-flex items-center gap-1 ${tagStyles[domain.tag]} ${isCompact ? 'py-0 text-[9px]' : 'py-0.5 text-[10px]'}`}>
            <TagIcon className="w-3 h-3" />
            {domain.tag === 'mine' ? 'Mine' : 'To Snatch'}
          </span>
        </div>

        <div className={`grid grid-cols-2 gap-x-3 gap-y-1 ${dateTextSize} text-slate-500 dark:text-slate-400`}>
          <span>
            Registered
            <span className="block font-medium text-slate-700 dark:text-slate-300">{formatDate(domain.registered_date)}</span>
          </span>
          <span>
            Expires
            <span className="block font-medium text-slate-700 dark:text-slate-300">{formatDate(domain.expiration_date)}</span>
          </span>
          <span className="col-span-2">
            Last checked
            <span className="block font-medium text-slate-700 dark:text-slate-300">{formatDateWithTime(domain.last_checked)}</span>
          </span>
          {domain.status === 'unknown' && (
            <span className="col-span-2 font-semibold text-yellow-700 dark:text-yellow-300">WHOIS failed. Re-check when ready.</span>
          )}
          {daysUntilExpiry !== null && daysUntilExpiry <= 90 && domain.status !== 'unknown' && (
            <span className="col-span-2 font-semibold text-slate-700 dark:text-slate-200">
              {domain.status === 'expired' ? 'Expired.' : `Expires in ${daysUntilExpiry} days.`}
            </span>
          )}
        </div>

        <div className="min-h-[32px]">
          {isAvailableForPurchase ? (
            <div className="flex flex-wrap items-center gap-2 md:justify-end">
              <select
                value={selectedRegistrar}
                onChange={(e) => setSelectedRegistrar(e.target.value)}
                className="min-w-0 flex-1 md:flex-none px-2 py-1 text-xs bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-brand-blue focus:border-brand-blue"
                aria-label={`Select registrar for ${domain.domain_name}`}
              >
                {Object.entries(registrars).map(([value, name]) => (
                  <option key={value} value={value}>{name}</option>
                ))}
              </select>
              <button
                onClick={handleBuyClick}
                className="inline-flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-brand-green hover:bg-green-600 rounded-md transition-colors"
                aria-label={`Buy ${domain.domain_name} on ${selectedRegistrar}`}
              >
                <ShoppingCartIcon className="w-4 h-4" />
                Buy
              </button>
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-start gap-1 md:justify-end">
          <button
            onClick={handleRecheck}
            disabled={isRechecking}
            className={actionButtonClass}
            title="Re-check WHOIS data"
            aria-label={`Re-check WHOIS data for ${domain.domain_name}`}
          >
            {isRechecking ? <Spinner size="sm" color="border-brand-blue" /> : <RefreshIcon className="w-5 h-5" />}
          </button>
          {canShowDropTimeline && (
            <button
              onClick={() => onShowInfo(domain)}
              className={actionButtonClass}
              title="Show drop timeline"
              aria-label={`Show drop timeline for ${domain.domain_name}`}
            >
              <InfoIcon className="w-5 h-5" />
            </button>
          )}
          <button
            onClick={() => onToggleTag(domain.id)}
            className={actionButtonClass}
            title="Switch tag"
            aria-label={`Switch tag for ${domain.domain_name}`}
          >
            <SwitchHorizontalIcon className="w-5 h-5" />
          </button>
          <button
            onClick={() => onRemove(domain.id)}
            className="p-1.5 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-md transition-colors"
            title="Remove domain"
            aria-label={`Remove ${domain.domain_name} from tracking list`}
          >
            <TrashIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {isAvailableStatus && domain.tag === 'mine' && (
        <div className="mt-2 border-t border-slate-200/80 pt-2 text-xs font-medium text-yellow-700 dark:border-slate-700/80 dark:text-yellow-300">
          Provider says available, but this is tagged as yours. Treat as suspicious and re-check before acting.
        </div>
      )}
      {isAvailableForPurchase && domain.tag === 'to-snatch' && (
        <div className="mt-2 border-t border-slate-200/80 pt-2 text-xs text-slate-500 dark:border-slate-700/80 dark:text-slate-400">
          Confirm availability at the registrar before buying. WHOIS providers can return stale or unsupported-TLD results.
        </div>
      )}
    </div>
  );
};

export default DomainItem;
