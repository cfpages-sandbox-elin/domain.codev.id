import React from 'react';

interface ConfigErrorScreenProps {
  message: string;
}

const ConfigErrorScreen: React.FC<ConfigErrorScreenProps> = ({ message }) => {
  return (
    <div className="flex justify-center py-12 px-4">
      <div className="max-w-2xl w-full bg-white dark:bg-slate-800 shadow-xl rounded-2xl p-8 border-t-4 border-brand-red">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white mb-4">Configuration Error</h1>
        <div className="text-slate-600 dark:text-slate-400 mb-6 whitespace-pre-wrap font-mono bg-slate-100 dark:bg-slate-700 p-4 rounded-lg text-sm">
          {message}
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-500">
          After adding the environment variables, you may need to restart your development server or redeploy the application.
        </p>
      </div>
    </div>
  );
};

export default ConfigErrorScreen;