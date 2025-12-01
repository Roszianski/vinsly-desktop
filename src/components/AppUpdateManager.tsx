/**
 * AppUpdateManager
 * Handles all update checking and installation logic
 * Extracts update management from App.tsx for better separation of concerns
 */

import { useEffect, useRef, useCallback } from 'react';

const UPDATE_CHECK_INTERVAL_MS = 1000 * 60 * 60 * 24; // 24 hours

interface AppUpdateManagerProps {
  licenseInfo: any;
  autoUpdateEnabled: boolean;
  checkForUpdate: () => Promise<any>;
  installUpdate: () => Promise<void>;
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

/**
 * Component that manages automatic update checking
 * This component renders nothing but handles update lifecycle
 */
export function AppUpdateManager({
  licenseInfo,
  autoUpdateEnabled,
  checkForUpdate,
  installUpdate,
  showToast,
}: AppUpdateManagerProps) {
  const autoUpdateTimerRef = useRef<number | null>(null);

  // Initial update check (non-auto mode)
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

  // Auto-update check and install (auto mode)
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

  // This component doesn't render anything
  return null;
}
