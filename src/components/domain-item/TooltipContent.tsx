import React from 'react';
import {
  explainRegistryStatus,
  formatDate,
  formatDateWithTime,
  humanizeRegistryStatus,
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
}) => (
  <div className="space-y-3">
    <div className="space-y-1">
      <DetailRow label="Domain" value={domainName} />
      <DetailRow label="Status" value={status} />
      <DetailRow label="Tag" value={tagLabel} />
      <DetailRow label="TLD" value={tld || 'N/A'} />
      {categoryLabels.length > 0 && <DetailRow label="Category" value={categoryLabels.join(', ')} />}
      <DetailRow label="Expires" value={formatDate(expirationDate)} />
      <DetailRow label="Registered" value={formatDate(registeredDate)} />
      <DetailRow label="Registrar" value={registrar || 'N/A'} />
      <DetailRow label="Last check" value={formatDateWithTime(lastChecked)} />
      {providerLabel && <DetailRow label="Provider" value={providerLabel} />}
    </div>

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
