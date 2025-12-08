import { useCallback, useRef, useState } from 'react';
import { ScanSettings } from '../types';
import { getScanSettings } from '../utils/scanSettings';

export const DEFAULT_SCAN_SETTINGS: ScanSettings = {
  autoScanGlobalOnStartup: false,
  autoScanWatchedOnStartup: false,
  autoScanHomeDirectoryOnStartup: false,
  fullDiskAccessEnabled: false,
  watchedDirectories: [],
};

export interface UseScanSettingsResult {
  scanSettings: ScanSettings;
  scanSettingsRef: React.RefObject<ScanSettings>;
  applyScanSettings: (settings: ScanSettings) => void;
  loadInitialSettings: () => Promise<ScanSettings>;
}

export function useScanSettings(): UseScanSettingsResult {
  const [scanSettings, setScanSettings] = useState<ScanSettings>(DEFAULT_SCAN_SETTINGS);
  const scanSettingsRef = useRef<ScanSettings>(DEFAULT_SCAN_SETTINGS);

  const applyScanSettings = useCallback((next: ScanSettings) => {
    scanSettingsRef.current = next;
    setScanSettings(next);
  }, []);

  const loadInitialSettings = useCallback(async () => {
    const storedSettings = await getScanSettings();
    applyScanSettings(storedSettings);
    return storedSettings;
  }, [applyScanSettings]);

  return {
    scanSettings,
    scanSettingsRef,
    applyScanSettings,
    loadInitialSettings,
  };
}
