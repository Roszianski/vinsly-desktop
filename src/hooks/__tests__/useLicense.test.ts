import { renderHook, act, waitFor } from '@testing-library/react';
import { useLicense } from '../useLicense';
import * as storage from '../../utils/storage';
import * as lemonLicensingClient from '../../utils/lemonLicensingClient';
import { LicenseInfo } from '../../types/licensing';
import { ToastType } from '../../components/Toast';

jest.mock('../../utils/storage', () => ({
  getStorageItem: jest.fn(),
  setStorageItem: jest.fn(),
  removeStorageItem: jest.fn(),
}));

jest.mock('../../utils/lemonLicensingClient', () => ({
  validateLicenseWithLemon: jest.fn(),
}));

jest.mock('../../utils/devLogger', () => ({
  devLog: {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

const mockShowToast = jest.fn<void, [ToastType, string]>();

// Helper to create a mock for getStorageItem that returns values based on keys
function createStorageMock(values: Record<string, unknown>) {
  return jest.fn().mockImplementation((key: string) => {
    return Promise.resolve(values[key] ?? null);
  });
}

describe('useLicense', () => {
  const baseLicense: LicenseInfo = {
    licenseKey: 'XXXX-XXXX-XXXX-XXXX',
    email: 'test@example.com',
    status: 'active',
    lastChecked: '2024-01-01T00:00:00.000Z',
    instanceId: 'instance-123',
    instanceName: 'Test Device',
    activationLimit: 3,
    activationUsage: 1,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (storage.getStorageItem as jest.Mock).mockResolvedValue(null);
    (storage.setStorageItem as jest.Mock).mockResolvedValue(undefined);
    (storage.removeStorageItem as jest.Mock).mockResolvedValue(undefined);
    (lemonLicensingClient.validateLicenseWithLemon as jest.Mock).mockResolvedValue({
      valid: true,
      status: 'active',
      licenseKey: {
        activation_limit: 3,
        activation_usage: 1,
      },
    });
  });

  test('initializes with null license when no stored license exists', async () => {
    const { result } = renderHook(() => useLicense({ showToast: mockShowToast }));
    await waitFor(() => expect(result.current.licenseBootstrapComplete).toBe(true));
    expect(result.current.licenseInfo).toBeNull();
    expect(result.current.isOnboardingComplete).toBe(false);
  });

  test('hydrates and validates stored license on mount', async () => {
    (storage.getStorageItem as jest.Mock).mockResolvedValue(baseLicense);

    const { result } = renderHook(() => useLicense({ showToast: mockShowToast }));
    await waitFor(() => expect(result.current.licenseBootstrapComplete).toBe(true));

    expect(lemonLicensingClient.validateLicenseWithLemon).toHaveBeenCalledWith(
      baseLicense.licenseKey,
      baseLicense.instanceId
    );
    expect(result.current.licenseInfo?.status).toBe('active');
    expect(result.current.isOnboardingComplete).toBe(true);
  });

  test('accepts valid license even when status is null', async () => {
    (storage.getStorageItem as jest.Mock).mockResolvedValue(baseLicense);

    // Simulates Rust Option<String>::None serialized as null.
    (lemonLicensingClient.validateLicenseWithLemon as jest.Mock).mockResolvedValue({
      valid: true,
      error: null,
      status: null,
      licenseKey: {
        activation_limit: 3,
        activation_usage: 1,
      },
    });

    const { result } = renderHook(() => useLicense({ showToast: mockShowToast }));
    await waitFor(() => expect(result.current.licenseBootstrapComplete).toBe(true));

    expect(result.current.isOnboardingComplete).toBe(true);
    expect(result.current.licenseInfo).toEqual(expect.objectContaining({
      ...baseLicense,
      status: 'active',
      lastChecked: expect.any(String),
      lastValidated: expect.any(String),
    }));
    // Should not enter grace period for a valid license.
    expect(storage.setStorageItem).not.toHaveBeenCalledWith(
      'vinsly-license-grace-expires',
      expect.any(String)
    );
  });

  test('setLicense persists and marks onboarding complete', async () => {
    const { result } = renderHook(() => useLicense({ showToast: mockShowToast }));
    await waitFor(() => expect(result.current.licenseBootstrapComplete).toBe(true));

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

  test('enters grace period when validation fails with no recent validation', async () => {
    (storage.getStorageItem as jest.Mock).mockImplementation(createStorageMock({
      'vinsly-license-info': baseLicense,
      'vinsly-license-last-validated': null,
      'vinsly-license-grace-expires': null,
    }));

    (lemonLicensingClient.validateLicenseWithLemon as jest.Mock).mockRejectedValue(
      new Error('Network error')
    );

    const { result } = renderHook(() => useLicense({ showToast: mockShowToast }));
    await waitFor(() => expect(result.current.licenseBootstrapComplete).toBe(true));

    // Should still be onboarding complete (grace period active)
    expect(result.current.isOnboardingComplete).toBe(true);
    expect(result.current.licenseInfo).toEqual(baseLicense);
    expect(mockShowToast).toHaveBeenCalledWith('info', expect.stringContaining('grace period'));
  });

  test('network error with recent validation (< 3 min) - no toast, no grace period', async () => {
    const recentTimestamp = new Date(Date.now() - 60 * 1000).toISOString(); // 1 minute ago

    (storage.getStorageItem as jest.Mock).mockImplementation(createStorageMock({
      'vinsly-license-info': baseLicense,
      'vinsly-license-last-validated': recentTimestamp,
    }));

    (lemonLicensingClient.validateLicenseWithLemon as jest.Mock).mockRejectedValue(
      new Error('Network timeout')
    );

    const { result } = renderHook(() => useLicense({ showToast: mockShowToast }));
    await waitFor(() => expect(result.current.licenseBootstrapComplete).toBe(true));

    expect(result.current.isOnboardingComplete).toBe(true);
    expect(result.current.licenseInfo).toEqual(baseLicense);
    // Should NOT show any toast for recent validation
    expect(mockShowToast).not.toHaveBeenCalled();
  });

  test('network error with validation < 24h - info toast, no grace period', async () => {
    const recentTimestamp = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(); // 2 hours ago

    (storage.getStorageItem as jest.Mock).mockImplementation(createStorageMock({
      'vinsly-license-info': baseLicense,
      'vinsly-license-last-validated': recentTimestamp,
    }));

    (lemonLicensingClient.validateLicenseWithLemon as jest.Mock).mockRejectedValue(
      new Error('Network error')
    );

    const { result } = renderHook(() => useLicense({ showToast: mockShowToast }));
    await waitFor(() => expect(result.current.licenseBootstrapComplete).toBe(true));

    expect(result.current.isOnboardingComplete).toBe(true);
    expect(result.current.licenseInfo).toEqual(baseLicense);
    // Should show info toast but NOT grace period message
    expect(mockShowToast).toHaveBeenCalledWith('info', 'Unable to verify license. Will retry later.');
    expect(mockShowToast).not.toHaveBeenCalledWith('info', expect.stringContaining('grace period'));
  });

  test('network error with stale validation (> 24h) - enters grace period', async () => {
    const staleTimestamp = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(); // 25 hours ago

    (storage.getStorageItem as jest.Mock).mockImplementation(createStorageMock({
      'vinsly-license-info': baseLicense,
      'vinsly-license-last-validated': staleTimestamp,
      'vinsly-license-grace-expires': null,
    }));

    (lemonLicensingClient.validateLicenseWithLemon as jest.Mock).mockRejectedValue(
      new Error('Network timeout')
    );

    const { result } = renderHook(() => useLicense({ showToast: mockShowToast }));
    await waitFor(() => expect(result.current.licenseBootstrapComplete).toBe(true));

    expect(result.current.isOnboardingComplete).toBe(true);
    expect(result.current.licenseInfo).toEqual(baseLicense);
    // Should enter grace period
    expect(mockShowToast).toHaveBeenCalledWith('info', expect.stringContaining('grace period'));
    expect(storage.setStorageItem).toHaveBeenCalledWith(
      'vinsly-license-grace-expires',
      expect.any(String)
    );
  });

  test('actual invalid license - immediately enters grace period regardless of recent validation', async () => {
    (storage.getStorageItem as jest.Mock).mockImplementation(createStorageMock({
      'vinsly-license-info': baseLicense,
      'vinsly-license-last-validated': null,
      'vinsly-license-grace-expires': null,
    }));

    // Return invalid status (not a network error)
    (lemonLicensingClient.validateLicenseWithLemon as jest.Mock).mockResolvedValue({
      valid: false,
      status: 'expired',
      error: 'License has expired',
    });

    const { result } = renderHook(() => useLicense({ showToast: mockShowToast }));
    await waitFor(() => expect(result.current.licenseBootstrapComplete).toBe(true));

    // Should enter grace period
    expect(result.current.isOnboardingComplete).toBe(true);
    expect(mockShowToast).toHaveBeenCalledWith('info', expect.stringContaining('grace period'));
  });

  test('successful validation stores lastValidated timestamp', async () => {
    (storage.getStorageItem as jest.Mock).mockImplementation(createStorageMock({
      'vinsly-license-info': baseLicense,
    }));

    const { result } = renderHook(() => useLicense({ showToast: mockShowToast }));
    await waitFor(() => expect(result.current.licenseBootstrapComplete).toBe(true));

    // Should store lastValidated in both license info and separate key
    expect(storage.setStorageItem).toHaveBeenCalledWith(
      'vinsly-license-info',
      expect.objectContaining({ lastValidated: expect.any(String) })
    );
    expect(storage.setStorageItem).toHaveBeenCalledWith(
      'vinsly-license-last-validated',
      expect.any(String)
    );
  });

  test('resetLicense clears lastValidated key', async () => {
    const { result } = renderHook(() => useLicense({ showToast: mockShowToast }));
    await waitFor(() => expect(result.current.licenseBootstrapComplete).toBe(true));

    await act(async () => {
      await result.current.setLicense(baseLicense);
    });

    await act(async () => {
      await result.current.resetLicense();
    });

    expect(storage.removeStorageItem).toHaveBeenCalledWith('vinsly-license-last-validated');
  });
});
