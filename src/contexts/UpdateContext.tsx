import React, { createContext, useContext, useCallback, useEffect, useRef, useState } from 'react';
import { useUpdater } from '../hooks/useUpdater';
import { useToast } from './ToastContext';
import { useLicenseContext } from './LicenseContext';
import { PendingUpdateDetails } from '../types/updater';

interface UpdateContextType {
  isCheckingUpdate: boolean;
  isInstallingUpdate: boolean;
  pendingUpdate: PendingUpdateDetails | null;
  lastUpdateCheckAt: string | null;
  initialCheckComplete: boolean;
  handleManualUpdateCheck: () => Promise<void>;
  handleInstallUpdate: () => Promise<void>;
  dismissPendingUpdate: () => void;
}

const UpdateContext = createContext<UpdateContextType | undefined>(undefined);

interface UpdateProviderProps {
  children: React.ReactNode;
}

export const UpdateProvider: React.FC<UpdateProviderProps> = ({ children }) => {
  const { showToast } = useToast();
  const { licenseInfo } = useLicenseContext();
  const hasCheckedRef = useRef(false);
  const [initialCheckComplete, setInitialCheckComplete] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const {
    isChecking: isCheckingUpdate,
    isInstalling: isInstallingUpdate,
    pendingUpdate: rawPendingUpdate,
    lastCheckedAt: lastUpdateCheckAt,
    checkForUpdate,
    installUpdate,
    clearPendingUpdate,
  } = useUpdater();

  // Dismissed updates should not show as pending
  const pendingUpdate = dismissed ? null : rawPendingUpdate;

  // Check for updates immediately on app start (before license activation)
  useEffect(() => {
    if (hasCheckedRef.current) {
      return;
    }
    hasCheckedRef.current = true;

    const runInitialCheck = async () => {
      try {
        await checkForUpdate();
      } catch (error) {
        console.warn('Initial update check failed', error);
      } finally {
        setInitialCheckComplete(true);
      }
    };
    runInitialCheck();
  }, [checkForUpdate]);

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
    try {
      showToast('info', 'Installing update...');
      await installUpdate();
    } catch (error) {
      console.error('Update installation failed', error);
      showToast('error', 'Unable to install the update. Please try again.');
    }
  }, [installUpdate, showToast]);

  const dismissPendingUpdate = useCallback(() => {
    setDismissed(true);
    void clearPendingUpdate();
  }, [clearPendingUpdate]);

  const value: UpdateContextType = {
    isCheckingUpdate,
    isInstallingUpdate,
    pendingUpdate,
    lastUpdateCheckAt,
    initialCheckComplete,
    handleManualUpdateCheck,
    handleInstallUpdate,
    dismissPendingUpdate,
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
