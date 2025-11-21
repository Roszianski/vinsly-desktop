import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Theme } from '../App';
import { LicenseInfo } from '../types/licensing';
import { LoadAgentsOptions, ScanSettings } from '../types';
import { SunIcon } from './icons/SunIcon';
import { MoonIcon } from './icons/MoonIcon';
import { LightbulbIcon } from './icons/LightbulbIcon';
import { SettingsModal } from './SettingsModal';
import { ScanModal } from './ScanModal';
import { iconButtonVariants, themeToggleVariants } from '../animations';
import { getStorageItem, setStorageItem } from '../utils/storage';
import { useToast } from '../contexts/ToastContext';

interface HeaderProps {
    theme: Theme;
    onToggleTheme: () => void;
    onStartTour: () => void;
    onNavigateHome: () => void;
    onScan: (options?: LoadAgentsOptions) => Promise<{ total: number; newCount: number }>;
    licenseInfo: LicenseInfo | null;
    onResetLicense: () => void;
    userDisplayName: string;
    onDisplayNameChange: (name: string) => void;
    scanSettings: ScanSettings;
    onScanSettingsChange?: (settings: ScanSettings) => void;
}

export const Header: React.FC<HeaderProps> = ({
  theme,
  onToggleTheme,
  onStartTour,
  onNavigateHome,
  onScan,
  licenseInfo,
  onResetLicense,
  userDisplayName,
  onDisplayNameChange,
  scanSettings,
  onScanSettingsChange
}) => {
  const { showToast } = useToast();
  const [showScanModal, setShowScanModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [defaultTheme, setDefaultTheme] = useState<'system' | 'light' | 'dark'>('system');
  const [defaultView, setDefaultView] = useState<'table' | 'grid'>('table');

  // Load default view from storage on mount
  useEffect(() => {
    const loadDefaultView = async () => {
      const stored = await getStorageItem<'table' | 'grid'>('vinsly-default-view');
      if (stored === 'grid' || stored === 'table') {
        setDefaultView(stored);
      }
    };
    loadDefaultView();
  }, []);

  useEffect(() => {
    const loadThemePreference = async () => {
      const storedPreference = await getStorageItem<'system' | 'light' | 'dark'>('vinsly-theme-preference');
      if (storedPreference === 'system' || storedPreference === 'light' || storedPreference === 'dark') {
        setDefaultTheme(storedPreference);
        return;
      }

      const storedTheme = await getStorageItem<Theme>('vinsly-theme');
      if (storedTheme === 'light' || storedTheme === 'dark') {
        setDefaultTheme(storedTheme);
      }
    };

    loadThemePreference();
  }, []);

  const resolveSystemTheme = (): Theme => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'dark';
  };

  const handleThemePreference = async (preference: 'system' | 'light' | 'dark') => {
    setDefaultTheme(preference);
    await setStorageItem('vinsly-theme-preference', preference);
    console.log(`Theme preference set to: ${preference}`);

    // Immediately apply the theme
    if (preference === 'system') {
      const systemTheme = resolveSystemTheme();
      if (theme !== systemTheme) {
        onToggleTheme();
      }
    } else {
      // Direct theme selection
      if (theme !== preference) {
        onToggleTheme();
      }
    }

  };

  const handleViewPreference = async (preference: 'table' | 'grid') => {
    setDefaultView(preference);
    await setStorageItem('vinsly-default-view', preference);
    await setStorageItem('vinsly-agent-list-layout', preference);
    // Dispatch custom event to immediately update the current view
    window.dispatchEvent(new CustomEvent('vinsly-view-change', { detail: { view: preference } }));
    console.log(`Default view preference set to: ${preference}`);
  };

  const handleResetPreferences = async () => {
    await handleThemePreference('system');
    await handleViewPreference('table');
    showToast('success', 'Preferences reset to defaults');
  };

  return (
    <header className="bg-v-light-surface dark:bg-v-mid-dark border-b border-v-light-border dark:border-v-border transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <button
            type="button"
            onClick={onNavigateHome}
            className="flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-v-accent/70 rounded-md px-0 py-0.5"
            aria-label="Go to agent list"
          >
            <span className="font-bold text-[1.65rem] sm:text-[1.75rem] text-v-light-text-primary dark:text-v-text-primary tracking-wider transition-colors">
              VINSLY
            </span>
            <span className="ml-3 text-sm text-v-light-text-secondary dark:text-v-text-secondary font-mono">
              / Agent Studio
            </span>
          </button>
          <div className="flex items-center gap-3">
            {/* Scan Button */}
            <button
              data-tour="scan-button"
              onClick={() => setShowScanModal(true)}
              className="px-4 py-2 rounded-lg border border-v-light-border dark:border-v-border text-sm font-medium text-v-light-text-primary dark:text-v-text-primary bg-v-light-bg dark:bg-v-dark hover:bg-v-light-hover dark:hover:bg-v-light-dark focus:outline-none focus-visible:ring-1 focus-visible:ring-v-accent/60 transition-colors cursor-pointer"
              aria-label="Scan for agents"
            >
              Scan
            </button>

            <button
              onClick={onStartTour}
              className="p-2 rounded-lg border border-v-light-border dark:border-v-border text-v-light-text-secondary dark:text-v-text-secondary bg-v-light-bg dark:bg-v-dark hover:bg-v-light-hover dark:hover:bg-v-light-dark focus:outline-none focus-visible:ring-1 focus-visible:ring-v-accent/60 transition-colors cursor-pointer"
              aria-label="Start guided tour"
            >
              <LightbulbIcon className="h-5 w-5" />
            </button>

            {/* Theme Toggle - Light | Dark */}
            <div className="flex items-center border border-v-light-border dark:border-v-border rounded-lg overflow-hidden bg-v-light-bg dark:bg-v-dark">
              <button
                onClick={() => theme === 'dark' && onToggleTheme()}
                className={`px-3 py-2 text-sm font-medium transition-colors duration-150 flex items-center gap-1.5 cursor-pointer ${
                  theme === 'light'
                    ? 'bg-v-light-hover dark:bg-v-light-dark text-v-light-text-primary dark:text-v-text-primary'
                    : 'text-v-light-text-secondary dark:text-v-text-secondary hover:bg-v-light-hover dark:hover:bg-v-light-dark'
                }`}
                aria-label="Light mode"
              >
                <SunIcon className="h-4 w-4" />
                <span>Light</span>
              </button>
              <button
                onClick={() => theme === 'light' && onToggleTheme()}
                className={`px-3 py-2 text-sm font-medium transition-colors duration-150 flex items-center gap-1.5 cursor-pointer ${
                  theme === 'dark'
                    ? 'bg-v-light-hover dark:bg-v-light-dark text-v-light-text-primary dark:text-v-text-primary'
                    : 'text-v-light-text-secondary dark:text-v-text-secondary hover:bg-v-light-hover dark:hover:bg-v-light-dark'
                }`}
                aria-label="Dark mode"
              >
                <div style={{ transform: 'rotate(35deg)' }}>
                  <MoonIcon className="h-4 w-4" />
                </div>
                <span>Dark</span>
              </button>
            </div>

            {/* Settings Button */}
            <button
              onClick={() => setShowSettingsModal(true)}
              className="p-2 rounded-lg border border-v-light-border dark:border-v-border text-v-light-text-secondary dark:text-v-text-secondary bg-v-light-bg dark:bg-v-dark hover:bg-v-light-hover dark:hover:bg-v-light-dark focus:outline-none focus-visible:ring-1 focus-visible:ring-v-accent/60 transition-colors cursor-pointer"
              aria-label="Settings"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        defaultTheme={defaultTheme}
        onThemeChange={handleThemePreference}
        defaultView={defaultView}
        onViewChange={handleViewPreference}
        onResetPreferences={handleResetPreferences}
        licenseInfo={licenseInfo}
        userDisplayName={userDisplayName}
        onDisplayNameChange={onDisplayNameChange}
        scanSettings={scanSettings}
        onScanSettingsChange={onScanSettingsChange}
        onResetLicense={() => {
          setShowSettingsModal(false);
          onResetLicense();
        }}
      />

      {/* Scan Modal */}
      <ScanModal
        isOpen={showScanModal}
        onClose={() => setShowScanModal(false)}
        onScan={onScan}
        scanSettings={scanSettings}
      />
    </header>
  );
};
