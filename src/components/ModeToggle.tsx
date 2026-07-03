

import React from 'react';
import { useDarkMode } from '../hooks/useDarkMode';
import { SunIcon, MoonIcon } from './icons';
import { HEADER_ICON_CLASS, headerControlClass } from './headerStyles';

const ModeToggle: React.FC = () => {
  const [theme, toggleTheme] = useDarkMode();

  return (
    <button
      onClick={toggleTheme}
      className={headerControlClass()}
      aria-label="Toggle dark mode"
    >
      {theme === 'light' ? (
        <MoonIcon className={HEADER_ICON_CLASS} />
      ) : (
        <SunIcon className={HEADER_ICON_CLASS} />
      )}
    </button>
  );
};

export default ModeToggle;
