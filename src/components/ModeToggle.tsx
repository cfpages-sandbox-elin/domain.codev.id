

import React from 'react';
import { useDarkMode } from '../hooks/useDarkMode';
import { SunIcon, MoonIcon } from './icons';

const ModeToggle: React.FC = () => {
  const [theme, toggleTheme] = useDarkMode();

  return (
    <button
      onClick={toggleTheme}
      className="rounded-full p-1.5 text-slate-600 transition-colors hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-700 sm:p-2"
      aria-label="Toggle dark mode"
    >
      {theme === 'light' ? (
        <MoonIcon className="h-5 w-5 sm:h-6 sm:w-6" />
      ) : (
        <SunIcon className="h-5 w-5 sm:h-6 sm:w-6" />
      )}
    </button>
  );
};

export default ModeToggle;
