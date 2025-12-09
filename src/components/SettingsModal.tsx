import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { open } from '@tauri-apps/plugin-dialog';
import { ScanSettings } from '../types';
import { getScanSettings, saveScanSettings, addWatchedDirectory, removeWatchedDirectory } from '../utils/scanSettings';
import { DeleteIcon } from './icons/DeleteIcon';
import { LicenseInfo } from '../types/licensing';
import { PendingUpdateDetails } from '../types/updater';
import { checkFullDiskAccess, openFullDiskAccessSettings } from '../utils/tauriCommands';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTheme: 'system' | 'light' | 'dark';
  onThemeChange: (theme: 'system' | 'light' | 'dark') => Promise<void> | void;
  defaultView: 'table' | 'grid';
  onViewChange: (view: 'table' | 'grid') => Promise<void> | void;
  onResetPreferences: () => Promise<void> | void;
  licenseInfo: LicenseInfo | null;
  userDisplayName: string;
  onDisplayNameChange: (name: string) => Promise<void> | void;
  onResetLicense: () => Promise<void> | void;
  onScanSettingsChange?: (settings: ScanSettings) => void;
  scanSettings: ScanSettings;
  onCheckForUpdates: () => Promise<void> | void;
  isCheckingUpdate: boolean;
  isInstallingUpdate: boolean;
  pendingUpdate: PendingUpdateDetails | null;
  appVersion: string;
  lastUpdateCheckAt: string | null;
  onInstallUpdate: () => Promise<void> | void;
  isMacPlatform?: boolean;
  macOSVersionMajor?: number | null;
}

type SettingsSection = 'appearance' | 'scanning' | 'account' | 'permissions';

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  defaultTheme,
  onThemeChange,
  defaultView,
  onViewChange,
  onResetPreferences,
  licenseInfo,
  userDisplayName,
  onDisplayNameChange,
  onResetLicense,
  onScanSettingsChange,
  scanSettings,
  onCheckForUpdates,
  isCheckingUpdate,
  isInstallingUpdate,
  pendingUpdate,
  appVersion,
  lastUpdateCheckAt,
  onInstallUpdate,
  isMacPlatform = false,
  macOSVersionMajor = null,
}) => {
  const [activeSection, setActiveSection] = useState<SettingsSection>('account');
  const [localScanSettings, setLocalScanSettings] = useState<ScanSettings>(scanSettings);
  const [displayNameInput, setDisplayNameInput] = useState(userDisplayName);
  const [displayNameSaveState, setDisplayNameSaveState] = useState<'idle' | 'saving' | 'success'>('idle');
  const [fullDiskStatus, setFullDiskStatus] = useState<'unknown' | 'checking' | 'granted' | 'denied'>('unknown');
  const [isOpeningFullDiskSettings, setIsOpeningFullDiskSettings] = useState(false);
  const [fullDiskStatusMessage, setFullDiskStatusMessage] = useState<{ tone: 'info' | 'warn'; text: string } | null>(null);
  const [showSequoiaTip, setShowSequoiaTip] = useState(false);
  const displayNameSaveTimeoutRef = useRef<number | null>(null);
  const postGrantCheckTimeoutRef = useRef<number | null>(null);
  const lastCheckedLabel = lastUpdateCheckAt
    ? new Date(lastUpdateCheckAt).toLocaleString()
    : 'Not checked yet';
  const fullDiskStatusLabel =
    fullDiskStatus === 'granted'
      ? 'Granted'
      : fullDiskStatus === 'checking'
        ? 'Checking…'
        : fullDiskStatus === 'denied'
          ? 'Not granted'
          : 'Not checked';
  const fullDiskStatusTone =
    fullDiskStatus === 'granted'
      ? 'bg-green-500/10 text-green-500 dark:text-green-400'
      : fullDiskStatus === 'checking'
        ? 'bg-v-light-border/60 dark:bg-v-border/40 text-v-light-text-secondary dark:text-v-text-secondary'
        : 'bg-amber-500/10 text-amber-600 dark:text-amber-300';
  const fullDiskMessageClass =
    fullDiskStatusMessage?.tone === 'warn'
      ? 'text-amber-600 dark:text-amber-300'
      : 'text-v-light-text-secondary dark:text-v-text-secondary';
  const trimmedDisplayName = displayNameInput.trim();
  const isDisplayNameDirty = trimmedDisplayName.length > 0 && trimmedDisplayName !== userDisplayName.trim();
  const isDisplayNameSaving = displayNameSaveState === 'saving';
  const isDisplayNameSaved = displayNameSaveState === 'success';
  const isSequoiaOrNewer = isMacPlatform && typeof macOSVersionMajor === 'number' && macOSVersionMajor >= 15;

  useEffect(() => {
    setDisplayNameInput(userDisplayName);
    setDisplayNameSaveState('idle');
    if (displayNameSaveTimeoutRef.current) {
      window.clearTimeout(displayNameSaveTimeoutRef.current);
      displayNameSaveTimeoutRef.current = null;
    }
  }, [userDisplayName]);

  // Sync scan settings when modal opens or external state changes
  useEffect(() => {
    if (isOpen) {
      setLocalScanSettings(scanSettings);
    }
  }, [isOpen, scanSettings]);

  const handleAutoScanGlobalToggle = async (enabled: boolean) => {
    const newSettings = { ...localScanSettings, autoScanGlobalOnStartup: enabled };
    setLocalScanSettings(newSettings);
    await saveScanSettings(newSettings);
    onScanSettingsChange?.(newSettings);
  };

  const handleAutoScanHomeToggle = async (enabled: boolean) => {
    const newSettings = { ...localScanSettings, autoScanHomeDirectoryOnStartup: enabled };
    setLocalScanSettings(newSettings);
    await saveScanSettings(newSettings);
    onScanSettingsChange?.(newSettings);
  };

  const handleAutoScanWatchedToggle = async (enabled: boolean) => {
    const newSettings = { ...localScanSettings, autoScanWatchedOnStartup: enabled };
    setLocalScanSettings(newSettings);
    await saveScanSettings(newSettings);
    onScanSettingsChange?.(newSettings);
  };

  const handleAddDirectory = async () => {
    const selectedPath = await open({
      directory: true,
      multiple: false,
      title: 'Select Directory to Watch'
    });

    if (selectedPath && typeof selectedPath === 'string') {
      await addWatchedDirectory(selectedPath);
      const updated = await getScanSettings();
      setLocalScanSettings(updated);
      onScanSettingsChange?.(updated);
    }
  };

  const handleRemoveDirectory = async (directory: string) => {
    await removeWatchedDirectory(directory);
    const updated = await getScanSettings();
    setLocalScanSettings(updated);
    onScanSettingsChange?.(updated);
  };

  const refreshFullDiskStatus = useCallback(async () => {
    if (!isMacPlatform) {
      setFullDiskStatus('granted');
      setFullDiskStatusMessage(null);
      return;
    }
    setFullDiskStatus('checking');
    setFullDiskStatusMessage(null);
    try {
      const granted = await checkFullDiskAccess();
      setFullDiskStatus(granted ? 'granted' : 'denied');
      if (granted) {
        // Auto-enable fullDiskAccessEnabled when FDA is granted
        let pendingSave: ScanSettings | null = null;
        setLocalScanSettings(prev => {
          if (prev.fullDiskAccessEnabled) {
            return prev;
          }
          const next = { ...prev, fullDiskAccessEnabled: true };
          pendingSave = next;
          return next;
        });
        if (pendingSave) {
          await saveScanSettings(pendingSave);
          onScanSettingsChange?.(pendingSave);
        }
      } else {
        let pendingSave: ScanSettings | null = null;
        setLocalScanSettings(prev => {
          if (!prev.fullDiskAccessEnabled) {
            return prev;
          }
          const next = { ...prev, fullDiskAccessEnabled: false };
          pendingSave = next;
          return next;
        });
        if (pendingSave) {
          await saveScanSettings(pendingSave);
          onScanSettingsChange?.(pendingSave);
          setFullDiskStatusMessage({
            tone: 'warn',
            text: 'macOS is still blocking Desktop/Documents. Grant Full Disk Access or keep using watched folders.',
          });
        }
      }
    } catch (error) {
      console.error('Failed to check full disk access:', error);
      setFullDiskStatus('denied');
      setFullDiskStatusMessage({
        tone: 'warn',
        text: 'Unable to verify Full Disk Access right now. Try again or keep using watched folders.',
      });
    }
  }, [isMacPlatform, onScanSettingsChange]);

  const handleOpenFullDiskSettings = useCallback(async () => {
    if (!isMacPlatform) {
      setFullDiskStatusMessage({
        tone: 'info',
        text: 'Full Disk Access applies only to macOS. Windows/Linux already provide full access.',
      });
      return;
    }
    setIsOpeningFullDiskSettings(true);
    setFullDiskStatusMessage(null);
    try {
      await openFullDiskAccessSettings();
      setFullDiskStatusMessage({
        tone: 'info',
        text: 'System Settings opened. In Privacy & Security → Full Disk Access (HT210595), add or enable Vinsly, then choose “Check again”.',
      });
      if (postGrantCheckTimeoutRef.current) {
        window.clearTimeout(postGrantCheckTimeoutRef.current);
      }
      postGrantCheckTimeoutRef.current = window.setTimeout(() => {
        void refreshFullDiskStatus();
        postGrantCheckTimeoutRef.current = null;
      }, 2500);
    } catch (error) {
      console.error('Failed to open Full Disk Access settings:', error);
      const details = error instanceof Error ? error.message : String(error);
      setFullDiskStatusMessage({
        tone: 'warn',
        text: `Unable to open System Settings automatically (${details}). Please open Privacy & Security → Full Disk Access manually.`,
      });
    } finally {
      setIsOpeningFullDiskSettings(false);
    }
  }, [isMacPlatform]);

  const handleFullDiskAccessToggle = useCallback(async (enabled: boolean) => {
    if (enabled && isMacPlatform && fullDiskStatus !== 'granted') {
      setFullDiskStatusMessage({
        tone: 'warn',
        text: 'Grant Full Disk Access in System Settings and press “Check again” before enabling it.',
      });
      return;
    }
    const newSettings = { ...localScanSettings, fullDiskAccessEnabled: enabled };
    setLocalScanSettings(newSettings);
    await saveScanSettings(newSettings);
    onScanSettingsChange?.(newSettings);
    if (!enabled) {
      setFullDiskStatusMessage({
        tone: 'info',
        text: 'Full Disk Access disabled—use watched folders below to scan Desktop or Documents individually.',
      });
    } else {
      setFullDiskStatusMessage(null);
    }
  }, [fullDiskStatus, isMacPlatform, localScanSettings, onScanSettingsChange]);

  const handleDisplayNameSave = useCallback(async () => {
    const trimmed = displayNameInput.trim();
    if (!trimmed || trimmed === userDisplayName.trim()) {
      return;
    }
    setDisplayNameSaveState('saving');
    try {
      await Promise.resolve(onDisplayNameChange(trimmed));
      setDisplayNameSaveState('success');
      if (displayNameSaveTimeoutRef.current) {
        window.clearTimeout(displayNameSaveTimeoutRef.current);
      }
      displayNameSaveTimeoutRef.current = window.setTimeout(() => {
        setDisplayNameSaveState('idle');
        displayNameSaveTimeoutRef.current = null;
      }, 2000);
    } catch (error) {
      console.error('Failed to update display name:', error);
      setDisplayNameSaveState('idle');
    }
  }, [displayNameInput, onDisplayNameChange, userDisplayName]);

  useEffect(() => {
    if (isOpen) {
      void refreshFullDiskStatus();
    } else {
      setFullDiskStatus('unknown');
      setFullDiskStatusMessage(null);
    }
  }, [isOpen, refreshFullDiskStatus]);

  useEffect(() => {
    return () => {
      if (displayNameSaveTimeoutRef.current) {
        window.clearTimeout(displayNameSaveTimeoutRef.current);
      }
      if (postGrantCheckTimeoutRef.current) {
        window.clearTimeout(postGrantCheckTimeoutRef.current);
      }
    };
  }, []);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-[9999]"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full max-w-4xl h-[600px] bg-v-light-surface dark:bg-v-mid-dark rounded-xl shadow-2xl overflow-hidden flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-v-light-border dark:border-v-border">
                <h2 className="text-xl font-semibold text-v-light-text-primary dark:text-v-text-primary">
                  Settings
                </h2>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-v-light-hover dark:hover:bg-v-light-dark text-v-light-text-secondary dark:text-v-text-secondary transition-colors"
                  aria-label="Close settings"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Two-pane layout */}
              <div className="flex flex-1 overflow-hidden">
                {/* Left Sidebar - Settings Categories */}
                <div className="w-48 bg-v-light-bg dark:bg-v-dark border-r border-v-light-border dark:border-v-border p-3">
                  <nav className="space-y-1">
                    <button
                      onClick={() => setActiveSection('account')}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                        activeSection === 'account'
                          ? 'bg-v-light-hover dark:bg-v-light-dark text-v-accent font-medium'
                          : 'text-v-light-text-primary dark:text-v-text-primary hover:bg-v-light-hover dark:hover:bg-v-light-dark'
                      }`}
                    >
                      Account
                    </button>
                    <button
                      onClick={() => setActiveSection('appearance')}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                        activeSection === 'appearance'
                          ? 'bg-v-light-hover dark:bg-v-light-dark text-v-accent font-medium'
                          : 'text-v-light-text-primary dark:text-v-text-primary hover:bg-v-light-hover dark:hover:bg-v-light-dark'
                      }`}
                    >
                      Appearance
                    </button>
                    <button
                      onClick={() => setActiveSection('scanning')}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                        activeSection === 'scanning'
                          ? 'bg-v-light-hover dark:bg-v-light-dark text-v-accent font-medium'
                          : 'text-v-light-text-primary dark:text-v-text-primary hover:bg-v-light-hover dark:hover:bg-v-light-dark'
                      }`}
                    >
                      Scanning
                    </button>
                    <button
                      onClick={() => setActiveSection('permissions')}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                        activeSection === 'permissions'
                          ? 'bg-v-light-hover dark:bg-v-light-dark text-v-accent font-medium'
                          : 'text-v-light-text-primary dark:text-v-text-primary hover:bg-v-light-hover dark:hover:bg-v-light-dark'
                      }`}
                    >
                      Permissions
                    </button>
                  </nav>
                </div>

                {/* Right Content - Settings Panel */}
                <div className="flex-1 overflow-y-auto p-6">
                  {activeSection === 'appearance' && (
                    <div className="max-w-2xl">
                      <h3 className="text-lg font-semibold text-v-light-text-primary dark:text-v-text-primary mb-1">
                        Appearance
                      </h3>
                      <p className="text-sm text-v-light-text-secondary dark:text-v-text-secondary mb-6">
                        Customise how Vinsly looks on your device
                      </p>

                      {/* Theme Selection */}
                      <div className="space-y-4">
                        <label className="block text-sm font-medium text-v-light-text-primary dark:text-v-text-primary mb-3">
                          Theme
                        </label>

                        <div className="grid grid-cols-3 gap-3">
                          {/* System Theme */}
                          <button
                            onClick={() => onThemeChange('system')}
                            className={`relative p-4 rounded-lg border-2 transition-all ${
                              defaultTheme === 'system'
                                ? 'border-v-accent bg-v-accent/5'
                                : 'border-v-light-border dark:border-v-border hover:border-v-accent/50'
                            }`}
                          >
                            <div className="flex flex-col items-center gap-2">
                              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-slate-300 to-slate-600 flex items-center justify-center">
                                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                              </div>
                              <span className={`text-sm font-medium ${
                                defaultTheme === 'system'
                                  ? 'text-v-accent'
                                  : 'text-v-light-text-primary dark:text-v-text-primary'
                              }`}>
                                System
                              </span>
                            </div>
                            {defaultTheme === 'system' && (
                              <div className="absolute top-2 right-2">
                                <svg className="w-5 h-5 text-v-accent" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                              </div>
                            )}
                          </button>

                          {/* Light Theme */}
                          <button
                            onClick={() => onThemeChange('light')}
                            className={`relative p-4 rounded-lg border-2 transition-all ${
                              defaultTheme === 'light'
                                ? 'border-v-accent bg-v-accent/5'
                                : 'border-v-light-border dark:border-v-border hover:border-v-accent/50'
                            }`}
                          >
                            <div className="flex flex-col items-center gap-2">
                              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
                                <div className="w-8 h-8 rounded-full bg-white border border-gray-300" style={{ boxShadow: '0 0 15px rgba(255, 255, 255, 0.9), 0 0 30px rgba(255, 255, 255, 0.5), inset 0 1px 3px rgba(255, 255, 255, 0.8)' }} />
                              </div>
                              <span className={`text-sm font-medium ${
                                defaultTheme === 'light'
                                  ? 'text-v-accent'
                                  : 'text-v-light-text-primary dark:text-v-text-primary'
                              }`}>
                                Light
                              </span>
                            </div>
                            {defaultTheme === 'light' && (
                              <div className="absolute top-2 right-2">
                                <svg className="w-5 h-5 text-v-accent" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                              </div>
                            )}
                          </button>

                          {/* Dark Theme */}
                          <button
                            onClick={() => onThemeChange('dark')}
                            className={`relative p-4 rounded-lg border-2 transition-all ${
                              defaultTheme === 'dark'
                                ? 'border-v-accent bg-v-accent/5'
                                : 'border-v-light-border dark:border-v-border hover:border-v-accent/50'
                            }`}
                          >
                            <div className="flex flex-col items-center gap-2">
                              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center">
                                <svg className="w-6 h-6 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                                </svg>
                              </div>
                              <span className={`text-sm font-medium ${
                                defaultTheme === 'dark'
                                  ? 'text-v-accent'
                                  : 'text-v-light-text-primary dark:text-v-text-primary'
                              }`}>
                                Dark
                              </span>
                            </div>
                            {defaultTheme === 'dark' && (
                              <div className="absolute top-2 right-2">
                                <svg className="w-5 h-5 text-v-accent" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                              </div>
                            )}
                          </button>
                        </div>

                        <p className="text-xs text-v-light-text-secondary dark:text-v-text-secondary mt-3">
                          {defaultTheme === 'system' && 'Vinsly will match your system theme automatically'}
                          {defaultTheme === 'light' && 'Vinsly will always use light mode'}
                          {defaultTheme === 'dark' && 'Vinsly will always use dark mode'}
                        </p>
                      </div>

                      {/* Default View Selection */}
                      <div className="space-y-4 mt-8">
                        <label className="block text-sm font-medium text-v-light-text-primary dark:text-v-text-primary mb-3">
                          Default Agent List View
                        </label>

                        <div className="grid grid-cols-2 gap-4">
                          {/* Rows View */}
                          <button
                            onClick={() => onViewChange('table')}
                            className={`relative p-5 rounded-lg border-2 transition-all ${
                              defaultView === 'table'
                                ? 'border-v-accent bg-v-accent/5'
                                : 'border-v-light-border dark:border-v-border hover:border-v-accent/50'
                            }`}
                          >
                            <div className="flex flex-col items-center gap-3">
                              {/* Rows Preview */}
                              <div className="w-full aspect-[4/3] rounded-md bg-v-light-bg dark:bg-v-dark p-3 flex flex-col gap-1.5">
                                <div className="h-1.5 bg-v-light-border dark:bg-v-border rounded w-full"></div>
                                <div className="flex flex-col gap-1">
                                  <div className="h-4 bg-v-light-hover dark:bg-v-light-dark rounded-md flex items-center gap-1.5 px-2">
                                    <div className="h-1 w-1 bg-v-accent rounded-full"></div>
                                    <div className="h-1 bg-v-light-border dark:bg-v-border rounded flex-1"></div>
                                  </div>
                                  <div className="h-4 bg-v-light-hover dark:bg-v-light-dark rounded-md flex items-center gap-1.5 px-2">
                                    <div className="h-1 w-1 bg-v-accent rounded-full"></div>
                                    <div className="h-1 bg-v-light-border dark:bg-v-border rounded flex-1"></div>
                                  </div>
                                  <div className="h-4 bg-v-light-hover dark:bg-v-light-dark rounded-md flex items-center gap-1.5 px-2">
                                    <div className="h-1 w-1 bg-v-accent rounded-full"></div>
                                    <div className="h-1 bg-v-light-border dark:bg-v-border rounded flex-1"></div>
                                  </div>
                                </div>
                              </div>
                              <span className={`text-sm font-medium ${
                                defaultView === 'table'
                                  ? 'text-v-accent'
                                  : 'text-v-light-text-primary dark:text-v-text-primary'
                              }`}>
                                Rows
                              </span>
                            </div>
                            {defaultView === 'table' && (
                              <div className="absolute top-2 right-2">
                                <svg className="w-5 h-5 text-v-accent" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                              </div>
                            )}
                          </button>

                          {/* Cards View */}
                          <button
                            onClick={() => onViewChange('grid')}
                            className={`relative p-5 rounded-lg border-2 transition-all ${
                              defaultView === 'grid'
                                ? 'border-v-accent bg-v-accent/5'
                                : 'border-v-light-border dark:border-v-border hover:border-v-accent/50'
                            }`}
                          >
                            <div className="flex flex-col items-center gap-3">
                              {/* Cards Preview */}
                              <div className="w-full aspect-[4/3] rounded-md bg-v-light-bg dark:bg-v-dark p-3 grid grid-cols-2 gap-2">
                                <div className="bg-v-light-surface dark:bg-v-mid-dark rounded-md p-2 border border-v-light-border dark:border-v-border flex flex-col gap-1">
                                  <div className="h-1 w-1 bg-v-accent rounded-full"></div>
                                  <div className="h-0.5 bg-v-light-border dark:bg-v-border rounded w-3/4"></div>
                                  <div className="h-0.5 bg-v-light-border dark:bg-v-border rounded w-full"></div>
                                </div>
                                <div className="bg-v-light-surface dark:bg-v-mid-dark rounded-md p-2 border border-v-light-border dark:border-v-border flex flex-col gap-1">
                                  <div className="h-1 w-1 bg-v-accent rounded-full"></div>
                                  <div className="h-0.5 bg-v-light-border dark:bg-v-border rounded w-3/4"></div>
                                  <div className="h-0.5 bg-v-light-border dark:bg-v-border rounded w-full"></div>
                                </div>
                                <div className="bg-v-light-surface dark:bg-v-mid-dark rounded-md p-2 border border-v-light-border dark:border-v-border flex flex-col gap-1">
                                  <div className="h-1 w-1 bg-v-accent rounded-full"></div>
                                  <div className="h-0.5 bg-v-light-border dark:bg-v-border rounded w-3/4"></div>
                                  <div className="h-0.5 bg-v-light-border dark:bg-v-border rounded w-full"></div>
                                </div>
                                <div className="bg-v-light-surface dark:bg-v-mid-dark rounded-md p-2 border border-v-light-border dark:border-v-border flex flex-col gap-1">
                                  <div className="h-1 w-1 bg-v-accent rounded-full"></div>
                                  <div className="h-0.5 bg-v-light-border dark:bg-v-border rounded w-3/4"></div>
                                  <div className="h-0.5 bg-v-light-border dark:bg-v-border rounded w-full"></div>
                                </div>
                              </div>
                              <span className={`text-sm font-medium ${
                                defaultView === 'grid'
                                  ? 'text-v-accent'
                                  : 'text-v-light-text-primary dark:text-v-text-primary'
                              }`}>
                                Cards
                              </span>
                            </div>
                            {defaultView === 'grid' && (
                              <div className="absolute top-2 right-2">
                                <svg className="w-5 h-5 text-v-accent" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                              </div>
                            )}
                          </button>
                        </div>

                        <p className="text-xs text-v-light-text-secondary dark:text-v-text-secondary mt-3">
                          {defaultView === 'table' && 'Agent list will open in rows view by default'}
                          {defaultView === 'grid' && 'Agent list will open in cards view by default'}
                        </p>
                      </div>

                      <div className="mt-10 pt-6 border-t border-v-light-border dark:border-v-border">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                          <div>
                            <h4 className="text-sm font-semibold text-v-light-text-primary dark:text-v-text-primary">
                              Reset Preferences
                            </h4>
                            <p className="text-xs text-v-light-text-secondary dark:text-v-text-secondary">
                              Restore theme and view defaults to the original settings.
                            </p>
                          </div>
                          <button
                            onClick={onResetPreferences}
                            className="self-start sm:self-auto px-4 py-2 text-sm font-medium text-v-light-text-primary dark:text-v-text-primary border border-v-light-border dark:border-v-border rounded-lg hover:bg-v-light-hover dark:hover:bg-v-light-dark transition-colors"
                          >
                            Reset
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeSection === 'scanning' && (
                    <div className="max-w-2xl">
                      <h3 className="text-lg font-semibold text-v-light-text-primary dark:text-v-text-primary mb-1">
                        Scanning
                      </h3>
                      <p className="text-sm text-v-light-text-secondary dark:text-v-text-secondary mb-6">
                        Configure how Vinsly discovers and monitors Claude Code resources
                      </p>

                      {/* Auto-scan on Startup */}
                      <div className="space-y-4 mb-8">
                        <label className="block text-sm font-medium text-v-light-text-primary dark:text-v-text-primary">
                          Auto-scan on startup
                        </label>
                        <p className="text-xs text-v-light-text-secondary dark:text-v-text-secondary -mt-2">
                          Choose which resources to scan when Vinsly launches
                        </p>

                        <div className="space-y-3">
                          {/* Global resources */}
                          <label className="flex items-center gap-3 p-3 bg-v-light-bg dark:bg-v-dark rounded-lg border border-v-light-border dark:border-v-border cursor-pointer hover:border-v-accent/50 transition-colors">
                            <input
                              type="checkbox"
                              checked={localScanSettings.autoScanGlobalOnStartup}
                              onChange={(e) => handleAutoScanGlobalToggle(e.target.checked)}
                              className="w-4 h-4 rounded border-v-light-border dark:border-v-border text-v-accent focus:ring-v-accent focus:ring-offset-0"
                            />
                            <div className="flex-1">
                              <p className="text-sm font-medium text-v-light-text-primary dark:text-v-text-primary">
                                Global resources
                              </p>
                              <p className="text-xs text-v-light-text-secondary dark:text-v-text-secondary">
                                ~/.claude
                              </p>
                            </div>
                          </label>

                          {/* Watched folders */}
                          <label className="flex items-center gap-3 p-3 bg-v-light-bg dark:bg-v-dark rounded-lg border border-v-light-border dark:border-v-border cursor-pointer hover:border-v-accent/50 transition-colors">
                            <input
                              type="checkbox"
                              checked={localScanSettings.autoScanWatchedOnStartup}
                              onChange={(e) => handleAutoScanWatchedToggle(e.target.checked)}
                              className="w-4 h-4 rounded border-v-light-border dark:border-v-border text-v-accent focus:ring-v-accent focus:ring-offset-0"
                            />
                            <div className="flex-1">
                              <p className="text-sm font-medium text-v-light-text-primary dark:text-v-text-primary">
                                Watched folders
                              </p>
                              <p className="text-xs text-v-light-text-secondary dark:text-v-text-secondary">
                                Configured below
                              </p>
                            </div>
                          </label>

                          {/* Home directory */}
                          {isMacPlatform && !localScanSettings.fullDiskAccessEnabled ? (
                            <div className="flex items-center gap-3 p-3 bg-v-light-bg dark:bg-v-dark rounded-lg border border-v-light-border dark:border-v-border">
                              <div className="flex-1">
                                <p className="text-sm font-medium text-v-light-text-primary dark:text-v-text-primary">
                                  Home directory
                                </p>
                                <button
                                  type="button"
                                  onClick={() => void handleOpenFullDiskSettings()}
                                  className="text-xs text-v-accent hover:text-v-accent-hover hover:underline transition-colors text-left flex items-center gap-1"
                                >
                                  <span>→</span>
                                  <span>Grant Full Disk Access to enable</span>
                                </button>
                              </div>
                            </div>
                          ) : (
                            <label className="flex items-center gap-3 p-3 bg-v-light-bg dark:bg-v-dark rounded-lg border border-v-light-border dark:border-v-border cursor-pointer hover:border-v-accent/50 transition-colors">
                              <input
                                type="checkbox"
                                checked={localScanSettings.autoScanHomeDirectoryOnStartup}
                                onChange={(e) => handleAutoScanHomeToggle(e.target.checked)}
                                className="w-4 h-4 rounded border-v-light-border dark:border-v-border text-v-accent focus:ring-v-accent focus:ring-offset-0"
                              />
                              <div className="flex-1">
                                <p className="text-sm font-medium text-v-light-text-primary dark:text-v-text-primary">
                                  Home directory
                                </p>
                                <p className="text-xs text-v-light-text-secondary dark:text-v-text-secondary">
                                  Scan entire home folder
                                </p>
                              </div>
                            </label>
                          )}
                        </div>
                      </div>

                      {/* Watched Directories */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <label className="block text-sm font-medium text-v-light-text-primary dark:text-v-text-primary">
                            Watched Directories
                          </label>
                          <button
                            onClick={handleAddDirectory}
                            className="px-3 py-1.5 text-sm font-medium text-white bg-v-accent hover:bg-v-accent-hover rounded-lg transition-colors"
                          >
                            Add Directory
                          </button>
                        </div>
                        <p className="text-xs text-v-light-text-secondary dark:text-v-text-secondary">
                          Vinsly will scan these directories for Claude Code resources (agents, skills, commands, etc.)
                        </p>

                        {/* Directory List */}
                        <div className="space-y-2">
                          {localScanSettings.watchedDirectories.length === 0 ? (
                            <div className="p-4 text-center text-sm text-v-light-text-secondary dark:text-v-text-secondary bg-v-light-bg dark:bg-v-dark rounded-lg border border-v-light-border dark:border-v-border">
                              No watched directories. Add one to get started.
                            </div>
                          ) : (
                            localScanSettings.watchedDirectories.map((dir, index) => (
                              <div
                                key={index}
                                className="flex items-center justify-between p-3 bg-v-light-bg dark:bg-v-dark rounded-lg border border-v-light-border dark:border-v-border group hover:border-v-accent/50 transition-colors"
                              >
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                  <svg className="w-5 h-5 text-v-accent flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                  </svg>
                                  <span className="text-sm text-v-light-text-primary dark:text-v-text-primary font-mono truncate">
                                    {dir}
                                  </span>
                                </div>
                                <button
                                  onClick={() => handleRemoveDirectory(dir)}
                                  className="ml-3 p-1.5 text-v-danger hover:bg-v-danger/10 rounded transition-colors"
                                  aria-label="Remove directory"
                                >
                                  <DeleteIcon className="w-4 h-4" />
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {activeSection === 'permissions' && (
                    <div className="max-w-2xl space-y-6">
                      <div>
                        <h3 className="text-lg font-semibold text-v-light-text-primary dark:text-v-text-primary mb-1">
                          Permissions
                        </h3>
                        <p className="text-sm text-v-light-text-secondary dark:text-v-text-secondary">
                          Manage access to protected folders on your Mac.
                        </p>
                      </div>

                      {isMacPlatform ? (
                        <>
                          <div className="space-y-4 border border-v-light-border dark:border-v-border rounded-lg p-5 bg-v-light-bg dark:bg-v-dark">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex-1">
                                <p className="text-sm font-semibold text-v-light-text-primary dark:text-v-text-primary">
                                  Full Disk Access
                                </p>
                                <p className="text-xs text-v-light-text-secondary dark:text-v-text-secondary mt-1">
                                  Allows Vinsly to scan Desktop, Documents, and other protected folders.
                                </p>
                              </div>
                              <span className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${fullDiskStatusTone}`}>
                                {fullDiskStatusLabel}
                              </span>
                            </div>

                            <button
                              onClick={() => void handleOpenFullDiskSettings()}
                              disabled={isOpeningFullDiskSettings || fullDiskStatus === 'checking'}
                              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                                fullDiskStatus === 'granted'
                                  ? 'border border-v-light-border dark:border-v-border text-v-light-text-primary dark:text-v-text-primary hover:border-v-accent'
                                  : 'bg-v-accent text-white hover:bg-v-accent-hover'
                              }`}
                            >
                              {isOpeningFullDiskSettings ? 'Opening…' : fullDiskStatus === 'granted' ? 'Open System Settings' : 'Grant Access'}
                            </button>

                            {fullDiskStatus === 'granted' && (
                              <div className="flex items-center justify-between gap-3 pt-2 border-t border-v-light-border/50 dark:border-v-border/50">
                                <div>
                                  <p className="text-sm font-medium text-v-light-text-primary dark:text-v-text-primary">
                                    Include protected folders in home scans
                                  </p>
                                </div>
                                <button
                                  onClick={() => void handleFullDiskAccessToggle(!localScanSettings.fullDiskAccessEnabled)}
                                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-v-accent ${
                                    localScanSettings.fullDiskAccessEnabled ? 'bg-v-accent' : 'bg-v-light-border dark:bg-v-border'
                                  }`}
                                  role="switch"
                                  aria-checked={localScanSettings.fullDiskAccessEnabled}
                                >
                                  <span
                                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
                                      localScanSettings.fullDiskAccessEnabled ? 'translate-x-5' : 'translate-x-0'
                                    }`}
                                  />
                                </button>
                              </div>
                            )}

                            {fullDiskStatus !== 'granted' && fullDiskStatus !== 'checking' && (
                              <p className="text-xs text-amber-600 dark:text-amber-300">
                                Open System Settings → Privacy &amp; Security → Full Disk Access and enable Vinsly.
                              </p>
                            )}
                            {fullDiskStatusMessage && (
                              <div className={`text-xs ${fullDiskMessageClass}`}>
                                {fullDiskStatusMessage.text}
                              </div>
                            )}
                            {isSequoiaOrNewer && fullDiskStatus !== 'granted' && (
                              <div className="text-xs text-v-light-text-secondary dark:text-v-text-secondary border border-dashed border-v-light-border/80 dark:border-v-border/70 rounded-lg p-3 bg-v-light-bg/40 dark:bg-v-dark/40">
                                <button
                                  type="button"
                                  onClick={() => setShowSequoiaTip(prev => !prev)}
                                  className="font-semibold text-v-accent hover:text-v-accent-hover"
                                >
                                  Trouble on macOS 15 (Sequoia)?
                                </button>
                                {showSequoiaTip && (
                                  <p className="mt-2">
                                    macOS 15 may hide Vinsly in the Full Disk Access list. The permission still works once granted.
                                  </p>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="border border-dashed border-v-light-border dark:border-v-border rounded-lg p-4 bg-v-light-bg/60 dark:bg-v-dark/60">
                            <p className="text-sm text-v-light-text-secondary dark:text-v-text-secondary">
                              <span className="font-semibold text-v-light-text-primary dark:text-v-text-primary">Alternative:</span> Skip Full Disk Access and add specific folders in{' '}
                              <button
                                onClick={() => setActiveSection('scanning')}
                                className="font-semibold text-v-accent hover:text-v-accent-hover"
                              >
                                Scanning → Watched Directories
                              </button>
                            </p>
                          </div>
                        </>
                      ) : (
                        <div className="border border-v-light-border dark:border-v-border rounded-lg p-5 bg-v-light-bg/60 dark:bg-v-dark/60 text-sm text-v-light-text-secondary dark:text-v-text-secondary">
                          Your operating system already provides full access. Use{' '}
                          <button
                            onClick={() => setActiveSection('scanning')}
                            className="font-semibold text-v-accent hover:text-v-accent-hover"
                          >
                            Watched Directories
                          </button>{' '}
                          to limit scanning to specific folders.
                        </div>
                      )}
                    </div>
                  )}

                  {activeSection === 'account' && (
                    <div className="max-w-2xl space-y-8">
                      <div>
                        <h3 className="text-lg font-semibold text-v-light-text-primary dark:text-v-text-primary mb-1">
                          Account
                        </h3>
                        <p className="text-sm text-v-light-text-secondary dark:text-v-text-secondary">
                          Manage your licence and organisation details
                        </p>
                      </div>
                      <div className="space-y-5">
                        <div className="border border-v-light-border dark:border-v-border rounded-lg p-5 bg-v-light-bg dark:bg-v-dark space-y-3">
                          <div>
                            <p className="text-sm font-semibold text-v-light-text-primary dark:text-v-text-primary">
                              Display name
                            </p>
                            <p className="text-xs text-v-light-text-secondary dark:text-v-text-secondary">
                              Used across the app (e.g. Swarm View)
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <input
                              type="text"
                              value={displayNameInput}
                              onChange={(event) => {
                                setDisplayNameInput(event.target.value);
                                if (displayNameSaveState !== 'idle') {
                                  setDisplayNameSaveState('idle');
                                  if (displayNameSaveTimeoutRef.current) {
                                    window.clearTimeout(displayNameSaveTimeoutRef.current);
                                    displayNameSaveTimeoutRef.current = null;
                                  }
                                }
                              }}
                              className="flex-1 px-4 py-2 rounded-lg border border-v-light-border dark:border-v-border bg-transparent text-v-light-text-primary dark:text-v-text-primary focus-visible:outline-none focus:ring-2 focus:ring-v-accent"
                              placeholder="e.g. Lunar Labs"
                            />
                            <button
                              onClick={() => void handleDisplayNameSave()}
                              disabled={!isDisplayNameDirty || isDisplayNameSaving}
                              className={`px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                                isDisplayNameSaved
                                  ? 'bg-green-600 text-white'
                                  : 'bg-v-accent text-white hover:bg-v-accent-hover'
                              }`}
                              type="button"
                            >
                              {isDisplayNameSaving && (
                                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                                  <circle
                                    cx="12"
                                    cy="12"
                                    r="10"
                                    stroke="currentColor"
                                    strokeWidth="4"
                                    strokeDasharray="60"
                                    strokeDashoffset="20"
                                    strokeLinecap="round"
                                  />
                                </svg>
                              )}
                              {isDisplayNameSaved && !isDisplayNameSaving && (
                                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none">
                                  <path
                                    d="M5 13l4 4L19 7"
                                    stroke="currentColor"
                                    strokeWidth="3"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              )}
                              <span>{isDisplayNameSaved ? 'Saved' : isDisplayNameSaving ? 'Saving…' : 'Save'}</span>
                            </button>
                          </div>
                        </div>

                        <div className="border border-v-light-border dark:border-v-border rounded-lg p-5 bg-v-light-bg dark:bg-v-dark">
                          <div className="flex items-center justify-between mb-4">
                            <div>
                              <p className="text-sm font-semibold text-v-light-text-primary dark:text-v-text-primary">
                                Licence status
                              </p>
                              <p className="text-xs text-v-light-text-secondary dark:text-v-text-secondary mt-1">
                                {licenseInfo ? `Last checked ${new Date(licenseInfo.lastChecked).toLocaleDateString()}` : 'Not activated'}
                              </p>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${licenseInfo ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-200'}`}>
                              {licenseInfo ? licenseInfo.status.toUpperCase() : 'PENDING'}
                            </span>
                          </div>
                          <div className="space-y-2 text-sm">
                            <div className="flex items-center justify-between">
                              <span className="text-v-light-text-secondary dark:text-v-text-secondary">Licence key</span>
                              <span className="font-mono text-v-light-text-primary dark:text-v-text-primary">
                                {licenseInfo ? `•••• ${licenseInfo.licenseKey.slice(-4)}` : 'Not set'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-v-light-text-secondary dark:text-v-text-secondary">Email</span>
                              <span className="text-v-light-text-primary dark:text-v-text-primary">
                                {licenseInfo?.email || '—'}
                              </span>
                            </div>
                          </div>
                          <div className="mt-4 flex flex-wrap gap-3">
                            <button
                              onClick={onResetLicense}
                              className="px-4 py-2 text-sm font-semibold border border-v-light-border dark:border-v-border rounded-md text-v-light-text-primary dark:text-v-text-primary hover:border-v-accent transition-colors"
                            >
                              Change licence
                            </button>
                          </div>
                        </div>

                        <div className="border border-v-light-border dark:border-v-border rounded-lg p-5 bg-v-light-bg dark:bg-v-dark space-y-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-semibold text-v-light-text-primary dark:text-v-text-primary">
                                Updates
                              </p>
                              <p className="text-xs text-v-light-text-secondary dark:text-v-text-secondary">
                                Install new versions when available
                              </p>
                            </div>
                            {pendingUpdate && (
                              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-v-accent/10 text-v-accent">
                                Update available
                              </span>
                            )}
                          </div>

                          <div className="space-y-2 text-sm">
                            <div className="flex items-center justify-between">
                              <span className="text-v-light-text-secondary dark:text-v-text-secondary">Current version</span>
                              <span className="font-mono text-v-light-text-primary dark:text-v-text-primary">{appVersion || '—'}</span>
                            </div>
                            {!pendingUpdate && (
                              <p className="text-v-light-text-secondary dark:text-v-text-secondary">
                                You're up to date
                              </p>
                            )}
                          </div>

                          {pendingUpdate && (
                            <div className="mt-4">
                              <button
                                onClick={() => void onInstallUpdate()}
                                disabled={isInstallingUpdate}
                                className="px-4 py-2 rounded-lg bg-v-accent text-white font-semibold hover:bg-v-accent-hover disabled:opacity-60 disabled:cursor-not-allowed transition-colors text-sm"
                              >
                                {isInstallingUpdate ? 'Installing…' : `Install ${pendingUpdate.version}`}
                              </button>
                            </div>
                          )}

                          {pendingUpdate?.notes && (
                            <div className="mt-4 p-3 rounded-lg border border-dashed border-v-light-border dark:border-v-border bg-v-light-surface dark:bg-v-mid-dark text-xs text-v-light-text-secondary dark:text-v-text-secondary whitespace-pre-line">
                              {pendingUpdate.notes.length > 600 ? `${pendingUpdate.notes.slice(0, 600)}…` : pendingUpdate.notes}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
