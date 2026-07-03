import React, { useState } from 'react';
import ModeToggle from './ModeToggle';
import CompactModeToggle from './CompactModeToggle';
import { BellIcon, BookOpenIcon, CalendarClockIcon, CommandLineIcon, DomainCodevIcon, LogOutIcon, SettingsIcon, TagIcon, UserCircleIcon } from './icons';
import Tooltip from './Tooltip';
import { Session } from '@supabase/supabase-js';
import { signOut } from '../services/supabaseService';
import { useOutsideDismiss } from '../hooks/useOutsideDismiss';
import { HEADER_ICON_CLASS, headerControlClass } from './headerStyles';

interface HeaderProps {
    session: Session | null;
    notifications: string[];
    clearNotifications: () => void;
    setView: (view: 'dashboard' | 'schedule' | 'docs' | 'categories' | 'settings') => void;
    onViewIntent?: (view: 'dashboard' | 'schedule' | 'docs' | 'categories' | 'settings') => void;
    onOpenIntegrations: () => void;
}

const Header: React.FC<HeaderProps> = ({ session, notifications, clearNotifications, setView, onViewIntent, onOpenIntegrations }) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationRef = useOutsideDismiss<HTMLDivElement>(showNotifications, () => setShowNotifications(false));

  return (
    <header className="bg-white/85 dark:bg-slate-800/85 backdrop-blur-lg sticky top-0 z-40 shadow-sm dark:shadow-slate-700/[.7]">
      <div className="container mx-auto px-2 sm:px-4 md:px-8">
        <div className="flex h-14 items-center justify-between gap-1 sm:h-16">
          <Tooltip content="Domain Codev dashboard">
            <button
              onMouseEnter={() => onViewIntent?.('dashboard')}
              onFocus={() => onViewIntent?.('dashboard')}
              onClick={() => setView('dashboard')}
              className="inline-flex min-w-0 items-center gap-2 rounded-lg p-1.5 text-brand-blue hover:bg-blue-50 dark:hover:bg-slate-700 sm:p-2"
              aria-label="Open Domain Codev dashboard"
            >
              <DomainCodevIcon className="h-6 w-6 sm:h-7 sm:w-7" />
              <span className="hidden text-xl font-bold md:inline">Domain Codev</span>
            </button>
          </Tooltip>
          <div className="flex min-w-0 items-center gap-0.5 sm:gap-1 md:gap-1.5">
            {session && (
              <>
                <Tooltip content={session.user.email || 'Signed in account'}>
                  <span
                    className={`${headerControlClass()} hidden md:inline-flex`}
                    aria-label={session.user.email || 'Signed in account'}
                  >
                    <UserCircleIcon className={HEADER_ICON_CLASS} />
                  </span>
                </Tooltip>
                <Tooltip content="Documentation">
                  <button
                    onMouseEnter={() => onViewIntent?.('docs')}
                    onFocus={() => onViewIntent?.('docs')}
                    onClick={() => setView('docs')}
                    className={`${headerControlClass()} hidden sm:inline-flex`}
                    aria-label="Open documentation"
                  >
                    <BookOpenIcon className={HEADER_ICON_CLASS} />
                  </button>
                </Tooltip>
                <Tooltip content="Categories">
                  <button
                    onMouseEnter={() => onViewIntent?.('categories')}
                    onFocus={() => onViewIntent?.('categories')}
                    onClick={() => setView('categories')}
                    className={headerControlClass()}
                    aria-label="Open categories"
                  >
                    <TagIcon className={HEADER_ICON_CLASS} />
                  </button>
                </Tooltip>
                <Tooltip content="WHOIS update schedule">
                  <button
                    onMouseEnter={() => onViewIntent?.('schedule')}
                    onFocus={() => onViewIntent?.('schedule')}
                    onClick={() => setView('schedule')}
                    className={headerControlClass()}
                    aria-label="Open WHOIS update schedule"
                  >
                    <CalendarClockIcon className={HEADER_ICON_CLASS} />
                  </button>
                </Tooltip>
                <Tooltip content="Integration API tokens">
                  <button
                    onClick={onOpenIntegrations}
                    className={`${headerControlClass()} hidden sm:inline-flex`}
                    aria-label="Open integration API tokens"
                  >
                    <CommandLineIcon className={HEADER_ICON_CLASS} />
                  </button>
                </Tooltip>
                <Tooltip content="Settings">
                  <button
                    onMouseEnter={() => onViewIntent?.('settings')}
                    onFocus={() => onViewIntent?.('settings')}
                    onClick={() => setView('settings')}
                    className={headerControlClass()}
                    aria-label="Open settings"
                  >
                    <SettingsIcon className={HEADER_ICON_CLASS} />
                  </button>
                </Tooltip>
                <div className="relative" ref={notificationRef}>
                  <Tooltip content="Notifications">
                    <button
                      onClick={() => setShowNotifications(!showNotifications)}
                      className={`${headerControlClass()} relative`}
                      aria-label="Toggle notifications"
                    >
                      <BellIcon className={HEADER_ICON_CLASS} />
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
                    <div className="absolute right-0 z-50 mt-2 w-[calc(100vw-1rem)] max-w-80 overflow-hidden rounded-lg bg-white shadow-xl dark:bg-slate-700">
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
                  className={headerControlClass('danger')}
                  aria-label="Log out"
                >
                  <LogOutIcon className={HEADER_ICON_CLASS} />
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
