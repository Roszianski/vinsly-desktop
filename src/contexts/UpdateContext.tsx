import React, { createContext, useContext, useCallback, useEffect, useRef } from 'react';
import { useUpdater } from '../hooks/useUpdater';
import { useToast } from './ToastContext';
import { useLicenseContext } from './LicenseContext';
import { PendingUpdateDetails } from '../types/updater';

interface UpdateContextType {
  isCheckingUpdate: boolean;
  isInstallingUpdate: boolean;
  pendingUpdate: PendingUpdateDetails | null;
  lastUpdateCheckAt: string | null;
  handleManualUpdateCheck: () => Promise<void>;
  handleInstallUpdate: () => Promise<void>;
}

const UpdateContext = createContext<UpdateContextType | undefined>(undefined);

interface UpdateProviderProps {
  children: React.ReactNode;
}

export const UpdateProvider: React.FC<UpdateProviderProps> = ({ children }) => {
  const { showToast } = useToast();
  const { licenseInfo } = useLicenseContext();
  const hasCheckedRef = useRef(false);

  const {
    isChecking: isCheckingUpdate,
    isInstalling: isInstallingUpdate,
    pendingUpdate,
    lastCheckedAt: lastUpdateCheckAt,
    checkForUpdate,
    installUpdate,
  } = useUpdater();

  // Check for updates once on app start (when license is active)
  useEffect(() => {
    if (!licenseInfo || hasCheckedRef.current) {
      return;
    }
    hasCheckedRef.current = true;

    const runInitialCheck = async () => {
      try {
        await checkForUpdate();
        // No toast on startup - just silently check and set pendingUpdate if available
      } catch (error) {
        console.warn('Initial update check failed', error);
      }
    };
    runInitialCheck();
  }, [licenseInfo, checkForUpdate]);

  const handleManualUpdateCheck = useCallback(async () => {
    try {
      const update = await checkForUpdate();
      if (!update) {
        showToast('success', 'You are already on the latest version.');
      } else {
        showToast('info', `Vinsly ${update.version} is available.`);
      }
    } catch (error) {
      console.error('Manual update check failed', error);
      showToast('error', 'Unable to check for updates right now.');
    }
  }, [checkForUpdate, showToast]);

  const handleInstallUpdate = useCallback(async () => {
    if (!licenseInfo || licenseInfo.status !== 'active') {
      showToast('error', 'Cannot install update: Invalid license');
      return;
    }

    try {
      showToast('info', 'Installing update...');
      await installUpdate();
    } catch (error) {
      console.error('Update installation failed', error);
      showToast('error', 'Unable to install the update. Please try again.');
    }
  }, [licenseInfo, installUpdate, showToast]);

  const value: UpdateContextType = {
    isCheckingUpdate,
    isInstallingUpdate,
    pendingUpdate,
    lastUpdateCheckAt,
    handleManualUpdateCheck,
    handleInstallUpdate,
  };

  return (
    <UpdateContext.Provider value={value}>
      {children}
    </UpdateContext.Provider>
  );
};

export const useUpdateContext = () => {
  const context = useContext(UpdateContext);
  if (!context) {
    throw new Error('useUpdateContext must be used within an UpdateProvider');
  }
  return context;
};
