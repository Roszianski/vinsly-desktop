import { ScanSettings } from '../types';
import { getStorageItem, setStorageItem } from './storage';

const SCAN_SETTINGS_KEY = 'vinsly-scan-settings';

// Default scan settings
const DEFAULT_SCAN_SETTINGS: ScanSettings = {
  autoScanGlobalOnStartup: false,
  autoScanWatchedOnStartup: false,
  autoScanHomeDirectoryOnStartup: false,
  fullDiskAccessEnabled: false,
  watchedDirectories: [],
};

type RawScanSettings = Partial<ScanSettings> & {
  autoScanOnStartup?: boolean;
  [key: string]: unknown;
};

const normalizeSettings = (settings?: RawScanSettings): ScanSettings => {
  if (!settings) {
    return DEFAULT_SCAN_SETTINGS;
  }

  // Backward compatibility for legacy `autoScanOnStartup`
  const legacyAutoScan = typeof settings.autoScanOnStartup === 'boolean'
    ? settings.autoScanOnStartup
    : undefined;

  return {
    autoScanGlobalOnStartup:
      typeof settings.autoScanGlobalOnStartup === 'boolean'
        ? settings.autoScanGlobalOnStartup
        : legacyAutoScan ?? DEFAULT_SCAN_SETTINGS.autoScanGlobalOnStartup,
    autoScanWatchedOnStartup:
      typeof settings.autoScanWatchedOnStartup === 'boolean'
        ? settings.autoScanWatchedOnStartup
        : legacyAutoScan ?? DEFAULT_SCAN_SETTINGS.autoScanWatchedOnStartup,
    autoScanHomeDirectoryOnStartup:
      typeof settings.autoScanHomeDirectoryOnStartup === 'boolean'
        ? settings.autoScanHomeDirectoryOnStartup
        : DEFAULT_SCAN_SETTINGS.autoScanHomeDirectoryOnStartup,
    fullDiskAccessEnabled:
      typeof settings.fullDiskAccessEnabled === 'boolean'
        ? settings.fullDiskAccessEnabled
        : DEFAULT_SCAN_SETTINGS.fullDiskAccessEnabled,
    watchedDirectories: Array.isArray(settings.watchedDirectories)
      ? (settings.watchedDirectories as string[])
      : DEFAULT_SCAN_SETTINGS.watchedDirectories,
  };
};

// Get scan settings from storage
export async function getScanSettings(): Promise<ScanSettings> {
  try {
    const settings = await getStorageItem<RawScanSettings>(SCAN_SETTINGS_KEY);
    return normalizeSettings(settings || undefined);
  } catch (error) {
    console.error('Error loading scan settings:', error);
    return DEFAULT_SCAN_SETTINGS;
  }
}

// Save scan settings to storage
export async function saveScanSettings(settings: ScanSettings): Promise<void> {
  try {
    await setStorageItem(SCAN_SETTINGS_KEY, settings);
  } catch (error) {
    console.error('Error saving scan settings:', error);
    throw error;
  }
}

// Update auto-scan on startup setting (global scope)
export async function setAutoScanOnStartup(enabled: boolean): Promise<void> {
  const settings = await getScanSettings();
  await saveScanSettings({ ...settings, autoScanGlobalOnStartup: enabled });
}

export async function setAutoScanHomeDirectory(enabled: boolean): Promise<void> {
  const settings = await getScanSettings();
  await saveScanSettings({ ...settings, autoScanHomeDirectoryOnStartup: enabled });
}

// Add a directory to watched directories
export async function addWatchedDirectory(directory: string): Promise<void> {
  const settings = await getScanSettings();
  if (!settings.watchedDirectories.includes(directory)) {
    await saveScanSettings({
      ...settings,
      watchedDirectories: [...settings.watchedDirectories, directory],
    });
  }
}

// Remove a directory from watched directories
export async function removeWatchedDirectory(directory: string): Promise<void> {
  const settings = await getScanSettings();
  await saveScanSettings({
    ...settings,
    watchedDirectories: settings.watchedDirectories.filter(dir => dir !== directory),
  });
}
