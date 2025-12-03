/**
 * AppStateContext
 * Consolidates all app-level state hooks into a single context provider
 * Reduces complexity in App.tsx and provides unified state access
 */

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { useTheme, Theme } from '../hooks/useTheme';
import { usePlatformInfo } from '../hooks/usePlatformInfo';
import { useUserProfile } from '../hooks/useUserProfile';
import { useToast } from './ToastContext';
import { useScanSettings } from '../hooks/useScanSettings';
import { useLicense } from '../hooks/useLicense';
import { useWorkspace } from '../hooks/useWorkspace';
import { useNavigation } from '../hooks/useNavigation';
import { useUpdater } from '../hooks/useUpdater';
import { useHistory } from '../hooks/useHistory';

/**
 * Combined app state interface
 */
interface AppState {
  // Theme
  theme: Theme;
  toggleTheme: () => void;

  // Platform
  platformIdentifier: string;
  isMacLike: boolean;
  macOSMajorVersion: number | null;

  // User Profile
  userDisplayName: string | null;
  setDisplayName: (name: string) => Promise<void>;

  // Toast
  showToast: (
    type: 'success' | 'error' | 'info',
    message: string,
    duration?: number,
    action?: { label: string; onClick: () => void }
  ) => void;
  toasts: Array<{
    id: string;
    type: 'success' | 'error' | 'info';
    message: string;
    duration?: number;
    action?: { label: string; onClick: () => void };
  }>;
  removeToast: (id: string) => void;

  // Scan Settings
  scanSettings: ReturnType<typeof useScanSettings>['scanSettings'];
  scanSettingsRef: ReturnType<typeof useScanSettings>['scanSettingsRef'];
  applyScanSettings: ReturnType<typeof useScanSettings>['applyScanSettings'];
  loadInitialSettings: ReturnType<typeof useScanSettings>['loadInitialSettings'];

  // License
  licenseInfo: ReturnType<typeof useLicense>['licenseInfo'];
  licenseBootstrapComplete: boolean;
  isOnboardingComplete: boolean;
  setLicense: ReturnType<typeof useLicense>['setLicense'];
  resetLicense: ReturnType<typeof useLicense>['resetLicense'];

  // Workspace
  workspace: ReturnType<typeof useWorkspace>;

  // Navigation
  navigation: ReturnType<typeof useNavigation>;

  // Updater
  isCheckingUpdate: boolean;
  isInstallingUpdate: boolean;
  pendingUpdate: ReturnType<typeof useUpdater>['pendingUpdate'];
  lastUpdateCheckAt: ReturnType<typeof useUpdater>['lastCheckedAt'];
  checkForUpdate: ReturnType<typeof useUpdater>['checkForUpdate'];
  installUpdate: ReturnType<typeof useUpdater>['installUpdate'];

  // History (Undo/Redo)
  history: ReturnType<typeof useHistory>;

  // App Version
  appVersion: string;
}

const AppStateContext = createContext<AppState | null>(null);

interface AppStateProviderProps {
  children: ReactNode;
  appVersion: string;
}

/**
 * Provider component that initializes and provides all app state
 */
export function AppStateProvider({ children, appVersion }: AppStateProviderProps) {
  const { theme, toggleTheme } = useTheme();
  const { platformIdentifier, isMacLike, macOSMajorVersion } = usePlatformInfo();
  const { userDisplayName, setDisplayName } = useUserProfile();
  const { showToast, toasts, removeToast } = useToast();
  const scanSettingsHook = useScanSettings();
  const { scanSettings, scanSettingsRef, applyScanSettings, loadInitialSettings } = scanSettingsHook;

  const workspaceClearRef = useRef<(() => Promise<void>) | null>(null);

  // License hook with correct initial state (false for first-time users)
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

  const {
    licenseInfo,
    licenseBootstrapComplete,
    isOnboardingComplete,
    setLicense,
    resetLicense,
  } = license;

  const workspace = useWorkspace({
    showToast,
    scanSettingsRef,
    isOnboardingComplete,
  });

  useEffect(() => {
    workspaceClearRef.current = workspace.clearWorkspaceCache;
  }, [workspace.clearWorkspaceCache]);

  const navigation = useNavigation({ agents: workspace.agents });

  const updater = useUpdater();
  const {
    isChecking: isCheckingUpdate,
    isInstalling: isInstallingUpdate,
    pendingUpdate,
    lastCheckedAt: lastUpdateCheckAt,
    checkForUpdate,
    installUpdate,
  } = updater;

  const history = useHistory({ maxStackSize: 20 });

  const state: AppState = {
    theme,
    toggleTheme,
    platformIdentifier,
    isMacLike,
    macOSMajorVersion,
    userDisplayName,
    setDisplayName,
    showToast,
    toasts,
    removeToast,
    scanSettings,
    scanSettingsRef,
    applyScanSettings,
    loadInitialSettings,
    licenseInfo,
    licenseBootstrapComplete,
    isOnboardingComplete,
    setLicense,
    resetLicense,
    workspace,
    navigation,
    isCheckingUpdate,
    isInstallingUpdate,
    pendingUpdate,
    lastUpdateCheckAt,
    checkForUpdate,
    installUpdate,
    history,
    appVersion,
  };

  return <AppStateContext.Provider value={state}>{children}</AppStateContext.Provider>;
}

/**
 * Hook to access app state from any component
 */
export function useAppState(): AppState {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error('useAppState must be used within AppStateProvider');
  }
  return context;
}
