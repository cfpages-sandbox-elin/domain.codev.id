import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { CompactModeProvider } from './contexts/CompactModeContext';
import './index.css';

try {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error("Could not find root element to mount to");
  }

  // Clear any potential static content
  rootElement.innerHTML = ''; 

  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        <CompactModeProvider>
            <App />
        </CompactModeProvider>
      </ErrorBoundary>
    </React.StrictMode>
  );
} catch (error) {
  console.error("Fatal error during application startup:", error);
  const rootElement = document.getElementById('root');
  if (rootElement) {
    // Basic styling to make the error visible on both light/dark backgrounds
    document.body.style.backgroundColor = '#1e293b'; // slate-800
    document.body.style.fontFamily = 'sans-serif';
    document.body.style.color = '#e2e8f0'; // slate-200
    
    // Display a user-friendly error message
    rootElement.innerHTML = `
      <div style="padding: 2rem; text-align: center; height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center;">
        <h1 style="font-size: 1.5rem; font-weight: bold; color: #ef4444;">Application Failed to Start</h1>
        <p style="margin-top: 1rem; color: #94a3b8;">A critical error prevented the app from loading. Please check the console for details.</p>
        <pre style="margin-top: 1.5rem; padding: 1rem; background-color: #0f172a; border: 1px solid #334155; border-radius: 0.5rem; text-align: left; white-space: pre-wrap; word-wrap: break-word; font-family: monospace; font-size: 0.875rem; color: #cbd5e1; max-width: 100%; overflow: auto;">${error instanceof Error ? error.stack : String(error)}</pre>
      </div>
    `;
  }
}
