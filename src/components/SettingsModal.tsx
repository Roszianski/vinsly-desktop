import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { open } from '@tauri-apps/plugin-dialog';
import { ScanSettings } from '../types';
import { getScanSettings, saveScanSettings, addWatchedDirectory, removeWatchedDirectory } from '../utils/scanSettings';
import { DeleteIcon } from './icons/DeleteIcon';
import { LicenseInfo } from '../types/licensing';

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
}

type SettingsSection = 'appearance' | 'scanning' | 'account';

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
}) => {
  const [activeSection, setActiveSection] = useState<SettingsSection>('account');
  const [localScanSettings, setLocalScanSettings] = useState<ScanSettings>(scanSettings);
  const [displayNameInput, setDisplayNameInput] = useState(userDisplayName);

  useEffect(() => {
    setDisplayNameInput(userDisplayName);
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
                      Agents & Scanning
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
                        Agents & Scanning
                      </h3>
                      <p className="text-sm text-v-light-text-secondary dark:text-v-text-secondary mb-6">
                        Configure how Vinsly discovers and monitors agent files
                      </p>

                      {/* Auto-scan on Startup */}
                      <div className="space-y-4 mb-8">
                        <div className="flex items-center justify-between p-4 bg-v-light-bg dark:bg-v-dark rounded-lg border border-v-light-border dark:border-v-border">
                          <div className="flex-1 mr-4">
                            <label className="block text-sm font-medium text-v-light-text-primary dark:text-v-text-primary mb-1">
                              Auto-scan global agents
                            </label>
                            <p className="text-xs text-v-light-text-secondary dark:text-v-text-secondary">
                              Keep ~/.claude/agents in sync every time Vinsly launches
                            </p>
                          </div>
                          <button
                            onClick={() => handleAutoScanGlobalToggle(!localScanSettings.autoScanGlobalOnStartup)}
                            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-v-accent focus:ring-offset-2 ${
                              localScanSettings.autoScanGlobalOnStartup ? 'bg-v-accent' : 'bg-v-light-border dark:bg-v-border'
                            }`}
                            role="switch"
                            aria-checked={localScanSettings.autoScanGlobalOnStartup}
                          >
                            <span
                              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                localScanSettings.autoScanGlobalOnStartup ? 'translate-x-5' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </div>

                        <div className="flex items-center justify-between p-4 bg-v-light-bg dark:bg-v-dark rounded-lg border border-v-light-border dark:border-v-border">
                          <div className="flex-1 mr-4">
                            <label className="block text-sm font-medium text-v-light-text-primary dark:text-v-text-primary mb-1">
                              Auto-scan home directory
                            </label>
                            <p className="text-xs text-v-light-text-secondary dark:text-v-text-secondary">
                              Search your home directory for project folders containing `.claude/agents`
                            </p>
                          </div>
                          <button
                            onClick={() => handleAutoScanHomeToggle(!localScanSettings.autoScanHomeDirectoryOnStartup)}
                            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-v-accent focus:ring-offset-2 ${
                              localScanSettings.autoScanHomeDirectoryOnStartup ? 'bg-v-accent' : 'bg-v-light-border dark:bg-v-border'
                            }`}
                            role="switch"
                            aria-checked={localScanSettings.autoScanHomeDirectoryOnStartup}
                          >
                            <span
                              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                localScanSettings.autoScanHomeDirectoryOnStartup ? 'translate-x-5' : 'translate-x-0'
                              }`}
                            />
                          </button>
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
                          Vinsly will scan these directories for project-specific agents
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

                        <div className="border border-v-light-border dark:border-v-border rounded-lg p-5 bg-v-light-bg dark:bg-v-dark space-y-3">
                          <div>
                            <p className="text-sm font-semibold text-v-light-text-primary dark:text-v-text-primary">
                              Display name
                            </p>
                            <p className="text-xs text-v-light-text-secondary dark:text-v-text-secondary">
                              Used across the app (e.g. Visualise view)
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <input
                              type="text"
                              value={displayNameInput}
                              onChange={(event) => setDisplayNameInput(event.target.value)}
                              className="flex-1 px-4 py-2 rounded-lg border border-v-light-border dark:border-v-border bg-transparent text-v-light-text-primary dark:text-v-text-primary focus-visible:outline-none focus:ring-2 focus:ring-v-accent"
                              placeholder="e.g. Lunar Labs"
                            />
                            <button
                              onClick={() => {
                                const trimmed = displayNameInput.trim();
                                if (trimmed) {
                                  onDisplayNameChange(trimmed);
                                }
                              }}
                              disabled={!displayNameInput.trim()}
                              className="px-4 py-2 rounded-lg bg-v-accent text-white text-sm font-semibold hover:bg-v-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              type="button"
                            >
                              Save
                            </button>
                          </div>
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
