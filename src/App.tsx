import React from 'react';
import { LicenseProvider } from './contexts/LicenseContext';
import { UpdateProvider } from './contexts/UpdateContext';
import { WorkspaceProvider } from './contexts/WorkspaceContext';
import { NavigationProvider } from './contexts/NavigationContext';
import { AppContent } from './components/AppContent';

const App: React.FC = () => {
  return (
    <LicenseProvider>
      <UpdateProvider>
        <WorkspaceProvider>
          <NavigationProvider>
            <AppContent />
          </NavigationProvider>
        </WorkspaceProvider>
      </UpdateProvider>
    </LicenseProvider>
  );
};

export default App;
