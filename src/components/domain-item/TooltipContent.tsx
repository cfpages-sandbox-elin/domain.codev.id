import React from 'react';
import {
  explainRegistryStatus,
  formatDate,
  formatDateWithTime,
  humanizeRegistryStatus,
  type DropLifecycleEstimate,
} from './domainItemLogic';

export const DetailRow: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="grid grid-cols-[76px_1fr] items-baseline gap-1.5 leading-tight">
    <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">{label}</span>
    <span className="break-words text-xs text-slate-700 dark:text-slate-200">{value}</span>
  </div>
);

export const PlainTooltipText: React.FC<{ title: string; body?: string }> = ({ title, body }) => (
  <span>
    <span className="block font-semibold text-slate-800 dark:text-slate-100">{title}</span>
    {body && <span className="mt-0.5 block text-slate-500 dark:text-slate-400">{body}</span>}
  </span>
);

export const DropTimelineTooltip: React.FC<{ estimate: DropLifecycleEstimate }> = ({ estimate }) => (
  <span className="block min-w-[220px] space-y-2">
    <span className="block font-semibold text-slate-800 dark:text-slate-100">{estimate.phaseLabel}</span>
    <span className="block text-slate-500 dark:text-slate-400">
      Estimated timeline. Actual registry and registrar policies may vary.
    </span>
    <span className="block space-y-1">
      <span className="grid grid-cols-[92px_1fr] gap-2">
        <span className="text-slate-400 dark:text-slate-500">Expired</span>
        <span className="text-slate-700 dark:text-slate-200">{formatDate(estimate.expiryDate.toISOString())}</span>
      </span>
      <span className="grid grid-cols-[92px_1fr] gap-2">
        <span className="text-slate-400 dark:text-slate-500">Grace ends</span>
        <span className="text-slate-700 dark:text-slate-200">{formatDate(estimate.gracePeriodEnd.toISOString())}</span>
      </span>
      <span className="grid grid-cols-[92px_1fr] gap-2">
        <span className="text-slate-400 dark:text-slate-500">Redemption</span>
        <span className="text-slate-700 dark:text-slate-200">{formatDate(estimate.redemptionPeriodEnd.toISOString())}</span>
      </span>
      <span className="grid grid-cols-[92px_1fr] gap-2">
        <span className="text-slate-400 dark:text-slate-500">Drop</span>
        <span className="text-slate-700 dark:text-slate-200">{formatDate(estimate.dropDate.toISOString())}</span>
      </span>
    </span>
  </span>
);

interface DomainTooltipContentProps {
  domainName: string;
  status: string;
  tagLabel: string;
  tld?: string;
  categoryLabels: string[];
  expirationDate: string | null;
  registeredDate: string | null;
  registrar: string | null;
  lastChecked: string | null;
  providerLabel?: string;
  registryStatuses: string[];
  nameServers: string[];
  dropLifecycleLabel?: string;
  dropLifecycleEstimate?: DropLifecycleEstimate | null;
}

export const DomainTooltipContent: React.FC<DomainTooltipContentProps> = ({
  domainName,
  status,
  tagLabel,
  tld,
  categoryLabels,
  expirationDate,
  registeredDate,
  registrar,
  lastChecked,
  providerLabel,
  registryStatuses,
  nameServers,
  dropLifecycleLabel,
  dropLifecycleEstimate,
}) => (
  <div className="w-full space-y-2.5 text-xs">
    {/* Header: Domain name + pills */}
    <div className="border-b border-slate-200/80 pb-2 dark:border-slate-700/80">
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <span className="font-mono text-sm font-bold text-slate-900 dark:text-slate-100">
          {domainName}
        </span>
        <div className="flex flex-wrap items-center gap-1">
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-700 dark:bg-slate-700 dark:text-slate-200">
            {status}
          </span>
          <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-950/80 dark:text-blue-300">
            {tagLabel}
          </span>
          {tld && (
            <span className="rounded bg-slate-200/70 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-700/70 dark:text-slate-300">
              {tld}
            </span>
          )}
        </div>
      </div>
      {categoryLabels.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1 text-[10px] text-slate-500 dark:text-slate-400">
          <span className="font-medium text-slate-400 dark:text-slate-500">Categories:</span>
          {categoryLabels.join(', ')}
        </div>
      )}
    </div>

    {/* Horizontal 2-Column Grid */}
    <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
      {/* Left Column: Lifecycle dates & Registrar */}
      <div className="space-y-1.5">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Registration Details
        </p>
        <DetailRow label="Expires" value={formatDate(expirationDate)} />
        {dropLifecycleLabel && <DetailRow label="Phase" value={dropLifecycleLabel} />}
        <DetailRow label="Registered" value={formatDate(registeredDate)} />
        <DetailRow label="Registrar" value={registrar || 'N/A'} />
        <DetailRow label="Last check" value={formatDateWithTime(lastChecked)} />
        {providerLabel && <DetailRow label="Provider" value={providerLabel} />}
      </div>

      {/* Right Column: Drop timeline estimate / Registry status */}
      <div className="space-y-2">
        {dropLifecycleEstimate ? (
          <div className="space-y-1 rounded bg-slate-50/80 p-2 dark:bg-slate-900/50">
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
              Drop Timeline Estimate
            </p>
            <DetailRow label="Grace ends" value={formatDate(dropLifecycleEstimate.gracePeriodEnd.toISOString())} />
            <DetailRow label="Redemption" value={formatDate(dropLifecycleEstimate.redemptionPeriodEnd.toISOString())} />
            <DetailRow label="Est. drop" value={formatDate(dropLifecycleEstimate.dropDate.toISOString())} />
          </div>
        ) : (status === 'available' || status === 'dropped') ? (
          <div className="space-y-1 rounded bg-green-50/80 p-2 dark:bg-green-950/30">
            <p className="text-[10px] font-bold uppercase tracking-wider text-green-700 dark:text-green-400">
              Availability Freshness
            </p>
            <p className="text-[11px] font-semibold text-green-800 dark:text-green-300">
              {lastChecked ? `Available · Verified ${formatDate(lastChecked)}` : 'Available for registration'}
            </p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              Auto re-check runs periodically to verify domain remains unregistered.
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Drop Status
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Active domain. Drop estimate activates upon expiration.
            </p>
          </div>
        )}

        {/* Registry Status Badges */}
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Registry Status
          </p>
          {registryStatuses.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {registryStatuses.map(statusValue => (
                <span
                  key={statusValue}
                  className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-300"
                >
                  {humanizeRegistryStatus(statusValue)}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-slate-400 dark:text-slate-500">No registry codes stored</p>
          )}
        </div>

        {/* Name Servers */}
        <div>
          <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Name Servers
          </p>
          {nameServers.length > 0 ? (
            <div className="space-y-0.5">
              {nameServers.slice(0, 3).map(server => (
                <div key={server} className="truncate font-mono text-[10px] text-slate-600 dark:text-slate-300">
                  {server}
                </div>
              ))}
              {nameServers.length > 3 && (
                <div className="text-[10px] text-slate-400 dark:text-slate-500">
                  +{nameServers.length - 3} more
                </div>
              )}
            </div>
          ) : (
            <p className="text-[11px] text-slate-400 dark:text-slate-500">None returned</p>
          )}
        </div>
      </div>
    </div>
  </div>
);
