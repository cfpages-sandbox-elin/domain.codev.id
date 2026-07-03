export const HEADER_ICON_CLASS = 'h-5 w-5';

export const headerControlClass = (tone: 'neutral' | 'danger' = 'neutral') => [
  'inline-flex h-9 w-9 flex-none items-center justify-center rounded-full transition-colors sm:h-10 sm:w-10',
  tone === 'danger'
    ? 'text-red-600 hover:bg-red-100 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950/60 dark:hover:text-red-300'
    : 'text-slate-600 hover:bg-slate-200 hover:text-brand-blue dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white',
].join(' ');
