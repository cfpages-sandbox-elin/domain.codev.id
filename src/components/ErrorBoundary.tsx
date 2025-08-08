import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // You can also log the error to an error reporting service
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-900 px-4">
            <div className="max-w-2xl w-full bg-white dark:bg-slate-800 shadow-xl rounded-2xl p-8 border-t-4 border-brand-red">
                <h1 className="text-2xl font-bold text-slate-800 dark:text-white mb-4">Something Went Wrong</h1>
                <p className="text-slate-600 dark:text-slate-400 mb-6">
                    A critical error occurred in the application, and it cannot continue. Please try refreshing the page.
                    If the problem persists, please check the developer console for more details.
                </p>
                {this.state.error && (
                    <div className="text-slate-600 dark:text-slate-400 mb-6 whitespace-pre-wrap font-mono bg-slate-100 dark:bg-slate-700 p-4 rounded-lg text-sm">
                        {this.state.error?.toString()}
                    </div>
                )}
                <button
                    onClick={() => window.location.reload()}
                    className="px-5 py-3 font-semibold text-white bg-brand-blue hover:bg-blue-600 rounded-lg transition-colors flex items-center justify-center"
                >
                    Refresh Page
                </button>
            </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
