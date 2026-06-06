import { Domain, DomainStatus, DomainTag } from '../../types';
import { HomeIcon, TargetIcon, UsersIcon } from '../icons';
import {
  getDropLifecycleEstimate,
  type DropLifecycleEstimate,
} from '../../utils/appDomainLogic';

export type { DropLifecycleEstimate };
export { getDropLifecycleEstimate };

export const formatDate = (dateString: string | null) => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

export const formatDateWithTime = (dateString: string | null) => {
  if (!dateString) return 'Never';
  return new Date(dateString).toLocaleString('en-GB', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

export const getUrgencyStyles = (status: DomainStatus, daysUntilExpiry: number | null): string => {
  if (status === 'expired') return 'ring-1 ring-red-500/80';
  if (daysUntilExpiry === null) return '';
  if (daysUntilExpiry <= 7) return 'ring-1 ring-red-500';
  if (daysUntilExpiry <= 30) return 'ring-1 ring-orange-500';
  if (daysUntilExpiry <= 90) return 'ring-1 ring-yellow-400';
  return '';
};

export const getRowStyles = (status: DomainStatus, tag: DomainTag, daysUntilExpiry: number | null): string => {
  const tagStyles: Record<DomainTag, string> = {
    mine: 'bg-indigo-100 border-indigo-300 dark:bg-indigo-950/80 dark:border-indigo-700/90',
    'to-snatch': 'bg-teal-100 border-teal-300 dark:bg-teal-950/80 dark:border-teal-700/90',
    others: 'bg-violet-100 border-violet-300 dark:bg-violet-950/80 dark:border-violet-700/90',
  };

  const statusStyles: Partial<Record<DomainStatus, string>> = {
    available: 'bg-teal-100 border-teal-300 dark:bg-teal-950/80 dark:border-teal-700/90',
    dropped: 'bg-teal-100 border-teal-300 dark:bg-teal-950/80 dark:border-teal-700/90',
    expired: 'bg-red-100 border-red-300 dark:bg-red-950/80 dark:border-red-700/90',
    reserved: 'bg-amber-100 border-amber-300 dark:bg-amber-950/80 dark:border-amber-700/90',
    unknown: 'bg-slate-100 dark:bg-slate-900/90 border-slate-300 dark:border-slate-600',
  };

  return `${statusStyles[status] || tagStyles[tag]} ${getUrgencyStyles(status, daysUntilExpiry)}`;
};

export const hasIncompleteWhoisData = (domain: Domain, registryStatuses: string[]) => {
  if (!domain.last_checked || domain.status === 'unknown') return true;
  if (domain.status === 'available' || domain.status === 'dropped' || domain.status === 'reserved') return false;
  if (domain.status === 'registered' || domain.status === 'expired' || domain.tag === 'mine') {
    return !domain.expiration_date || !domain.registrar || registryStatuses.length === 0;
  }
  return false;
};

export const getDomainTextStyles = (status: DomainStatus): string => {
  const statusStyles: { [key in DomainStatus]: string } = {
    available: 'text-green-800 hover:text-green-700 dark:text-green-300 dark:hover:text-green-200',
    dropped: 'text-green-800 hover:text-green-700 dark:text-green-300 dark:hover:text-green-200',
    registered: 'text-blue-900 hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-200',
    expired: 'text-red-900 hover:text-red-700 dark:text-red-300 dark:hover:text-red-200',
    reserved: 'text-amber-900 hover:text-amber-700 dark:text-amber-300 dark:hover:text-amber-200',
    unknown: 'text-slate-900 hover:text-slate-700 dark:text-white dark:hover:text-slate-200',
  };
  return statusStyles[status];
};

export const getDaysUntilExpiry = (dateString: string | null): number | null => {
  if (!dateString) return null;
  const expiryDate = new Date(dateString);
  const now = new Date();
  return Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 3600 * 24));
};

export const humanizeRegistryStatus = (status: string) => {
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

export const explainRegistryStatus = (status: string) => {
  const normalized = status.replace(/^https?:\/\/icann\.org\/epp#/i, '');
  const explanations: Record<string, string> = {
    autoRenewPeriod: 'The registry automatically renewed the domain after expiry. The owner can still renew it or let it lapse.',
    clientTransferProhibited: 'Transfer is locked by the registrar. This usually protects the domain from unauthorized transfer.',
    clientUpdateProhibited: 'Updates are locked by the registrar.',
    clientDeleteProhibited: 'Deletion is locked by the registrar.',
    serverTransferProhibited: 'Transfer is blocked at the registry level.',
    pendingDelete: 'The domain is in the final deletion phase and may become available soon.',
    redemptionPeriod: 'The domain expired and is in a recovery period for the current owner.',
    reserved: 'Reserved by the registry or government and not available for public registration.',
    ok: 'The domain has no special restrictions reported.',
  };
  return explanations[normalized] || 'Registry status reported by the WHOIS provider.';
};

export const getTagLabel = (tag: DomainTag) => {
  if (tag === 'mine') return 'Mine';
  if (tag === 'others') return 'Others';
  return 'To Snatch';
};

export const getTagIcon = (tag: DomainTag) => {
  if (tag === 'mine') return HomeIcon;
  if (tag === 'others') return UsersIcon;
  return TargetIcon;
};

export const getTagColorClass = (tag: DomainTag) => {
  if (tag === 'mine') return 'text-indigo-700 dark:text-indigo-200';
  if (tag === 'others') return 'text-violet-700 dark:text-violet-200';
  return 'text-teal-700 dark:text-teal-200';
};

export const registrarOptionsForDomain = (domainName: string): Record<string, string> => (
  domainName.endsWith('.id')
    ? {
      'idwebhost.com': 'IDWebHost',
      'idcloudhost.com': 'IDCloudHost',
      'cloudkilat.com': 'CloudKilat',
    }
    : {
      'cosmotown.com': 'Cosmotown',
      'sav.com': 'Sav.com',
      'spaceship.com': 'Spaceship',
    }
);

export const getRegistrarUrl = (registrar: string, domainName: string) => {
  const name = encodeURIComponent(domainName);
  switch (registrar) {
    case 'cosmotown.com': return `https://www.cosmotown.com/products/domains/search?query=${name}`;
    case 'sav.com': return `https://www.sav.com/search?q=${name}`;
    case 'spaceship.com': return `https://www.spaceship.com/domain-search?query=${name}`;
    case 'idwebhost.com': return `https://idwebhost.com/domain-murah?domain=${name}`;
    case 'idcloudhost.com': return `https://my.idcloudhost.com/cart.php?a=add&domain=register&query=${name}`;
    case 'cloudkilat.com': return `https://portal.cloudkilat.com/orders/domains/register/${name}`;
    default: return null;
  }
};
