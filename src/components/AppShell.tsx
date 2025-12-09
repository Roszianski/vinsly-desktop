/**
 * AppShell
 * Provides the main application layout (Header + Content)
 * Extracts layout structure from App.tsx
 */

import { ReactNode } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Header } from './Header';
import { Theme } from '../hooks/useTheme';
import { LicenseInfo } from '../types/licensing';
import { LoadAgentsOptions, ScanSettings } from '../types';
import { PendingUpdateDetails } from '../types/updater';

interface AppShellProps {
  // Theme
  theme: Theme;
  onToggleTheme: () => void;

  // Header handlers
  onNavigateHome: () => void;
  onScan: (options?: LoadAgentsOptions) => Promise<{ total: number; newCount: number }>;
  isScanning: boolean;

  // License & Profile
  licenseInfo: LicenseInfo | null;
  onResetLicense: () => void;
  userDisplayName: string;
  onDisplayNameChange: (name: string) => void;

  // Scan Settings
  scanSettings: ScanSettings;
  onScanSettingsChange: (settings: ScanSettings) => void;

  // Update Management
  onCheckForUpdates: () => void;
  isCheckingUpdate: boolean;
  isInstallingUpdate: boolean;
  pendingUpdate: PendingUpdateDetails | null;
  appVersion: string;
  lastUpdateCheckAt: string | null;
  onInstallUpdate: () => void;

  // Platform
  isMacPlatform: boolean;
  macOSVersionMajor: number | null;

  // Content
  children: ReactNode;
}

/**
 * Main application shell with header and content area
 */
export function AppShell({
  theme,
  onToggleTheme,
  onNavigateHome,
  onScan,
  isScanning,
  licenseInfo,
  onResetLicense,
  userDisplayName,
  onDisplayNameChange,
  scanSettings,
  onScanSettingsChange,
  onCheckForUpdates,
  isCheckingUpdate,
  isInstallingUpdate,
  pendingUpdate,
  appVersion,
  lastUpdateCheckAt,
  onInstallUpdate,
  isMacPlatform,
  macOSVersionMajor,
  children,
}: AppShellProps) {
  return (
    <div className="min-h-screen bg-v-light-bg dark:bg-v-dark text-v-light-text-primary dark:text-v-text-primary transition-colors duration-200">
      <Header
        theme={theme}
        onToggleTheme={onToggleTheme}
        onNavigateHome={onNavigateHome}
        onScan={onScan}
        isScanning={isScanning}
        licenseInfo={licenseInfo}
        onResetLicense={onResetLicense}
        userDisplayName={userDisplayName}
        onDisplayNameChange={onDisplayNameChange}
        scanSettings={scanSettings}
        onScanSettingsChange={onScanSettingsChange}
        onCheckForUpdates={onCheckForUpdates}
        isCheckingUpdate={isCheckingUpdate}
        isInstallingUpdate={isInstallingUpdate}
        pendingUpdate={pendingUpdate}
        appVersion={appVersion}
        lastUpdateCheckAt={lastUpdateCheckAt}
        onInstallUpdate={onInstallUpdate}
        isMacPlatform={isMacPlatform}
        macOSVersionMajor={macOSVersionMajor}
      />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AnimatePresence mode="wait">{children}</AnimatePresence>
      </main>
    </div>
  );
}
