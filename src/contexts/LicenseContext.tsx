import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { LicenseInfo } from '../types/licensing';
import { useLicense, UseLicenseResult } from '../hooks/useLicense';
import { usePlatformInfo } from '../hooks/usePlatformInfo';
import { useToast } from './ToastContext';
import { devLog } from '../utils/devLogger';

interface LicenseContextType extends UseLicenseResult {
  isActivationOpen: boolean;
  setIsActivationOpen: (open: boolean) => void;
  activationPresented: boolean;
  setActivationPresented: (presented: boolean) => void;
  appVersion: string;
  platformIdentifier: string;
  isMacLike: boolean;
  macOSMajorVersion: number | null;
  registerWorkspaceClear: (fn: () => Promise<void>) => void;
}

const LicenseContext = createContext<LicenseContextType | undefined>(undefined);

interface LicenseProviderProps {
  children: React.ReactNode;
}

export const LicenseProvider: React.FC<LicenseProviderProps> = ({ children }) => {
  const { showToast } = useToast();
  const platform = usePlatformInfo();
  const { isMacLike, macOSMajorVersion, platformIdentifier } = platform;

  const [appVersion, setAppVersion] = useState('');
  const [isActivationOpen, setIsActivationOpen] = useState(false);
  const [activationPresented, setActivationPresented] = useState(false);

  const workspaceClearRef = useRef<(() => Promise<void>) | null>(null);

  const registerWorkspaceClear = useCallback((fn: () => Promise<void>) => {
    workspaceClearRef.current = fn;
  }, []);

  const license = useLicense({
    showToast,
    platformIdentifier,
    appVersion,
    onResetComplete: async () => {
      if (workspaceClearRef.current) {
        await workspaceClearRef.current();
      }
    },
  });

  // Load app version on mount
  useEffect(() => {
    const loadAppVersion = async () => {
      try {
        const { getVersion } = await import('@tauri-apps/api/app');
        const version = await getVersion();
        setAppVersion(version);
      } catch (error) {
        // Expected to fail in browser/non-Tauri environment
        devLog.warn('Unable to read application version', error);
      }
    };
    loadAppVersion();
  }, []);

  const value: LicenseContextType = {
    ...license,
    isActivationOpen,
    setIsActivationOpen,
    activationPresented,
    setActivationPresented,
    appVersion,
    platformIdentifier,
    isMacLike,
    macOSMajorVersion,
    registerWorkspaceClear,
  };

  return (
    <LicenseContext.Provider value={value}>
      {children}
    </LicenseContext.Provider>
  );
};

export const useLicenseContext = () => {
  const context = useContext(LicenseContext);
  if (!context) {
    throw new Error('useLicenseContext must be used within a LicenseProvider');
  }
  return context;
};
