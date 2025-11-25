import { renderHook, act, waitFor } from '@testing-library/react';
import { useLicense } from '../useLicense';
import * as storage from '../../utils/storage';
import * as deviceFingerprint from '../../utils/deviceFingerprint';
import * as licensingClient from '../../utils/licensingClient';
import { LicenseInfo } from '../../types/licensing';
import { ToastType } from '../../components/Toast';

jest.mock('../../utils/storage', () => ({
  getStorageItem: jest.fn(),
  setStorageItem: jest.fn(),
  removeStorageItem: jest.fn(),
}));

jest.mock('../../utils/deviceFingerprint', () => ({
  getOrCreateDeviceFingerprint: jest.fn(),
}));

jest.mock('../../utils/licensingClient', () => ({
  sendHeartbeat: jest.fn(),
}));

const mockShowToast = jest.fn<void, [ToastType, string]>();

describe('useLicense', () => {
  const baseLicense: LicenseInfo = {
    licenseKey: 'key',
    email: 'test@example.com',
    status: 'active',
    lastChecked: '2024-01-01T00:00:00.000Z',
    token: 'token',
    deviceFingerprint: 'fp-123',
    maxDevices: 3,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (storage.getStorageItem as jest.Mock).mockResolvedValue(null);
    (deviceFingerprint.getOrCreateDeviceFingerprint as jest.Mock).mockResolvedValue('fp-123');
    (licensingClient.sendHeartbeat as jest.Mock).mockResolvedValue(undefined);
  });

  test('ensures device fingerprint on mount', async () => {
    const { result } = renderHook(() => useLicense({ showToast: mockShowToast }));
    await waitFor(() => expect(result.current.deviceFingerprint).toBe('fp-123'));
    expect(deviceFingerprint.getOrCreateDeviceFingerprint).toHaveBeenCalled();
  });

  test('setLicense persists and marks onboarding complete', async () => {
    const { result } = renderHook(() => useLicense({ showToast: mockShowToast }));
    await waitFor(() => expect(result.current.deviceFingerprint).toBe('fp-123'));
    await act(async () => {
      await result.current.setLicense(baseLicense);
    });
    await waitFor(() => expect(result.current.licenseInfo).toEqual(baseLicense));
    expect(result.current.isOnboardingComplete).toBe(true);
    expect(storage.setStorageItem).toHaveBeenCalledWith('vinsly-license-info', baseLicense);
  });

  test('resetLicense clears state and calls onResetComplete', async () => {
    const onResetComplete = jest.fn();
    const { result } = renderHook(() =>
      useLicense({ showToast: mockShowToast, onResetComplete })
    );
    await act(async () => {
      await result.current.setLicense(baseLicense);
    });
    await act(async () => {
      await result.current.resetLicense();
    });
    expect(result.current.licenseInfo).toBeNull();
    expect(result.current.isOnboardingComplete).toBe(false);
    expect(onResetComplete).toHaveBeenCalled();
    expect(storage.removeStorageItem).toHaveBeenCalledWith('vinsly-license-info');
  });
});
