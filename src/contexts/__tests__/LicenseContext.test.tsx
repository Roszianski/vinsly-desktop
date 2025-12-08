import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { LicenseProvider, useLicenseContext } from '../LicenseContext';
import { ToastProvider } from '../ToastContext';
import * as storage from '../../utils/storage';
import * as lemonLicensingClient from '../../utils/lemonLicensingClient';
import { LicenseInfo } from '../../types/licensing';

jest.mock('../../utils/storage', () => ({
  getStorageItem: jest.fn(),
  setStorageItem: jest.fn(),
  removeStorageItem: jest.fn(),
}));

jest.mock('../../utils/lemonLicensingClient', () => ({
  validateLicenseWithLemon: jest.fn(),
  activateLicenseWithLemon: jest.fn(),
  deactivateLicenseWithLemon: jest.fn(),
}));

// Mock navigator
Object.defineProperty(navigator, 'onLine', { value: true, writable: true });
Object.defineProperty(navigator, 'platform', { value: 'MacIntel', writable: true });
Object.defineProperty(navigator, 'userAgent', {
  value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  writable: true,
});

function createWrapper() {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <ToastProvider>
        <LicenseProvider>{children}</LicenseProvider>
      </ToastProvider>
    );
  };
}

const mockLicense: LicenseInfo = {
  licenseKey: 'TEST-LICENSE-KEY-1234',
  email: 'test@example.com',
  status: 'active',
  lastChecked: new Date().toISOString(),
  instanceId: 'instance-123',
  instanceName: 'Test Device',
  activationLimit: 5,
  activationUsage: 1,
};

describe('LicenseContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (storage.getStorageItem as jest.Mock).mockResolvedValue(null);
    (storage.setStorageItem as jest.Mock).mockResolvedValue(undefined);
    (storage.removeStorageItem as jest.Mock).mockResolvedValue(undefined);
    (lemonLicensingClient.validateLicenseWithLemon as jest.Mock).mockResolvedValue({
      valid: true,
      status: 'active',
      licenseKey: {
        activation_limit: 5,
        activation_usage: 1,
      },
    });
  });

  describe('useLicenseContext hook', () => {
    it('throws error when used outside provider', () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useLicenseContext());
      }).toThrow('useLicenseContext must be used within a LicenseProvider');

      consoleError.mockRestore();
    });

    it('provides context when used within provider', async () => {
      const { result } = renderHook(() => useLicenseContext(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current).toBeDefined();
        expect(result.current.licenseInfo).toBeDefined();
        expect(result.current.isActivationOpen).toBeDefined();
      });
    });
  });

  describe('Activation modal state', () => {
    it('provides isActivationOpen state', async () => {
      const { result } = renderHook(() => useLicenseContext(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isActivationOpen).toBe(false);
      });
    });

    it('allows toggling activation modal', async () => {
      const { result } = renderHook(() => useLicenseContext(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.setIsActivationOpen).toBeDefined();
      });

      act(() => {
        result.current.setIsActivationOpen(true);
      });

      expect(result.current.isActivationOpen).toBe(true);

      act(() => {
        result.current.setIsActivationOpen(false);
      });

      expect(result.current.isActivationOpen).toBe(false);
    });

    it('tracks activationPresented state', async () => {
      const { result } = renderHook(() => useLicenseContext(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.activationPresented).toBe(false);
      });

      act(() => {
        result.current.setActivationPresented(true);
      });

      expect(result.current.activationPresented).toBe(true);
    });
  });

  describe('License state', () => {
    it('initializes with no license when storage is empty', async () => {
      const { result } = renderHook(() => useLicenseContext(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.licenseBootstrapComplete).toBe(true);
      });

      expect(result.current.licenseInfo).toBeNull();
      expect(result.current.isOnboardingComplete).toBe(false);
    });

    it('loads and validates stored license', async () => {
      (storage.getStorageItem as jest.Mock).mockResolvedValue(mockLicense);

      const { result } = renderHook(() => useLicenseContext(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.licenseBootstrapComplete).toBe(true);
      });

      expect(lemonLicensingClient.validateLicenseWithLemon).toHaveBeenCalledWith(
        mockLicense.licenseKey,
        mockLicense.instanceId
      );
      expect(result.current.licenseInfo?.status).toBe('active');
      expect(result.current.isOnboardingComplete).toBe(true);
    });

    it('allows setting license', async () => {
      const { result } = renderHook(() => useLicenseContext(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.licenseBootstrapComplete).toBe(true);
      });

      await act(async () => {
        await result.current.setLicense(mockLicense);
      });

      await waitFor(() => {
        expect(result.current.licenseInfo).toEqual(mockLicense);
      });

      expect(result.current.isOnboardingComplete).toBe(true);
      expect(storage.setStorageItem).toHaveBeenCalledWith('vinsly-license-info', mockLicense);
    });
  });

  describe('Platform info', () => {
    it('provides platform identifier', async () => {
      const { result } = renderHook(() => useLicenseContext(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.platformIdentifier).toBeDefined();
      });

      // Should contain some platform information
      expect(typeof result.current.platformIdentifier).toBe('string');
    });

    it('provides isMacLike flag', async () => {
      const { result } = renderHook(() => useLicenseContext(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isMacLike).toBeDefined();
      });

      // Based on our mocked navigator.platform = 'MacIntel', this should be true
      expect(result.current.isMacLike).toBe(true);
    });
  });

  describe('Workspace clear registration', () => {
    it('provides registerWorkspaceClear function', async () => {
      const { result } = renderHook(() => useLicenseContext(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.registerWorkspaceClear).toBeDefined();
      });

      expect(typeof result.current.registerWorkspaceClear).toBe('function');
    });

    it('calls registered workspace clear on reset', async () => {
      (storage.getStorageItem as jest.Mock).mockResolvedValue(mockLicense);
      const workspaceClear = jest.fn().mockResolvedValue(undefined);

      const { result } = renderHook(() => useLicenseContext(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.licenseBootstrapComplete).toBe(true);
      });

      // Register workspace clear function
      act(() => {
        result.current.registerWorkspaceClear(workspaceClear);
      });

      // Reset license should trigger workspace clear
      await act(async () => {
        await result.current.resetLicense();
      });

      expect(workspaceClear).toHaveBeenCalled();
    });
  });

  describe('License reset', () => {
    it('clears license state on reset', async () => {
      (storage.getStorageItem as jest.Mock).mockResolvedValue(mockLicense);

      const { result } = renderHook(() => useLicenseContext(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.licenseBootstrapComplete).toBe(true);
      });

      // Verify license is loaded
      expect(result.current.licenseInfo).not.toBeNull();

      // Reset
      await act(async () => {
        await result.current.resetLicense();
      });

      expect(result.current.licenseInfo).toBeNull();
      expect(result.current.isOnboardingComplete).toBe(false);
      expect(storage.removeStorageItem).toHaveBeenCalledWith('vinsly-license-info');
    });
  });

  describe('Grace period handling', () => {
    it('maintains license in grace period when validation fails', async () => {
      (storage.getStorageItem as jest.Mock)
        .mockResolvedValueOnce(mockLicense) // license info
        .mockResolvedValueOnce(null); // grace period key

      (lemonLicensingClient.validateLicenseWithLemon as jest.Mock).mockRejectedValue(
        new Error('Network error')
      );

      const { result } = renderHook(() => useLicenseContext(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.licenseBootstrapComplete).toBe(true);
      });

      // Should still be onboarding complete during grace period
      expect(result.current.isOnboardingComplete).toBe(true);
      expect(result.current.licenseInfo).toEqual(mockLicense);
    });
  });
});
