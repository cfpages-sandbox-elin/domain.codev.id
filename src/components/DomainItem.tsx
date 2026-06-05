import React, { memo, useMemo, useState, useEffect } from 'react';
import { Domain, DomainTag, WhoisData } from '../types';
import { useCompactMode } from '../contexts/CompactModeContext';
import { TrashIcon, InfoIcon, ShoppingCartIcon, RefreshIcon, TargetIcon, ExternalLinkIcon } from './icons';
import Spinner from './Spinner';
import Tooltip from './Tooltip';
import StatusBadge from './domain-item/StatusBadge';
import { DomainTooltipContent, PlainTooltipText } from './domain-item/TooltipContent';
import {
  formatDate,
  getDaysUntilExpiry,
  getDomainTextStyles,
  getRegistrarUrl,
  getRowStyles,
  getTagColorClass,
  getTagIcon,
  getTagLabel,
  hasIncompleteWhoisData,
  registrarOptionsForDomain,
} from './domain-item/domainItemLogic';

interface DomainItemProps {
  domain: Domain;
  whoisDetails?: WhoisData;
  onRemove: (id: number) => void;
  onShowInfo: (domain: Domain) => void;
  onToggleTag: (id: number) => void;
  onSetTag: (id: number, tag: DomainTag) => void;
  onRecheck: (id: number) => Promise<void>;
  isAutoRefreshing?: boolean;
  isPending?: boolean;
  categoryLabels?: string[];
  tld?: string;
}

const DomainItem: React.FC<DomainItemProps> = ({ domain, whoisDetails, onRemove, onShowInfo, onToggleTag, onSetTag, onRecheck, isAutoRefreshing = false, isPending = false, categoryLabels = [], tld }) => {
  const [selectedRegistrar, setSelectedRegistrar] = useState<string>('');
  const [isRechecking, setIsRechecking] = useState(false);
  const { isCompact } = useCompactMode();
  
  const registrars = useMemo(() => registrarOptionsForDomain(domain.domain_name), [domain.domain_name]);

  useEffect(() => {
    setSelectedRegistrar(Object.keys(registrars)[0]);
  }, [registrars]);

  const handleBuyClick = () => {
    const url = getRegistrarUrl(selectedRegistrar, domain.domain_name);
    if (!url) return;
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
  const isReservedStatus = domain.status === 'reserved';
  const effectiveTag = isAvailableStatus ? 'to-snatch' : domain.tag;
  const isRegisteredTarget = domain.tag === 'to-snatch' && domain.status === 'registered';
  const rowStyles = getRowStyles(domain.status, effectiveTag, daysUntilExpiry);
  const needsExpiryDate = domain.status !== 'reserved'
    && (domain.status === 'registered' || domain.status === 'expired' || effectiveTag === 'mine')
    && !domain.expiration_date;
  const isAvailableForPurchase = isAvailableStatus;
  const canShowDropTimeline = domain.status === 'expired' && Boolean(domain.expiration_date);
  const actionButtonClass = 'p-1.5 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-wait';
  const registryStatuses = useMemo(() => (
    domain.domain_statuses || whoisDetails?.domainStatuses || []
  ), [domain.domain_statuses, whoisDetails?.domainStatuses]);
  const nameServers = useMemo(() => (
    domain.name_servers || whoisDetails?.nameServers || []
  ), [domain.name_servers, whoisDetails?.nameServers]);
  const isWhoisIncomplete = hasIncompleteWhoisData(domain, registryStatuses);
  const isWhoisFailed = domain.status === 'unknown' && Boolean(domain.last_checked);
  const isWhoisProcessing = isRechecking || isAutoRefreshing || isPending;
  const whoisUrl = `https://www.whois.com/whois/${encodeURIComponent(domain.domain_name)}`;
  const siteUrl = `https://${domain.domain_name}`;
  const TagIconComponent = getTagIcon(effectiveTag);
  const tagLabel = getTagLabel(effectiveTag);
  const tagColorClass = getTagColorClass(effectiveTag);
  const tagIconClass = `h-5 w-5 ${tagColorClass}`;
  const leadingTagIconClass = `mt-0.5 h-4 w-4 flex-none ${tagColorClass}`;
  const selectedRegistrarName = registrars[selectedRegistrar] || selectedRegistrar;
  const buyTooltip = (
    <PlainTooltipText
      title={`Open ${selectedRegistrarName}`}
      body="Confirm availability at the registrar before buying. WHOIS providers can return stale or unsupported-TLD results."
    />
  );
  const purchaseControls = (
    <div className="flex items-center gap-1.5">
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
          className="inline-flex h-8 w-8 flex-none items-center justify-center text-white bg-brand-green hover:bg-green-600 rounded-md transition-colors"
          aria-label={`Open registrar page for ${domain.domain_name} on ${selectedRegistrarName}`}
        >
          <ShoppingCartIcon className="w-4 h-4" />
        </button>
      </Tooltip>
    </div>
  );

  const tooltipContent = useMemo(() => (
    <DomainTooltipContent
      domainName={domain.domain_name}
      status={domain.status === 'dropped' ? 'available' : domain.status === 'reserved' ? 'reserved domain' : domain.status}
      tagLabel={tagLabel}
      tld={tld}
      categoryLabels={categoryLabels}
      expirationDate={domain.expiration_date}
      registeredDate={domain.registered_date}
      registrar={domain.registrar}
      lastChecked={domain.last_checked}
      providerLabel={whoisDetails?.providerLabel}
      registryStatuses={registryStatuses}
      nameServers={nameServers}
    />
  ), [categoryLabels, domain, nameServers, registryStatuses, tagLabel, tld, whoisDetails?.providerLabel]);

  return (
    <div className={`relative overflow-hidden rounded-md border transition-all [content-visibility:auto] [contain-intrinsic-size:96px] ${rowStyles} ${isRegisteredTarget ? 'saturate-50 opacity-[0.55] grayscale-[35%]' : ''} ${isWhoisIncomplete ? 'grayscale opacity-75' : ''} ${isCompact ? 'px-3 py-2' : 'px-4 py-3'}`}>
      {(isWhoisIncomplete || isWhoisProcessing) && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center">
          <span className="rounded-b-md bg-slate-800/90 px-3 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white dark:bg-slate-100/90 dark:text-slate-900">
            {isPending ? 'Checking WHOIS' : isWhoisProcessing ? 'WHOIS retrieval processing' : isWhoisFailed ? 'WHOIS check failed' : 'WHOIS data incomplete'}
          </span>
        </div>
      )}
      <div className={`grid grid-cols-1 gap-3 md:grid-cols-[minmax(180px,1.5fr)_minmax(110px,0.7fr)_minmax(120px,0.8fr)_minmax(160px,0.9fr)_auto] md:items-center ${(isWhoisIncomplete || isWhoisProcessing) ? 'pt-4' : ''}`}>
        <div className="min-w-0">
          <Tooltip content={tooltipContent}>
            <span className="flex min-w-0 items-start gap-2">
              <TagIconComponent className={leadingTagIconClass} />
              <span className="min-w-0">
                <span className="inline-flex max-w-full items-center gap-1.5 align-top">
                  <a
                    href={whoisUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`min-w-0 font-semibold underline-offset-2 hover:underline break-all leading-snug ${getDomainTextStyles(domain.status)} ${isCompact ? 'text-sm' : 'text-base'}`}
                  >
                    {domain.domain_name}
                  </a>
                  {effectiveTag === 'mine' && (
                    <Tooltip content={<PlainTooltipText title="Open site" body={`Open ${domain.domain_name} in a new tab.`} />}>
                      <a
                        href={siteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-6 w-6 flex-none items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-white/70 hover:text-brand-blue dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                        aria-label={`Open ${domain.domain_name} site in a new tab`}
                      >
                        <ExternalLinkIcon className="h-3.5 w-3.5" />
                      </a>
                    </Tooltip>
                  )}
                </span>
                {(categoryLabels.length > 0 || tld) && (
                  <span className="mt-1 flex flex-wrap items-center gap-1">
                    {categoryLabels.slice(0, 3).map(label => (
                      <span key={label} className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-900/70 dark:text-slate-300">
                        {label}
                      </span>
                    ))}
                    {categoryLabels.length > 3 && (
                      <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-900/70 dark:text-slate-300">
                        +{categoryLabels.length - 3}
                      </span>
                    )}
                    {tld && (
                      <span className="rounded-full bg-slate-900/10 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-white/10 dark:text-slate-300">
                        {tld}
                      </span>
                    )}
                  </span>
                )}
              </span>
            </span>
          </Tooltip>
        </div>

        <div className="flex items-center gap-2">
          <StatusBadge status={domain.status} isCompact={isCompact} />
        </div>

        <div className="text-sm font-medium text-slate-700 dark:text-slate-200">
          {isAvailableForPurchase ? (
            purchaseControls
          ) : (
            <>
              {formatDate(domain.expiration_date)}
              {isRegisteredTarget && (
                <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Registered target
                </span>
              )}
              {daysUntilExpiry !== null && daysUntilExpiry <= 90 && domain.status !== 'unknown' && (
                <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {domain.status === 'expired' ? 'Expired' : `${daysUntilExpiry} days left`}
                </span>
              )}
              {domain.status === 'unknown' && (
                <span className="block text-xs font-semibold text-yellow-700 dark:text-yellow-300">
                  {isWhoisFailed ? 'WHOIS failed' : 'Re-check needed'}
                </span>
              )}
              {needsExpiryDate && domain.status !== 'unknown' && (
                <span className="block text-xs font-semibold text-yellow-700 dark:text-yellow-300">Missing expiry</span>
              )}
            </>
          )}
        </div>

        <div className="min-h-[32px]">
        </div>

        <div className="flex items-center justify-start gap-1 md:justify-end">
          {isPending ? (
            <Spinner size="sm" color="border-brand-blue" />
          ) : (
            <>
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
          ) : isReservedStatus ? (
            <Tooltip content={<PlainTooltipText title="Reserved domain" body="Reserved domains are not buyable and are skipped by automatic refresh." />}>
              <span
                className="inline-flex h-8 w-8 cursor-default items-center justify-center"
                aria-label={`${domain.domain_name} is reserved and skipped by automatic refresh`}
              >
                <InfoIcon className="h-5 w-5 text-amber-700 dark:text-amber-300" />
              </span>
            </Tooltip>
          ) : (
            <div className="group/tag relative inline-flex h-8 w-8 items-center justify-center rounded-md focus-within:bg-slate-200 hover:bg-slate-200 dark:focus-within:bg-slate-700 dark:hover:bg-slate-700">
              <span className="pointer-events-none absolute right-8 top-0 z-20 inline-flex h-8 items-center gap-1 rounded-md bg-white/95 px-1 opacity-0 shadow-sm ring-1 ring-slate-200 transition-opacity group-hover/tag:pointer-events-auto group-hover/tag:opacity-100 group-focus-within/tag:pointer-events-auto group-focus-within/tag:opacity-100 dark:bg-slate-900/95 dark:ring-slate-700">
                {(['mine', 'to-snatch', 'others'] as DomainTag[])
                  .filter(tag => tag !== effectiveTag)
                  .map(tag => {
                    const OptionIcon = getTagIcon(tag);
                    const optionLabel = getTagLabel(tag);
                    return (
                      <Tooltip key={tag} content={<PlainTooltipText title={`Set ${optionLabel}`} body={`Change this domain tag to ${optionLabel}.`} />}>
                        <button
                          type="button"
                          onClick={() => onSetTag(domain.id, tag)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-white/70 dark:hover:bg-slate-800"
                          aria-label={`Set ${domain.domain_name} tag to ${optionLabel}`}
                        >
                          <OptionIcon className={`h-5 w-5 ${getTagColorClass(tag)}`} />
                        </button>
                      </Tooltip>
                    );
                  })}
                  </span>
              <Tooltip content={<PlainTooltipText title={`Current tag: ${tagLabel}`} body="Hover to choose Mine, To Snatch, or Others directly." />}>
                <button
                  onClick={() => onToggleTag(domain.id)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors"
                  aria-label={`Current tag for ${domain.domain_name}: ${tagLabel}`}
                >
                  <TagIconComponent className={tagIconClass} />
                </button>
              </Tooltip>
            </div>
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
            </>
          )}
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

const areStringArraysEqual = (left?: string[], right?: string[]) => {
  if (left === right) return true;
  if (!left || !right || left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
};

export default memo(DomainItem, (prev, next) => (
  prev.domain === next.domain
  && prev.whoisDetails === next.whoisDetails
  && prev.isAutoRefreshing === next.isAutoRefreshing
  && prev.isPending === next.isPending
  && prev.tld === next.tld
  && areStringArraysEqual(prev.categoryLabels, next.categoryLabels)
));
