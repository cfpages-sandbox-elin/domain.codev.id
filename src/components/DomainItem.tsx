import React, { memo, useMemo, useState, useEffect, useRef } from 'react';
import { Domain, DomainTag, WhoisData } from '../types';
import { useCompactMode } from '../contexts/CompactModeContext';
import { TrashIcon, InfoIcon, ShoppingCartIcon, RefreshIcon, TargetIcon, ExternalLinkIcon, PlusIcon, XCircleIcon } from './icons';
import Spinner from './Spinner';
import Tooltip from './Tooltip';
import StatusBadge from './domain-item/StatusBadge';
import { DomainTooltipContent, DropTimelineTooltip, PlainTooltipText } from './domain-item/TooltipContent';
import {
  formatDate,
  getDaysUntilExpiry,
  getDomainTextStyles,
  getDropLifecycleEstimate,
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
  onRemoveCategory: (domainId: number, categoryId: string) => void;
  onCreateWordGroupCategory: () => void;
  isAutoRefreshing?: boolean;
  isPending?: boolean;
  isTagUpdating?: boolean;
  categoryLabels?: Array<{ id: string; label: string; kind: 'word-group' | 'auto' }>;
  tld?: string;
  isDesktopLayout?: boolean;
}

const DomainItem: React.FC<DomainItemProps> = ({
  domain,
  whoisDetails,
  onRemove,
  onShowInfo,
  onToggleTag,
  onSetTag,
  onRecheck,
  onRemoveCategory,
  onCreateWordGroupCategory,
  isAutoRefreshing = false,
  isPending = false,
  isTagUpdating = false,
  categoryLabels = [],
  tld,
  isDesktopLayout = true,
}) => {
  const [selectedRegistrar, setSelectedRegistrar] = useState<string>('');
  const [isRechecking, setIsRechecking] = useState(false);
  const [pendingCategoryRemovalIds, setPendingCategoryRemovalIds] = useState<Set<string>>(() => new Set());
  const categoryRemovalTimeoutsRef = useRef<number[]>([]);
  const { isCompact } = useCompactMode();

  const registrars = useMemo(() => registrarOptionsForDomain(domain.domain_name), [domain.domain_name]);

  useEffect(() => {
    setSelectedRegistrar(Object.keys(registrars)[0]);
  }, [registrars]);

  useEffect(() => () => {
    categoryRemovalTimeoutsRef.current.forEach(timeoutId => window.clearTimeout(timeoutId));
    categoryRemovalTimeoutsRef.current = [];
  }, []);

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

  const handleRemoveCategory = (categoryId: string) => {
    if (pendingCategoryRemovalIds.has(categoryId)) return;
    setPendingCategoryRemovalIds(current => {
      const next = new Set(current);
      next.add(categoryId);
      return next;
    });
    const timeoutId = window.setTimeout(() => {
      onRemoveCategory(domain.id, categoryId);
      setPendingCategoryRemovalIds(current => {
        const next = new Set(current);
        next.delete(categoryId);
        return next;
      });
      categoryRemovalTimeoutsRef.current = categoryRemovalTimeoutsRef.current.filter(id => id !== timeoutId);
    }, 350);
    categoryRemovalTimeoutsRef.current.push(timeoutId);
  };

  const daysUntilExpiry = getDaysUntilExpiry(domain.expiration_date);
  const dropLifecycleEstimate = domain.status === 'expired' && domain.expiration_date
    ? getDropLifecycleEstimate(domain.expiration_date)
    : null;
  const canDeriveExpiryState = domain.status !== 'available'
    && domain.status !== 'dropped'
    && domain.status !== 'reserved'
    && daysUntilExpiry !== null;
  const isExpiredByDate = canDeriveExpiryState && daysUntilExpiry < 0;
  const isExpiringSoonByDate = canDeriveExpiryState && daysUntilExpiry >= 0 && daysUntilExpiry <= 90;
  const displayStatus = isExpiredByDate ? 'expired' : domain.status;
  const expiredStatusLabel = dropLifecycleEstimate?.phaseLabel;
  const statusLabelOverride = expiredStatusLabel
    || (isExpiredByDate ? 'Expired' : daysUntilExpiry === 0 ? 'Expires today' : isExpiringSoonByDate ? 'Expiring soon' : undefined);
  const isAvailableStatus = domain.status === 'available' || domain.status === 'dropped';
  const isReservedStatus = domain.status === 'reserved';
  const effectiveTag = isAvailableStatus ? 'to-snatch' : domain.tag;
  const isRegisteredTarget = domain.tag === 'to-snatch' && domain.status === 'registered';
  const rowStyles = getRowStyles(displayStatus, effectiveTag, daysUntilExpiry);
  const needsExpiryDate = domain.status !== 'reserved'
    && (domain.status === 'registered' || domain.status === 'expired' || effectiveTag === 'mine')
    && !domain.expiration_date;
  const isAvailableForPurchase = isAvailableStatus;
  const canShowDropTimeline = domain.status === 'expired' && Boolean(domain.expiration_date);
  const actionButtonClass = 'inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-200 disabled:cursor-wait disabled:opacity-50 dark:hover:bg-slate-700';
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
  const mutedRowClass = isRegisteredTarget
    ? 'opacity-60'
    : isWhoisIncomplete
      ? 'opacity-75'
      : '';

  const tooltipContent = useMemo(() => (
    <DomainTooltipContent
      domainName={domain.domain_name}
      status={domain.status === 'dropped' ? 'available' : domain.status === 'reserved' ? 'reserved domain' : domain.status}
      tagLabel={tagLabel}
      tld={tld}
      categoryLabels={categoryLabels.map(item => item.label)}
      expirationDate={domain.expiration_date}
      registeredDate={domain.registered_date}
      registrar={domain.registrar}
      lastChecked={domain.last_checked}
      providerLabel={whoisDetails?.providerLabel}
      registryStatuses={registryStatuses}
      nameServers={nameServers}
      dropLifecycleLabel={expiredStatusLabel}
      dropLifecycleEstimate={dropLifecycleEstimate}
    />
  ), [categoryLabels, domain, dropLifecycleEstimate, expiredStatusLabel, nameServers, registryStatuses, tagLabel, tld, whoisDetails?.providerLabel]);

  const alternateTags = useMemo(
    () => (['mine', 'to-snatch', 'others'] as DomainTag[]).filter(tag => tag !== effectiveTag),
    [effectiveTag],
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
      <Tooltip content={<PlainTooltipText title={`Open ${selectedRegistrarName}`} body="Confirm availability at the registrar before buying." />}>
        <button
          onClick={handleBuyClick}
          className="inline-flex h-8 w-8 flex-none items-center justify-center text-white bg-brand-green transition-colors hover:bg-green-600 rounded-md"
          aria-label={`Open registrar page for ${domain.domain_name} on ${selectedRegistrarName}`}
        >
          <ShoppingCartIcon className="w-4 h-4" />
        </button>
      </Tooltip>
    </div>
  );

  return (
    <div className={`relative overflow-hidden rounded-md border transition-colors ${rowStyles} ${mutedRowClass} ${isCompact ? 'px-3 py-2' : 'px-3 py-2.5 sm:px-4 sm:py-3'}`}>
      {(isWhoisIncomplete || isWhoisProcessing) && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center">
          <span className="rounded-b-md bg-slate-800/90 px-3 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white dark:bg-slate-100/90 dark:text-slate-900">
            {isPending ? 'Checking WHOIS' : isWhoisProcessing ? 'WHOIS retrieval processing' : isWhoisFailed ? 'WHOIS check failed' : 'WHOIS data incomplete'}
          </span>
        </div>
      )}
      <div className={`grid grid-cols-1 gap-2 sm:gap-3 md:grid-cols-[minmax(180px,1.5fr)_minmax(110px,0.7fr)_minmax(120px,0.8fr)_minmax(160px,0.9fr)_auto] md:items-center ${(isWhoisIncomplete || isWhoisProcessing) ? 'pt-4' : ''}`}>
        <div className="min-w-0">
          <span className="flex min-w-0 items-start gap-2">
            <TagIconComponent className={leadingTagIconClass} />
            <span className="min-w-0">
              <span className="inline-flex max-w-full items-center gap-1.5 align-top">
                <Tooltip content={tooltipContent}>
                  <a
                    href={whoisUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`min-w-0 break-all font-semibold leading-snug underline-offset-2 hover:underline ${getDomainTextStyles(displayStatus)} ${isCompact ? 'text-sm' : 'text-base'}`}
                  >
                    {domain.domain_name}
                  </a>
                </Tooltip>
                {effectiveTag === 'mine' && (
                  <a
                    href={siteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-6 w-6 flex-none items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-white/70 hover:text-brand-blue dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                    aria-label={`Open ${domain.domain_name} site in a new tab`}
                    title="Open site"
                  >
                    <ExternalLinkIcon className="h-3.5 w-3.5" />
                  </a>
                )}
              </span>
              {(categoryLabels.length > 0 || tld) && (
                <span className="mt-1 flex flex-wrap items-center gap-1">
                  {categoryLabels.slice(0, 2).map(({ id, label, kind }) => {
                    const isRemovingCategory = pendingCategoryRemovalIds.has(id);
                    return (
                      <span
                        key={id}
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          isRemovingCategory ? 'opacity-80' : ''
                        } ${
                          kind === 'word-group'
                            ? 'bg-blue-100 text-blue-800 ring-1 ring-blue-200 dark:bg-blue-950 dark:text-blue-200 dark:ring-blue-800'
                            : 'bg-white/70 text-slate-600 ring-1 ring-slate-200 dark:bg-slate-900/70 dark:text-slate-300 dark:ring-slate-700'
                        }`}
                      >
                        {label}
                        <button
                          type="button"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            handleRemoveCategory(id);
                          }}
                          disabled={isRemovingCategory}
                          className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full text-slate-400 transition-colors hover:text-red-600 disabled:cursor-wait disabled:hover:text-slate-400 dark:text-slate-500 dark:hover:text-red-300"
                          aria-label={`Remove ${label} category from ${domain.domain_name}`}
                          title={`Remove ${label}`}
                        >
                          {isRemovingCategory ? (
                            <span className="h-3 w-3 animate-spin rounded-full border-b-2 border-brand-blue" aria-hidden="true" />
                          ) : (
                            <XCircleIcon className="h-3 w-3" />
                          )}
                        </button>
                      </span>
                    );
                  })}
                  {categoryLabels.length > 2 && (
                    <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-900/70 dark:text-slate-300">
                      +{categoryLabels.length - 2}
                    </span>
                  )}
                  {tld && (
                    <span className="rounded-full bg-slate-900/10 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-white/10 dark:text-slate-300">
                      {tld}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onCreateWordGroupCategory();
                    }}
                    className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-blue-700 ring-1 ring-blue-200 transition-colors hover:bg-blue-200 dark:bg-blue-950 dark:text-blue-200 dark:ring-blue-800 dark:hover:bg-blue-900"
                    aria-label={`Create word-group category for ${domain.domain_name}`}
                    title="Create word-group category"
                  >
                    <PlusIcon className="h-3 w-3" />
                  </button>
                </span>
              )}
            </span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <StatusBadge status={displayStatus} isCompact={isCompact} labelOverride={statusLabelOverride} />
        </div>

        <div className="text-xs font-medium text-slate-700 dark:text-slate-200 sm:text-sm">
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
                  {displayStatus === 'expired'
                    ? `${expiredStatusLabel || 'Expired'}${dropLifecycleEstimate ? `; drop around ${formatDate(dropLifecycleEstimate.dropDate.toISOString())}` : ''}`
                    : daysUntilExpiry === 0 ? 'Expires today' : `${daysUntilExpiry} days left`}
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

        <div className="hidden min-h-[32px] md:block" />

        <div className="flex items-center justify-between gap-1 border-t border-black/5 pt-2 dark:border-white/10 md:justify-end md:border-0 md:pt-0">
          {isPending ? (
            <Spinner size="sm" color="border-brand-blue" />
          ) : (
            <>
              <button
                onClick={handleRecheck}
                disabled={isRechecking}
                className={actionButtonClass}
                aria-label={`Re-check WHOIS data for ${domain.domain_name}`}
                title="Re-check WHOIS"
              >
                {isRechecking ? <Spinner size="sm" color="border-brand-blue" /> : <RefreshIcon className="w-5 h-5" />}
              </button>
              {canShowDropTimeline && (
                <Tooltip content={dropLifecycleEstimate ? <DropTimelineTooltip estimate={dropLifecycleEstimate} /> : <PlainTooltipText title="Show drop timeline" body="Estimate grace, redemption, and release timing." />}>
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
                <span
                  className="inline-flex h-8 w-8 cursor-default items-center justify-center"
                  aria-label={`${domain.domain_name} is marked To Snatch because it is available`}
                  title="To Snatch"
                >
                  <TargetIcon className={tagIconClass} />
                </span>
              ) : isReservedStatus ? (
                <span
                  className="inline-flex h-8 w-8 cursor-default items-center justify-center"
                  aria-label={`${domain.domain_name} is reserved and skipped by automatic refresh`}
                  title="Reserved domain"
                >
                  <InfoIcon className="h-5 w-5 text-amber-700 dark:text-amber-300" />
                </span>
              ) : (
                <div className="group/tag relative inline-flex items-center gap-1 rounded-md focus-within:bg-slate-200 hover:bg-slate-200 dark:focus-within:bg-slate-700 dark:hover:bg-slate-700">
                  {isTagUpdating && (
                    <span className="absolute inset-0 z-30 flex items-center justify-center rounded-md bg-white/80 dark:bg-slate-900/80">
                      <Spinner size="sm" color="border-brand-blue" />
                    </span>
                  )}
                  {isDesktopLayout ? (
                    <span className="pointer-events-none absolute right-8 top-0 z-20 hidden h-8 items-center gap-1 rounded-md bg-white/95 px-1 shadow-sm ring-1 ring-slate-200 group-hover/tag:pointer-events-auto group-hover/tag:inline-flex group-focus-within/tag:pointer-events-auto group-focus-within/tag:inline-flex dark:bg-slate-900/95 dark:ring-slate-700 md:flex">
                      {alternateTags.map(tag => {
                        const OptionIcon = getTagIcon(tag);
                        const optionLabel = getTagLabel(tag);
                        return (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => onSetTag(domain.id, tag)}
                            disabled={isTagUpdating}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-white/70 dark:hover:bg-slate-800"
                            aria-label={`Set ${domain.domain_name} tag to ${optionLabel}`}
                            title={`Set ${optionLabel}`}
                          >
                            <OptionIcon className={`h-5 w-5 ${getTagColorClass(tag)}`} />
                          </button>
                        );
                      })}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-0.5">
                      {alternateTags.map(tag => {
                        const OptionIcon = getTagIcon(tag);
                        const optionLabel = getTagLabel(tag);
                        return (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => onSetTag(domain.id, tag)}
                            disabled={isTagUpdating}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-white/70 disabled:opacity-50 dark:hover:bg-slate-800"
                            aria-label={`Set ${domain.domain_name} tag to ${optionLabel}`}
                            title={`Set ${optionLabel}`}
                          >
                            <OptionIcon className={`h-4 w-4 ${getTagColorClass(tag)}`} />
                          </button>
                        );
                      })}
                    </span>
                  )}
                  <button
                    onClick={() => onToggleTag(domain.id)}
                    disabled={isTagUpdating}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors"
                    aria-label={`Current tag for ${domain.domain_name}: ${tagLabel}`}
                    title={`Current tag: ${tagLabel}`}
                  >
                    <TagIconComponent className={tagIconClass} />
                  </button>
                </div>
              )}
              <button
                onClick={() => onRemove(domain.id)}
                className="p-1.5 text-red-500 transition-colors hover:bg-red-100 dark:hover:bg-red-900/50 rounded-md"
                aria-label={`Remove ${domain.domain_name} from tracking list`}
                title="Remove domain"
              >
                <TrashIcon className="w-5 h-5" />
              </button>
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
  && prev.isTagUpdating === next.isTagUpdating
  && prev.tld === next.tld
  && prev.isDesktopLayout === next.isDesktopLayout
  && prev.categoryLabels === next.categoryLabels
  && areStringArraysEqual(
    prev.categoryLabels?.map(item => `${item.kind}:${item.id}:${item.label}`),
    next.categoryLabels?.map(item => `${item.kind}:${item.id}:${item.label}`),
  )
));
