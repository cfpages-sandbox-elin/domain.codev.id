import React, { useState, useEffect } from 'react';
import { Domain, DomainStatus } from '../types';
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

const StatusBadge: React.FC<{ status: DomainStatus }> = ({ status }) => {
    const statusStyles: { [key in DomainStatus]: string } = {
        available: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
        dropped: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
        registered: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
        expired: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
        unknown: 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300',
    };
    
    const statusText = status === 'dropped' ? 'available' : status;

    return (
        <span className={`px-2 py-0 text-[10px] font-semibold rounded-full capitalize ${statusStyles[status]}`}>
            {statusText}
        </span>
    );
};

const getUrgencyStyles = (status: DomainStatus, daysUntilExpiry: number | null): string => {
    if (status === 'expired') {
        return 'bg-red-100 dark:bg-red-900/40 ring-2 ring-red-500/80';
    }
    if (daysUntilExpiry === null) {
        return 'bg-slate-50 dark:bg-slate-800/50';
    }
    if (daysUntilExpiry <= 7) {
        return 'bg-red-50 dark:bg-red-900/30 ring-2 ring-red-500';
    }
    if (daysUntilExpiry <= 30) {
        return 'bg-orange-50 dark:bg-orange-900/30 ring-2 ring-orange-500';
    }
    if (daysUntilExpiry <= 90) {
        return 'bg-yellow-50 dark:bg-yellow-900/20 ring-2 ring-yellow-400';
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
    await onRecheck(domain.id);
    setIsRechecking(false);
  };

  const daysUntilExpiry = getDaysUntilExpiry(domain.expiration_date);
  const urgencyStyles = getUrgencyStyles(domain.status, daysUntilExpiry);

  const tagStyles = {
    mine: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
    'to-snatch': 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300',
  };
  
  const isAvailableForPurchase = domain.status === 'available' || domain.status === 'dropped';

  return (
    <div className={`p-2 rounded-lg flex flex-col justify-between gap-2 transition-all ${urgencyStyles}`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
            <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white break-all">{domain.domain_name}</h3>
                    <div className="flex items-center gap-2">
                        <StatusBadge status={domain.status} />
                        <span className={`px-2 py-0 text-[10px] font-semibold rounded-full capitalize flex items-center gap-1 ${tagStyles[domain.tag]}`}>
                            <TagIcon className="w-3 h-3"/>
                            {domain.tag === 'mine' ? 'Mine' : 'To Snatch'}
                        </span>
                    </div>
                </div>
                {!isAvailableForPurchase && domain.status !== 'unknown' && (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-400">
                        <span>Registrar: <span className="font-semibold text-slate-700 dark:text-slate-300">{domain.registrar || 'N/A'}</span></span>
                        <span>Registered: <span className="font-semibold text-slate-700 dark:text-slate-300">{formatDate(domain.registered_date)}</span></span>
                        <span>Expires: <span className="font-semibold text-slate-700 dark:text-slate-300">{formatDate(domain.expiration_date)}</span></span>
                        <span>Last Check: <span className="font-semibold text-slate-700 dark:text-slate-300">{formatDateWithTime(domain.last_checked)}</span></span>
                    </div>
                )}
                 { daysUntilExpiry !== null && daysUntilExpiry <= 90 && (
                    <div className="mt-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
                        {domain.status === 'expired' ? 'This domain has expired.' : `Expires in ${daysUntilExpiry} days.`}
                    </div>
                )}
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
                 <button
                    onClick={() => onShowInfo(domain)}
                    disabled={domain.status !== 'expired'}
                    className="p-1.5 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Show drop timeline info"
                    aria-label="Show drop timeline info"
                >
                    <InfoIcon className="w-5 h-5" />
                </button>
                <button
                    onClick={() => onToggleTag(domain.id)}
                    className="p-1.5 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors"
                    title="Switch tag"
                    aria-label="Switch tag between 'mine' and 'to-snatch'"
                >
                    <SwitchHorizontalIcon className="w-5 h-5" />
                </button>
                 <button
                    onClick={() => onRemove(domain.id)}
                    className="p-1.5 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-full transition-colors"
                    title="Remove domain"
                    aria-label="Remove domain from tracking list"
                >
                    <TrashIcon className="w-5 h-5" />
                </button>
            </div>
        </div>
        
        {domain.status === 'unknown' && (
            <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700/50 flex flex-col sm:flex-row items-center justify-between gap-2">
                <div className="text-sm">
                    <p className="font-semibold text-yellow-700 dark:text-yellow-300">Could not retrieve WHOIS data.</p>
                    <p className="text-slate-500 dark:text-slate-400">Last attempt: {formatDateWithTime(domain.last_checked)}</p>
                </div>
                <button 
                    onClick={handleRecheck}
                    disabled={isRechecking}
                    className="flex-shrink-0 flex items-center justify-center gap-2 px-4 py-2 font-semibold text-white bg-brand-blue hover:bg-blue-600 rounded-lg transition-colors disabled:bg-blue-400 dark:disabled:bg-blue-800"
                    aria-label="Re-check WHOIS data for this domain"
                >
                    {isRechecking ? (
                        <>
                            <Spinner size="sm" />
                            Checking...
                        </>
                    ) : (
                        <>
                            <RefreshIcon className="w-5 h-5" />
                            Re-check
                        </>
                    )}
                </button>
            </div>
        )}

        {isAvailableForPurchase && (
            <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700/50 flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold text-green-700 dark:text-green-300">This domain is available!</span>
                <div className="flex items-center gap-3">
                    <select 
                        value={selectedRegistrar}
                        onChange={(e) => setSelectedRegistrar(e.target.value)}
                        className="flex-grow sm:flex-grow-0 px-3 py-2 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-sm focus:ring-brand-blue focus:border-brand-blue"
                    >
                        {Object.entries(registrars).map(([value, name]) => (
                            <option key={value} value={value}>{name}</option>
                        ))}
                    </select>
                    <button 
                        onClick={handleBuyClick}
                        className="flex-shrink-0 flex items-center justify-center gap-2 px-4 py-2 font-semibold text-white bg-brand-green hover:bg-green-600 rounded-lg transition-colors"
                        aria-label={`Buy ${domain.domain_name} on ${selectedRegistrar}`}
                    >
                        <ShoppingCartIcon className="w-5 h-5" />
                        Buy Now
                    </button>
                </div>
            </div>
        )}
    </div>
  );
};

export default DomainItem;