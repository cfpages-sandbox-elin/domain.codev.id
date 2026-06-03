import React from 'react';

interface TooltipProps {
  children: React.ReactNode;
  content: React.ReactNode;
  className?: string;
}

const Tooltip: React.FC<TooltipProps> = ({ children, content, className = '' }) => {
  return (
    <span className={`group relative inline-flex ${className}`}>
      {children}
      <span className="pointer-events-none absolute left-0 top-full z-50 mt-2 hidden w-80 max-w-[calc(100vw-2rem)] rounded-md border border-slate-200 bg-white p-3 text-left text-xs font-normal text-slate-600 shadow-xl group-hover:block group-focus-within:block dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 sm:left-1/2 sm:-translate-x-1/2">
        {content}
      </span>
    </span>
  );
};

export default Tooltip;
