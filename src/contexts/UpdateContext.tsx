import React, { createContext, useContext, useCallback, useEffect, useRef, useState } from 'react';
import { useUpdater, UPDATE_COMPLETED_VERSION_KEY } from '../hooks/useUpdater';
import { useToast } from './ToastContext';
import { useLicenseContext } from './LicenseContext';
import { PendingUpdateDetails, UpdateCompletedInfo } from '../types/updater';
import { devLog } from '../utils/devLogger';
import { getStorageItem, removeStorageItem } from '../utils/storage';

interface UpdateContextType {
  isCheckingUpdate: boolean;
  isInstallingUpdate: boolean;
  pendingUpdate: PendingUpdateDetails | null;
  lastUpdateCheckAt: string | null;
  lastCheckError: string | null;
  initialCheckComplete: boolean;
  handleManualUpdateCheck: () => Promise<void>;
  handleInstallUpdate: () => Promise<void>;
  dismissPendingUpdate: () => void;
  // Update complete modal state
  showUpdateCompleteModal: boolean;
  updateCompletedVersion: string | null;
  updateCompletedNotes: string | null;
  dismissUpdateCompleteModal: () => void;
}

const UpdateContext = createContext<UpdateContextType | undefined>(undefined);

interface UpdateProviderProps {
  children: React.ReactNode;
}

export const UpdateProvider: React.FC<UpdateProviderProps> = ({ children }) => {
  const { showToast } = useToast();
  const { licenseInfo, appVersion } = useLicenseContext();
  const hasCheckedRef = useRef(false);
  const hasCheckedUpdateCompleteRef = useRef(false);
  const [initialCheckComplete, setInitialCheckComplete] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [showUpdateCompleteModal, setShowUpdateCompleteModal] = useState(false);
  const [updateCompletedVersion, setUpdateCompletedVersion] = useState<string | null>(null);
  const [updateCompletedNotes, setUpdateCompletedNotes] = useState<string | null>(null);

  const {
    isChecking: isCheckingUpdate,
    isInstalling: isInstallingUpdate,
    pendingUpdate: rawPendingUpdate,
    lastCheckedAt: lastUpdateCheckAt,
    lastCheckError,
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
        devLog.warn('Initial update check failed', error);
      } finally {
        setInitialCheckComplete(true);
      }
    };
    runInitialCheck();
  }, [checkForUpdate]);

  // Check if we just completed an update (after app restart)
  useEffect(() => {
    if (hasCheckedUpdateCompleteRef.current || !appVersion) {
      return;
    }
    hasCheckedUpdateCompleteRef.current = true;

    const checkUpdateComplete = async () => {
      try {
        // Try reading as new format (object with version and notes)
        const storedInfo = await getStorageItem<UpdateCompletedInfo | string>(UPDATE_COMPLETED_VERSION_KEY);

        if (!storedInfo) return;

        // Handle both old format (string) and new format (object)
        const version = typeof storedInfo === 'string' ? storedInfo : storedInfo.version;
        const notes = typeof storedInfo === 'object' ? storedInfo.notes : undefined;

        if (version === appVersion) {
          // We just updated to this version - show the modal
          setUpdateCompletedVersion(version);
          setUpdateCompletedNotes(notes ?? null);
          setShowUpdateCompleteModal(true);
          // Clear the stored info so we don't show again
          await removeStorageItem(UPDATE_COMPLETED_VERSION_KEY);
          devLog.log(`Update complete: now running version ${version}`);
        } else {
          // Stored version doesn't match current - clear it (update may have failed)
          await removeStorageItem(UPDATE_COMPLETED_VERSION_KEY);
        }
      } catch (error) {
        devLog.warn('Failed to check update completion status', error);
      }
    };
    checkUpdateComplete();
  }, [appVersion]);

  const handleManualUpdateCheck = useCallback(async () => {
    try {
      const update = await checkForUpdate();
      if (!update) {
        showToast('success', 'You are already on the latest version.');
      } else {
        showToast('info', `Vinsly ${update.version} is available.`);
      }
    } catch (error) {
      devLog.error('Manual update check failed', error);
      showToast('error', 'Unable to check for updates right now.');
    }
  }, [checkForUpdate, showToast]);

  const handleInstallUpdate = useCallback(async () => {
    try {
      showToast('info', 'Installing update...');
      await installUpdate();
    } catch (error) {
      devLog.error('Update installation failed', error);
      showToast('error', 'Unable to install the update. Please try again.');
    }
  }, [installUpdate, showToast]);

  const dismissPendingUpdate = useCallback(() => {
    setDismissed(true);
    void clearPendingUpdate();
  }, [clearPendingUpdate]);

  const dismissUpdateCompleteModal = useCallback(() => {
    setShowUpdateCompleteModal(false);
    setUpdateCompletedVersion(null);
    setUpdateCompletedNotes(null);
  }, []);

  const value: UpdateContextType = {
    isCheckingUpdate,
    isInstallingUpdate,
    pendingUpdate,
    lastUpdateCheckAt,
    lastCheckError,
    initialCheckComplete,
    handleManualUpdateCheck,
    handleInstallUpdate,
    dismissPendingUpdate,
    showUpdateCompleteModal,
    updateCompletedVersion,
    updateCompletedNotes,
    dismissUpdateCompleteModal,
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
