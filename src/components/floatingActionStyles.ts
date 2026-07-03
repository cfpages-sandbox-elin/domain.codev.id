export const FLOATING_ACTION_BUTTON_CLASS = 'relative inline-flex h-12 w-12 cursor-pointer items-center justify-center rounded-full border shadow-lg transition-colors focus:outline-none focus:ring-4 disabled:cursor-not-allowed disabled:opacity-50';
export const FLOATING_ACTION_ICON_CLASS = 'h-5 w-5';
export const floatingActionContainerClass = (side: 'left' | 'right') => [
  'fixed bottom-20 z-40 sm:bottom-6',
  side === 'left' ? 'left-4 sm:left-6' : 'right-4 sm:right-6',
].join(' ');

export const floatingActionButtonClass = (tone: 'primary' | 'neutral') => [
  FLOATING_ACTION_BUTTON_CLASS,
  tone === 'primary'
    ? 'border-brand-blue bg-brand-blue text-white hover:border-blue-600 hover:bg-blue-600 focus:ring-blue-300 dark:focus:ring-blue-800'
    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus:ring-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white dark:focus:ring-slate-700',
].join(' ');
