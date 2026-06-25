import React from 'react';
import { useCompactMode } from '../contexts/CompactModeContext';
import { ArrowsPointingInIcon, ArrowsPointingOutIcon } from './icons';
import Tooltip from './Tooltip';

const CompactModeToggle: React.FC = () => {
  const { isCompact, toggleCompactMode } = useCompactMode();
  const label = isCompact ? 'Switch to Standard View' : 'Switch to Compact View';

  return (
    <Tooltip content={label}>
      <button
        onClick={toggleCompactMode}
        className="rounded-full p-1.5 text-slate-600 transition-colors hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-700 sm:p-2"
        aria-label={label}
      >
        {isCompact ? (
          <ArrowsPointingOutIcon className="h-5 w-5 sm:h-6 sm:w-6" />
        ) : (
          <ArrowsPointingInIcon className="h-5 w-5 sm:h-6 sm:w-6" />
        )}
      </button>
    </Tooltip>
  );
};

export default CompactModeToggle;
