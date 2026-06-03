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
        className="p-2 rounded-full text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
        aria-label={label}
      >
        {isCompact ? (
          <ArrowsPointingOutIcon className="w-6 h-6" />
        ) : (
          <ArrowsPointingInIcon className="w-6 h-6" />
        )}
      </button>
    </Tooltip>
  );
};

export default CompactModeToggle;
