import React, { useState } from 'react';
import ModeToggle from './ModeToggle';
import { BellIcon } from './icons';
import { Session } from '@supabase/supabase-js';
import { signOut } from '../services/supabaseService';

interface HeaderProps {
    session: Session | null;
    notifications: string[];
    clearNotifications: () => void;
    setView: (view: 'dashboard' | 'docs') => void;
}

const Header: React.FC<HeaderProps> = ({ session, notifications, clearNotifications, setView }) => {
  const [showNotifications, setShowNotifications] = useState(false);

  return (
    <header className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-lg sticky top-0 z-40 shadow-sm dark:shadow-slate-700/[.7]">
      <div className="container mx-auto px-4 md:px-8">
        <div className="flex items-center justify-between h-16">
          <button onClick={() => setView('dashboard')} className="text-2xl font-bold text-brand-blue">
            Domain Codev
          </button>
          <div className="flex items-center space-x-2 sm:space-x-4">
            {session && (
              <>
                <div className="hidden md:block text-sm text-slate-600 dark:text-slate-400">
                  {session.user.email}
                </div>
                <button onClick={() => setView('docs')} className="hidden sm:inline-block px-3 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors">
                    Documentation
                </button>
                <div className="relative">
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
            <ModeToggle />
            {session && (
              <button
                onClick={signOut}
                className="px-3 py-2 text-sm font-semibold text-white bg-brand-red hover:bg-red-600 rounded-lg transition-colors"
              >
                Logout
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;