import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { usePlatformInfo } from '../hooks/usePlatformInfo';
import { getStorageItem, setStorageItem, removeStorageItem } from '../utils/storage';
import { devLog } from '../utils/devLogger';

const ONBOARDING_COMPLETE_KEY = 'vinsly-onboarding-complete';

// Old license keys to migrate from
const OLD_LICENSE_INFO_KEY = 'vinsly-license-info';
const OLD_LICENSE_GRACE_KEY = 'vinsly-license-grace-expires';
const OLD_LICENSE_LAST_VALIDATED_KEY = 'vinsly-license-last-validated';

interface AppBootstrapContextType {
  isOnboardingComplete: boolean;
  bootstrapComplete: boolean;
  isWelcomeOpen: boolean;
  setIsWelcomeOpen: (open: boolean) => void;
  welcomePresented: boolean;
  setWelcomePresented: (presented: boolean) => void;
  appVersion: string;
  platformIdentifier: string;
  isMacLike: boolean;
  macOSMajorVersion: number | null;
  registerWorkspaceClear: (fn: () => Promise<void>) => void;
}

const AppBootstrapContext = createContext<AppBootstrapContextType | undefined>(undefined);

interface AppBootstrapProviderProps {
  children: React.ReactNode;
}

export const AppBootstrapProvider: React.FC<AppBootstrapProviderProps> = ({ children }) => {
  const platform = usePlatformInfo();
  const { isMacLike, macOSMajorVersion, platformIdentifier } = platform;

  const [appVersion, setAppVersion] = useState('');
  const [isOnboardingComplete, setIsOnboardingComplete] = useState(false);
  const [bootstrapComplete, setBootstrapComplete] = useState(false);
  const [isWelcomeOpen, setIsWelcomeOpen] = useState(false);
  const [welcomePresented, setWelcomePresented] = useState(false);

  const workspaceClearRef = useRef<(() => Promise<void>) | null>(null);

  const registerWorkspaceClear = useCallback((fn: () => Promise<void>) => {
    workspaceClearRef.current = fn;
  }, []);

  // Load app version on mount
  useEffect(() => {
    const loadAppVersion = async () => {
      try {
        const { getVersion } = await import('@tauri-apps/api/app');
        const version = await getVersion();
        setAppVersion(version);
      } catch (error) {
        devLog.warn('Unable to read application version', error);
      }
    };
    loadAppVersion();
  }, []);

  // Bootstrap: check onboarding status and migrate from old license keys
  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      // Check if already onboarded
      const onboardingDone = await getStorageItem<boolean>(ONBOARDING_COMPLETE_KEY);
      if (onboardingDone) {
        if (!cancelled) {
          setIsOnboardingComplete(true);
          setBootstrapComplete(true);
        }
        return;
      }

      // Migration: check for old license info key (existing paying customers)
      const oldLicense = await getStorageItem<unknown>(OLD_LICENSE_INFO_KEY);
      if (oldLicense) {
        devLog.log('Migrating existing license holder to free version');
        await setStorageItem(ONBOARDING_COMPLETE_KEY, true);
        // Clean up old license keys
        await removeStorageItem(OLD_LICENSE_INFO_KEY);
        await removeStorageItem(OLD_LICENSE_GRACE_KEY);
        await removeStorageItem(OLD_LICENSE_LAST_VALIDATED_KEY);

        if (!cancelled) {
          setIsOnboardingComplete(true);
          setBootstrapComplete(true);
        }
        return;
      }

      // No onboarding and no old license - fresh user
      if (!cancelled) {
        setIsOnboardingComplete(false);
        setBootstrapComplete(true);
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  const value: AppBootstrapContextType = {
    isOnboardingComplete,
    bootstrapComplete,
    isWelcomeOpen,
    setIsWelcomeOpen,
    welcomePresented,
    setWelcomePresented,
    appVersion,
    platformIdentifier,
    isMacLike,
    macOSMajorVersion,
    registerWorkspaceClear,
  };

  return (
    <AppBootstrapContext.Provider value={value}>
      {children}
    </AppBootstrapContext.Provider>
  );
};

export const useAppBootstrapContext = () => {
  const context = useContext(AppBootstrapContext);
  if (!context) {
    throw new Error('useAppBootstrapContext must be used within an AppBootstrapProvider');
  }
  return context;
};
