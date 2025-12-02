import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { getStorageItem, setStorageItem, removeStorageItem } from '../utils/storage';
import { useUpdater } from '../hooks/useUpdater';
import { useToast } from './ToastContext';
import { useLicenseContext } from './LicenseContext';
import { PendingUpdateDetails } from '../types/updater';

const AUTO_UPDATE_KEY = 'vinsly-auto-update-enabled';
const UPDATE_SNOOZE_KEY = 'vinsly-update-snooze';
const UPDATE_SNOOZE_DURATION_MS = 1000 * 60 * 60 * 6; // 6 hours
const UPDATE_CHECK_INTERVAL_MS = 1000 * 60 * 60 * 24; // 24 hours

interface UpdateSnooze {
  version: string;
  until: string;
}

interface UpdateContextType {
  isCheckingUpdate: boolean;
  isInstallingUpdate: boolean;
  pendingUpdate: PendingUpdateDetails | null;
  lastUpdateCheckAt: string | null;
  autoUpdateEnabled: boolean;
  updateSnooze: UpdateSnooze | null;
  snoozeActive: boolean;
  shouldShowUpdatePrompt: boolean;
  handleManualUpdateCheck: () => Promise<void>;
  handleAutoUpdateChange: (enabled: boolean) => Promise<void>;
  handleInstallUpdate: () => Promise<void>;
  handleSnoozeUpdatePrompt: () => Promise<void>;
}

const UpdateContext = createContext<UpdateContextType | undefined>(undefined);

interface UpdateProviderProps {
  children: React.ReactNode;
}

export const UpdateProvider: React.FC<UpdateProviderProps> = ({ children }) => {
  const { showToast } = useToast();
  const { licenseInfo } = useLicenseContext();

  const [autoUpdateEnabled, setAutoUpdateEnabled] = useState(false);
  const [updateSnooze, setUpdateSnooze] = useState<UpdateSnooze | null>(null);
  const autoUpdateTimerRef = useRef<number | null>(null);

  const {
    isChecking: isCheckingUpdate,
    isInstalling: isInstallingUpdate,
    pendingUpdate,
    lastCheckedAt: lastUpdateCheckAt,
    checkForUpdate,
    installUpdate,
  } = useUpdater();

  // Load update preferences on mount
  useEffect(() => {
    const loadUpdatePreferences = async () => {
      const storedAutoUpdate = await getStorageItem<boolean>(AUTO_UPDATE_KEY);
      if (typeof storedAutoUpdate === 'boolean') {
        setAutoUpdateEnabled(storedAutoUpdate);
      }
      const storedSnooze = await getStorageItem<UpdateSnooze>(UPDATE_SNOOZE_KEY);
      if (storedSnooze) {
        setUpdateSnooze(storedSnooze);
      }
    };
    loadUpdatePreferences();
  }, []);

  // Handle snooze expiration
  useEffect(() => {
    if (!updateSnooze) {
      return;
    }
    const expiresAt = Date.parse(updateSnooze.until);
    if (Number.isNaN(expiresAt)) {
      return;
    }
    if (expiresAt <= Date.now()) {
      setUpdateSnooze(null);
      void removeStorageItem(UPDATE_SNOOZE_KEY);
      return;
    }
    const timeoutId = window.setTimeout(() => {
      setUpdateSnooze(null);
      void removeStorageItem(UPDATE_SNOOZE_KEY);
    }, expiresAt - Date.now());
    return () => window.clearTimeout(timeoutId);
  }, [updateSnooze]);

  // Initial update check when license is active and auto-update is disabled
  useEffect(() => {
    if (!licenseInfo || autoUpdateEnabled) {
      return;
    }
    const runInitialUpdateCheck = async () => {
      try {
        const update = await checkForUpdate();
        if (update) {
          showToast('info', `Vinsly ${update.version} is ready to install.`);
        }
      } catch (error) {
        console.warn('Initial update check failed', error);
      }
    };
    runInitialUpdateCheck();
  }, [licenseInfo, autoUpdateEnabled, checkForUpdate, showToast]);

  // Auto-update interval when enabled
  useEffect(() => {
    if (!licenseInfo || !autoUpdateEnabled) {
      if (autoUpdateTimerRef.current) {
        window.clearInterval(autoUpdateTimerRef.current);
        autoUpdateTimerRef.current = null;
      }
      return;
    }

    const checkAndInstall = async () => {
      try {
        const update = await checkForUpdate();
        if (update) {
          showToast('info', `Installing Vinsly ${update.version}…`);
          await installUpdate();
        }
      } catch (error) {
        console.warn('Auto-update cycle failed', error);
        showToast('error', 'Auto-update failed. We will try again later.');
      }
    };

    void checkAndInstall();
    autoUpdateTimerRef.current = window.setInterval(() => {
      void checkAndInstall();
    }, UPDATE_CHECK_INTERVAL_MS);

    return () => {
      if (autoUpdateTimerRef.current) {
        window.clearInterval(autoUpdateTimerRef.current);
        autoUpdateTimerRef.current = null;
      }
    };
  }, [licenseInfo, autoUpdateEnabled, checkForUpdate, installUpdate, showToast]);

  // Clear snooze when a new version is detected
  useEffect(() => {
    if (!pendingUpdate || !updateSnooze) {
      return;
    }
    if (pendingUpdate.version !== updateSnooze.version) {
      setUpdateSnooze(null);
      void removeStorageItem(UPDATE_SNOOZE_KEY);
    }
  }, [pendingUpdate, updateSnooze]);

  const handleManualUpdateCheck = useCallback(async () => {
    try {
      const update = await checkForUpdate();
      if (!update) {
        showToast('success', 'You are already on the latest version.');
        return;
      }
      if (autoUpdateEnabled) {
        showToast('info', `Installing Vinsly ${update.version}…`);
        await installUpdate();
        return;
      }
      showToast('info', `Vinsly ${update.version} is ready to install.`);
    } catch (error) {
      console.error('Manual update check failed', error);
      showToast('error', 'Unable to check for updates right now.');
    }
  }, [autoUpdateEnabled, checkForUpdate, installUpdate, showToast]);

  const handleAutoUpdateChange = useCallback(async (enabled: boolean) => {
    setAutoUpdateEnabled(enabled);
    await setStorageItem(AUTO_UPDATE_KEY, enabled);
    if (!enabled || !licenseInfo) {
      return;
    }
    try {
      const update = await checkForUpdate();
      if (update) {
        showToast('info', `Installing Vinsly ${update.version}…`);
        await installUpdate();
      }
    } catch (error) {
      console.error('Auto-update toggle check failed', error);
      showToast('error', 'Automatic update check failed. Please try again later.');
    }
  }, [licenseInfo, checkForUpdate, installUpdate, showToast]);

  const handleInstallUpdate = useCallback(async () => {
    // Verify license is still active before installing
    if (!licenseInfo || licenseInfo.status !== 'active') {
      showToast('error', 'Cannot install update: Invalid license');
      return;
    }

    try {
      await installUpdate();
    } catch (error) {
      console.error('Update installation failed', error);
      showToast('error', 'Unable to install the update. Please try again.');
    }
  }, [licenseInfo, installUpdate, showToast]);

  const handleSnoozeUpdatePrompt = useCallback(async () => {
    if (!pendingUpdate) {
      return;
    }
    const until = new Date(Date.now() + UPDATE_SNOOZE_DURATION_MS).toISOString();
    const payload = { version: pendingUpdate.version, until };
    setUpdateSnooze(payload);
    await setStorageItem(UPDATE_SNOOZE_KEY, payload);
  }, [pendingUpdate]);

  const snoozeActive = Boolean(
    pendingUpdate &&
      updateSnooze &&
      updateSnooze.version === pendingUpdate.version &&
      Date.parse(updateSnooze.until) > Date.now()
  );

  const shouldShowUpdatePrompt = Boolean(
    pendingUpdate &&
    !autoUpdateEnabled &&
    !snoozeActive &&
    licenseInfo?.status === 'active'
  );

  const value: UpdateContextType = {
    isCheckingUpdate,
    isInstallingUpdate,
    pendingUpdate,
    lastUpdateCheckAt,
    autoUpdateEnabled,
    updateSnooze,
    snoozeActive,
    shouldShowUpdatePrompt,
    handleManualUpdateCheck,
    handleAutoUpdateChange,
    handleInstallUpdate,
    handleSnoozeUpdatePrompt,
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
