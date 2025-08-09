import React from 'react';
import { signInWithGoogle } from '../services/supabaseService';

const Auth: React.FC = () => {
  const handleLogin = async () => {
    await signInWithGoogle();
  };

  return (
    <div className="flex justify-center py-12 px-4">
      <div className="max-w-md w-full bg-white dark:bg-slate-800 shadow-xl rounded-2xl p-8 text-center">
        <h1 className="text-3xl font-bold text-brand-blue mb-2">Domain Codev</h1>
        <p className="text-slate-600 dark:text-slate-400 mb-8">
          Sign in with your Google account to securely track your domain portfolio.
        </p>
        <button
          onClick={handleLogin}
          className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors"
        >
          <svg className="w-6 h-6" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
            <path fill="#4285F4" d="M488 261.8C488 403.3 381.5 512 244 512 111.3 512 0 400.7 0 268.3 0 135.8 111.3 24.5 244 24.5c69.2 0 128.7 27.2 174.9 69.4l-66.2 64.2c-26.6-25-61.9-40.4-108.7-40.4-83.3 0-151.7 67.5-151.7 150.8s68.4 150.8 151.7 150.8c90.1 0 134.1-62.4 139.1-94.8H244v-77.3h236.1c2.4 12.7 4.9 25.8 4.9 39.7z"></path>
          </svg>
          <span className="text-base font-semibold text-slate-700 dark:text-slate-200">Sign in with Google</span>
        </button>
      </div>
    </div>
  );
};

export default Auth;