import React from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LicenseProvider } from './contexts/LicenseContext';
import { UpdateProvider } from './contexts/UpdateContext';
import { WorkspaceProvider } from './contexts/WorkspaceContext';
import { NavigationProvider } from './contexts/NavigationContext';
import { TerminalProvider } from './contexts/TerminalContext';
import { AppContent } from './components/AppContent';

/**
 * Provider-specific error fallback for graceful degradation.
 * Shows a minimal error UI that allows app reload without full crash screen.
 */
const ProviderErrorFallback: React.FC<{ provider: string }> = ({ provider }) => (
  <div className="flex flex-col items-center justify-center min-h-screen bg-v-light-surface dark:bg-v-dark p-8">
    <div className="max-w-sm w-full text-center">
      <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-yellow-500/10 flex items-center justify-center">
        <svg className="w-6 h-6 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <h2 className="text-lg font-medium text-v-light-text-primary dark:text-v-text-primary mb-2">
        {provider} initialization failed
      </h2>
      <p className="text-sm text-v-light-text-secondary dark:text-v-text-secondary mb-4">
        Please reload the application to try again.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="px-4 py-2 text-sm font-medium text-white bg-v-accent hover:bg-v-accent-hover rounded-lg transition-colors"
      >
        Reload App
      </button>
    </div>
  </div>
);

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <ErrorBoundary fallback={<ProviderErrorFallback provider="License service" />}>
        <LicenseProvider>
          <ErrorBoundary fallback={<ProviderErrorFallback provider="Update service" />}>
            <UpdateProvider>
              <ErrorBoundary fallback={<ProviderErrorFallback provider="Workspace" />}>
                <WorkspaceProvider>
                  <ErrorBoundary fallback={<ProviderErrorFallback provider="Navigation" />}>
                    <NavigationProvider>
                      <ErrorBoundary fallback={<ProviderErrorFallback provider="Terminal" />}>
                        <TerminalProvider>
                          <AppContent />
                        </TerminalProvider>
                      </ErrorBoundary>
                    </NavigationProvider>
                  </ErrorBoundary>
                </WorkspaceProvider>
              </ErrorBoundary>
            </UpdateProvider>
          </ErrorBoundary>
        </LicenseProvider>
      </ErrorBoundary>
    </ErrorBoundary>
  );
};

export default App;
