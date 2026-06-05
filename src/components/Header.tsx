import React, { useState } from 'react';
import ModeToggle from './ModeToggle';
import CompactModeToggle from './CompactModeToggle';
import { BellIcon, BookOpenIcon, CommandLineIcon, DomainCodevIcon, LogOutIcon, SettingsIcon, TagIcon, UserCircleIcon } from './icons';
import Tooltip from './Tooltip';
import { Session } from '@supabase/supabase-js';
import { signOut } from '../services/supabaseService';

interface HeaderProps {
    session: Session | null;
    notifications: string[];
    clearNotifications: () => void;
    setView: (view: 'dashboard' | 'docs' | 'categories' | 'settings') => void;
    onViewIntent?: (view: 'dashboard' | 'docs' | 'categories' | 'settings') => void;
    onOpenIntegrations: () => void;
}

const Header: React.FC<HeaderProps> = ({ session, notifications, clearNotifications, setView, onViewIntent, onOpenIntegrations }) => {
  const [showNotifications, setShowNotifications] = useState(false);

  return (
    <header className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-lg sticky top-0 z-40 shadow-sm dark:shadow-slate-700/[.7]">
      <div className="container mx-auto px-4 md:px-8">
        <div className="flex items-center justify-between h-16">
          <Tooltip content="Domain Codev dashboard">
            <button
              onMouseEnter={() => onViewIntent?.('dashboard')}
              onFocus={() => onViewIntent?.('dashboard')}
              onClick={() => setView('dashboard')}
              className="inline-flex items-center gap-2 rounded-lg p-2 text-brand-blue hover:bg-blue-50 dark:hover:bg-slate-700"
              aria-label="Open Domain Codev dashboard"
            >
              <DomainCodevIcon className="h-7 w-7" />
              <span className="hidden text-xl font-bold sm:inline">Domain Codev</span>
            </button>
          </Tooltip>
          <div className="flex items-center space-x-2 sm:space-x-4">
            {session && (
              <>
                <Tooltip content={session.user.email || 'Signed in account'}>
                  <span
                    className="hidden rounded-full p-2 text-slate-600 dark:text-slate-400 md:inline-flex"
                    aria-label={session.user.email || 'Signed in account'}
                  >
                    <UserCircleIcon className="h-6 w-6" />
                  </span>
                </Tooltip>
                <Tooltip content="Documentation">
                  <button
                    onMouseEnter={() => onViewIntent?.('docs')}
                    onFocus={() => onViewIntent?.('docs')}
                    onClick={() => setView('docs')}
                    className="rounded-full p-2 text-slate-600 transition-colors hover:bg-slate-200 hover:text-brand-blue dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
                    aria-label="Open documentation"
                  >
                    <BookOpenIcon className="h-6 w-6" />
                  </button>
                </Tooltip>
                <Tooltip content="Categories">
                  <button
                    onMouseEnter={() => onViewIntent?.('categories')}
                    onFocus={() => onViewIntent?.('categories')}
                    onClick={() => setView('categories')}
                    className="rounded-full p-2 text-slate-600 transition-colors hover:bg-slate-200 hover:text-brand-blue dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
                    aria-label="Open categories"
                  >
                    <TagIcon className="h-6 w-6" />
                  </button>
                </Tooltip>
                <Tooltip content="Integration API tokens">
                  <button
                    onClick={onOpenIntegrations}
                    className="rounded-full p-2 text-slate-600 transition-colors hover:bg-slate-200 hover:text-brand-blue dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
                    aria-label="Open integration API tokens"
                  >
                    <CommandLineIcon className="h-6 w-6" />
                  </button>
                </Tooltip>
                <Tooltip content="Settings">
                  <button
                    onMouseEnter={() => onViewIntent?.('settings')}
                    onFocus={() => onViewIntent?.('settings')}
                    onClick={() => setView('settings')}
                    className="rounded-full p-2 text-slate-600 transition-colors hover:bg-slate-200 hover:text-brand-blue dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
                    aria-label="Open settings"
                  >
                    <SettingsIcon className="h-6 w-6" />
                  </button>
                </Tooltip>
                <div className="relative">
                  <Tooltip content="Notifications">
                    <button
                      onClick={() => setShowNotifications(!showNotifications)}
                      className="relative text-slate-600 dark:text-slate-400 hover:text-brand-blue dark:hover:text-white transition-colors p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700"
                      aria-label="Toggle notifications"
                    >
                      <BellIcon className="w-6 h-6" />
                      {notifications.length > 0 && (
                        <span className="absolute -top-1 -right-1 flex h-4 w-4">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-4 w-4 bg-brand-red text-white text-xs items-center justify-center">
                            {notifications.length}
                          </span>
                        </span>
                      )}
                    </button>
                  </Tooltip>
                  {showNotifications && (
                    <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-700 rounded-lg shadow-xl overflow-hidden z-50">
                        <div className="p-3 font-semibold text-slate-800 dark:text-white border-b border-slate-200 dark:border-slate-600">Notifications</div>
                        {notifications.length > 0 ? (
                            <ul>
                                {notifications.map((note, index) => (
                                    <li key={index} className="p-3 text-sm text-slate-600 dark:text-slate-300 border-b border-slate-100 dark:border-slate-600">
                                        {note}
                                    </li>
                                ))}
                                <li className="p-2 text-center">
                                    <button onClick={() => { clearNotifications(); setShowNotifications(false); }} className="text-sm text-brand-blue hover:underline">
                                        Clear all
                                    </button>
                                </li>
                            </ul>
                        ) : (
                            <p className="p-4 text-sm text-slate-500 dark:text-slate-400">No new notifications.</p>
                        )}
                    </div>
                  )}
                </div>
              </>
            )}
            <CompactModeToggle />
            <ModeToggle />
            {session && (
              <Tooltip content="Log out">
                <button
                  onClick={signOut}
                  className="rounded-full p-2 text-brand-red transition-colors hover:bg-red-100 hover:text-red-700 dark:hover:bg-red-900/50"
                  aria-label="Log out"
                >
                  <LogOutIcon className="h-6 w-6" />
                </button>
              </Tooltip>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
