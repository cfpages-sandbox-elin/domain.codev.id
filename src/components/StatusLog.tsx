import React, { useState, useMemo } from 'react';
import { ChevronDownIcon, CommandLineIcon, CheckCircleIcon, XCircleIcon, ExclamationTriangleIcon, InformationCircleIcon } from './icons';
import { useOutsideDismiss } from '../hooks/useOutsideDismiss';
import { FLOATING_ACTION_ICON_CLASS, floatingActionButtonClass, floatingActionContainerClass } from './floatingActionStyles';

interface StatusLogProps {
  logs: string[];
}

const getLogMetadata = (log: string) => {
    if (log.includes('✅')) return { Icon: CheckCircleIcon, color: 'text-green-500', dot: 'bg-green-500' };
    if (log.includes('❌')) return { Icon: XCircleIcon, color: 'text-red-500', dot: 'bg-red-500' };
    if (log.includes('⚠️')) return { Icon: ExclamationTriangleIcon, color: 'text-yellow-500', dot: 'bg-yellow-500' };
    if (log.includes('➡️')) return { Icon: InformationCircleIcon, color: 'text-blue-500', dot: 'bg-blue-500' };
    return { Icon: InformationCircleIcon, color: 'text-slate-500', dot: 'bg-slate-500' };
};

const StatusLog: React.FC<StatusLogProps> = ({ logs }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const statusLogRef = useOutsideDismiss<HTMLDivElement>(isExpanded, () => setIsExpanded(false));
  
  const latestLogDot = useMemo(() => {
    if (logs.length === 0) return 'bg-slate-500';
    return getLogMetadata(logs[0]).dot;
  }, [logs]);

  if (logs.length === 0) {
      return null;
  }

  return (
    <div ref={statusLogRef} className={`${floatingActionContainerClass('left')} font-sans`}>
        {isExpanded ? (
            <div className="flex h-[min(400px,70vh)] w-[calc(100vw-1.5rem)] max-w-96 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white/90 shadow-2xl backdrop-blur-lg dark:border-slate-700 dark:bg-slate-800/90">
                <header className="flex items-center justify-between p-3 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
                    <h3 className="font-semibold text-slate-800 dark:text-slate-200">System Status</h3>
                    <button 
                        onClick={() => setIsExpanded(false)}
                        className="p-1 rounded-full text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        aria-label="Collapse status log"
                    >
                        <ChevronDownIcon className="w-5 h-5" />
                    </button>
                </header>
                <div className="flex-grow p-3 overflow-y-auto">
                    <ul className="space-y-2">
                        {logs.map((log, index) => {
                            const { Icon, color } = getLogMetadata(log);
                            return (
                                <li key={index} className={`flex items-start gap-2 text-sm ${color}`}>
                                    <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                    <span className="font-mono text-slate-600 dark:text-slate-400 break-words">{log}</span>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            </div>
        ) : (
            <button
                onClick={() => setIsExpanded(true)}
                className={floatingActionButtonClass('neutral')}
                aria-label="Expand status log"
            >
                <CommandLineIcon className={FLOATING_ACTION_ICON_CLASS} />
                <span className={`absolute top-1 right-1 block h-3 w-3 rounded-full ${latestLogDot} ring-2 ring-white dark:ring-slate-800`}></span>
            </button>
        )}
    </div>
  );
};

export default StatusLog;
