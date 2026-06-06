import React from 'react';
import {
  explainRegistryStatus,
  formatDate,
  formatDateWithTime,
  humanizeRegistryStatus,
  type DropLifecycleEstimate,
} from './domainItemLogic';

export const DetailRow: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="grid grid-cols-[92px_1fr] gap-2">
    <span className="text-slate-400 dark:text-slate-500">{label}</span>
    <span className="text-slate-700 dark:text-slate-200">{value}</span>
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
  <div className="space-y-3">
    <div className="space-y-1">
      <DetailRow label="Domain" value={domainName} />
      <DetailRow label="Status" value={status} />
      <DetailRow label="Tag" value={tagLabel} />
      <DetailRow label="TLD" value={tld || 'N/A'} />
      {categoryLabels.length > 0 && <DetailRow label="Category" value={categoryLabels.join(', ')} />}
      <DetailRow label="Expires" value={formatDate(expirationDate)} />
      {dropLifecycleLabel && <DetailRow label="Phase" value={dropLifecycleLabel} />}
      <DetailRow label="Registered" value={formatDate(registeredDate)} />
      <DetailRow label="Registrar" value={registrar || 'N/A'} />
      <DetailRow label="Last check" value={formatDateWithTime(lastChecked)} />
      {providerLabel && <DetailRow label="Provider" value={providerLabel} />}
    </div>

    {dropLifecycleEstimate && (
      <div>
        <p className="mb-1 font-semibold text-slate-700 dark:text-slate-200">Estimated drop timeline</p>
        <div className="space-y-1">
          <DetailRow label="Grace ends" value={formatDate(dropLifecycleEstimate.gracePeriodEnd.toISOString())} />
          <DetailRow label="Redemption" value={formatDate(dropLifecycleEstimate.redemptionPeriodEnd.toISOString())} />
          <DetailRow label="Drop" value={formatDate(dropLifecycleEstimate.dropDate.toISOString())} />
        </div>
        <p className="mt-1 text-slate-500 dark:text-slate-400">Estimate only. Actual timing can vary by TLD, registry, and registrar.</p>
      </div>
    )}

    <div>
      <p className="mb-1 font-semibold text-slate-700 dark:text-slate-200">Registry status</p>
      {registryStatuses.length > 0 ? (
        <ul className="space-y-1">
          {registryStatuses.map(statusValue => (
            <li key={statusValue}>
              <span className="font-medium text-slate-800 dark:text-slate-100">{humanizeRegistryStatus(statusValue)}</span>
              <span className="block text-slate-500 dark:text-slate-400">{explainRegistryStatus(statusValue)}</span>
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
        <p className="text-slate-500 dark:text-slate-400">No name server details returned by the provider.</p>
      )}
    </div>
  </div>
);
