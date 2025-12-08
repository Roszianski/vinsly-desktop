import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Error boundary component that catches JavaScript errors in child components
 * and displays a fallback UI instead of crashing the entire application.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-v-light-surface dark:bg-v-dark p-8">
          <div className="max-w-md w-full bg-v-light-hover dark:bg-v-mid-dark rounded-xl border border-v-light-border dark:border-v-border p-8 shadow-lg">
            {/* Icon */}
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-red-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
            </div>

            {/* Title */}
            <h1 className="text-xl font-semibold text-v-light-text-primary dark:text-v-text-primary text-center mb-2">
              Something went wrong
            </h1>

            {/* Description */}
            <p className="text-sm text-v-light-text-secondary dark:text-v-text-secondary text-center mb-6">
              An unexpected error occurred. You can try again or reload the application.
            </p>

            {/* Error details (collapsed by default in production) */}
            {this.state.error && (
              <details className="mb-6">
                <summary className="text-xs text-v-light-text-muted dark:text-v-text-muted cursor-pointer hover:text-v-light-text-secondary dark:hover:text-v-text-secondary transition-colors">
                  Error details
                </summary>
                <div className="mt-2 p-3 bg-v-light-surface dark:bg-v-dark rounded-lg border border-v-light-border dark:border-v-border">
                  <p className="text-xs font-mono text-red-500 break-all">
                    {this.state.error.message}
                  </p>
                  {this.state.errorInfo?.componentStack && (
                    <pre className="mt-2 text-xs font-mono text-v-light-text-muted dark:text-v-text-muted overflow-auto max-h-32">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  )}
                </div>
              </details>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={this.handleReset}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-v-light-text-primary dark:text-v-text-primary bg-v-light-surface dark:bg-v-dark border border-v-light-border dark:border-v-border rounded-lg hover:bg-v-light-hover dark:hover:bg-v-border transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={this.handleReload}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-v-accent hover:bg-v-accent-hover rounded-lg transition-colors"
              >
                Reload App
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
