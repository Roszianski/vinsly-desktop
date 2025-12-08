import React from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LicenseProvider } from './contexts/LicenseContext';
import { UpdateProvider } from './contexts/UpdateContext';
import { WorkspaceProvider } from './contexts/WorkspaceContext';
import { NavigationProvider } from './contexts/NavigationContext';
import { AppContent } from './components/AppContent';

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <LicenseProvider>
        <UpdateProvider>
          <WorkspaceProvider>
            <NavigationProvider>
              <AppContent />
            </NavigationProvider>
          </WorkspaceProvider>
        </UpdateProvider>
      </LicenseProvider>
    </ErrorBoundary>
  );
};

export default App;
