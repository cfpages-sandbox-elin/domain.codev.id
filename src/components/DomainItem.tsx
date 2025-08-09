import React from 'react';
import { Domain, DomainStatus } from '../types';
import { TrashIcon, InfoIcon, TagIcon, SwitchHorizontalIcon } from './icons';

interface DomainItemProps {
  domain: Domain;
  onRemove: (id: number) => void;
  onShowInfo: (domain: Domain) => void;
  onToggleTag: (id: number) => void;
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
        expired: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
        unknown: 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300',
    };
    
    const statusText = status === 'dropped' ? 'available' : status;

    return (
        <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full capitalize ${statusStyles[status]}`}>
            {statusText}
        </span>
    );
};

const DomainItem: React.FC<DomainItemProps> = ({ domain, onRemove, onShowInfo, onToggleTag }) => {
    
  const getDaysUntilExpiry = (dateString: string | null): number | null => {
    if(!dateString) return null;
    const expiryDate = new Date(dateString);
    const now = new Date();
    return Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 3600 * 24));
  }

  const daysUntilExpiry = getDaysUntilExpiry(domain.expiration_date);
  
  const isExpiringSoon = daysUntilExpiry !== null && daysUntilExpiry > 0 && daysUntilExpiry <= 7;
  const isExpired = domain.status === 'expired';

  const tagStyles = {
    mine: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
    'to-snatch': 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300',
  };

  return (
    <div className={`p-4 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all ${
        isExpiringSoon ? 'bg-yellow-50 dark:bg-yellow-900/20 ring-2 ring-yellow-400' : 'bg-slate-50 dark:bg-slate-800/50'
    }`}>
        <div className="flex-1 space-y-2">
            <div className="flex items-center gap-4">
                <h3 className="text-xl font-bold text-slate-800 dark:text-white break-all">{domain.domain_name}</h3>
                <div className="flex items-center gap-2">
                    <StatusBadge status={domain.status} />
                    <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full capitalize flex items-center gap-1 ${tagStyles[domain.tag]}`}>
                        <TagIcon className="w-3 h-3"/>
                        {domain.tag === 'mine' ? 'Mine' : 'To Snatch'}
                    </span>
                </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-600 dark:text-slate-400">
                <span>Registrar: <span className="font-semibold text-slate-700 dark:text-slate-300">{domain.registrar || 'N/A'}</span></span>
                <span>Registered: <span className="font-semibold text-slate-700 dark:text-slate-300">{formatDate(domain.registered_date)}</span></span>
                <span>Expires: <span className="font-semibold text-slate-700 dark:text-slate-300">{formatDate(domain.expiration_date)}</span></span>
                <span>Last Check: <span className="font-semibold text-slate-700 dark:text-slate-300">{formatDateWithTime(domain.last_checked)}</span></span>
            </div>
             { (isExpiringSoon || isExpired) && (
                <div className={`mt-2 text-sm font-semibold ${isExpired ? 'text-brand-red' : 'text-yellow-600 dark:text-yellow-400'}`}>
                    {isExpired ? 'This domain has expired.' : `Expires in ${daysUntilExpiry} days.`}
                </div>
            )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
             <button
                onClick={() => onShowInfo(domain)}
                disabled={domain.status !== 'expired'}
                className="p-2 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                title="Show drop timeline info"
                aria-label="Show drop timeline info"
            >
                <InfoIcon className="w-5 h-5" />
            </button>
            <button
                onClick={() => onToggleTag(domain.id)}
                className="p-2 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors"
                title="Switch tag"
                aria-label="Switch tag between 'mine' and 'to-snatch'"
            >
                <SwitchHorizontalIcon className="w-5 h-5" />
            </button>
             <button
                onClick={() => onRemove(domain.id)}
                className="p-2 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-full transition-colors"
                title="Remove domain"
                aria-label="Remove domain from tracking list"
            >
                <TrashIcon className="w-5 h-5" />
            </button>
        </div>
    </div>
  );
};

export default DomainItem;