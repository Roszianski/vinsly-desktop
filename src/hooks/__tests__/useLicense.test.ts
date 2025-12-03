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

const mockShowToast = jest.fn<void, [ToastType, string]>();

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

  test('enters grace period when validation fails', async () => {
    (storage.getStorageItem as jest.Mock)
      .mockResolvedValueOnce(baseLicense) // First call: license info
      .mockResolvedValueOnce(null); // Second call: grace period key

    (lemonLicensingClient.validateLicenseWithLemon as jest.Mock).mockRejectedValue(
      new Error('Network error')
    );

    const { result } = renderHook(() => useLicense({ showToast: mockShowToast }));
    await waitFor(() => expect(result.current.licenseBootstrapComplete).toBe(true));

    // Should still be onboarding complete (grace period active)
    expect(result.current.isOnboardingComplete).toBe(true);
    expect(result.current.licenseInfo).toEqual(baseLicense);
    expect(mockShowToast).toHaveBeenCalled();
  });
});
