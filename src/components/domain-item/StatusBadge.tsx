import React from 'react';
import { DomainStatus } from '../../types';

const StatusBadge: React.FC<{ status: DomainStatus, isCompact: boolean, labelOverride?: string }> = ({ status, isCompact, labelOverride }) => {
  const statusStyles: { [key in DomainStatus]: string } = {
    available: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    dropped: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    registered: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
    expired: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
    reserved: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300',
    unknown: 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300',
  };

  const isPendingDelete = labelOverride?.toLowerCase().includes('pending delete');
  const isConfirmedNotDropped = labelOverride?.toLowerCase().includes('not dropped');
  const badgeStyle = isPendingDelete
    ? 'bg-rose-100 text-rose-900 border border-rose-300/80 dark:bg-rose-950/80 dark:text-rose-200 dark:border-rose-700'
    : isConfirmedNotDropped
      ? 'bg-amber-100 text-amber-900 border border-amber-300/80 dark:bg-amber-950/80 dark:text-amber-200 dark:border-amber-700'
      : statusStyles[status];

  const statusText = labelOverride || (status === 'dropped' ? 'available' : status === 'reserved' ? 'reserved domain' : status);

  return (
    <span className={`rounded-full px-2 font-semibold capitalize ${badgeStyle} ${isCompact ? 'py-0 text-[9px]' : 'py-0.5 text-[10px]'}`}>
      {statusText}
    </span>
  );
};

export default StatusBadge;
