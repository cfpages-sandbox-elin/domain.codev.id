import React from 'react';
import { useCompactMode } from '../contexts/CompactModeContext';
import { ArrowsPointingInIcon, ArrowsPointingOutIcon } from './icons';
import Tooltip from './Tooltip';
import { HEADER_ICON_CLASS, headerControlClass } from './headerStyles';

const CompactModeToggle: React.FC = () => {
  const { isCompact, toggleCompactMode } = useCompactMode();
  const label = isCompact ? 'Switch to Standard View' : 'Switch to Compact View';

  return (
    <Tooltip content={label}>
      <button
        onClick={toggleCompactMode}
        className={headerControlClass()}
        aria-label={label}
      >
        {isCompact ? (
          <ArrowsPointingOutIcon className={HEADER_ICON_CLASS} />
        ) : (
          <ArrowsPointingInIcon className={HEADER_ICON_CLASS} />
        )}
      </button>
    </Tooltip>
  );
};

export default CompactModeToggle;
