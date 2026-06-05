import React from 'react';
import { DomainStatus } from '../../types';

const StatusBadge: React.FC<{ status: DomainStatus, isCompact: boolean }> = ({ status, isCompact }) => {
  const statusStyles: { [key in DomainStatus]: string } = {
    available: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    dropped: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    registered: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
    expired: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
    reserved: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300',
    unknown: 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300',
  };

  const statusText = status === 'dropped' ? 'available' : status === 'reserved' ? 'reserved domain' : status;

  return (
    <span className={`rounded-full px-2 font-semibold capitalize ${statusStyles[status]} ${isCompact ? 'py-0 text-[9px]' : 'py-0.5 text-[10px]'}`}>
      {statusText}
    </span>
  );
};

export default StatusBadge;
