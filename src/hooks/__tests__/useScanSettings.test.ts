import { renderHook, act } from '@testing-library/react';
import { useScanSettings, DEFAULT_SCAN_SETTINGS } from '../useScanSettings';
import * as scanSettingsUtil from '../../utils/scanSettings';

jest.mock('../../utils/scanSettings', () => ({
  getScanSettings: jest.fn(),
}));

describe('useScanSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (scanSettingsUtil.getScanSettings as jest.Mock).mockResolvedValue(DEFAULT_SCAN_SETTINGS);
  });

  test('loads initial settings', async () => {
    const stored = { ...DEFAULT_SCAN_SETTINGS, autoScanGlobalOnStartup: true };
    (scanSettingsUtil.getScanSettings as jest.Mock).mockResolvedValue(stored);

    const { result } = renderHook(() => useScanSettings());
    await act(async () => {
      await result.current.loadInitialSettings();
    });

    expect(result.current.scanSettings).toEqual(stored);
    expect(result.current.scanSettingsRef.current).toEqual(stored);
  });

  test('applyScanSettings updates state and ref', () => {
    const { result } = renderHook(() => useScanSettings());
    const next = { ...DEFAULT_SCAN_SETTINGS, watchedDirectories: ['/tmp'] };
    act(() => {
      result.current.applyScanSettings(next);
    });
    expect(result.current.scanSettings.watchedDirectories).toEqual(['/tmp']);
    expect(result.current.scanSettingsRef.current).toEqual(next);
  });
});
