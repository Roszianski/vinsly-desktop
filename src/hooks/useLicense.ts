import { useCallback, useEffect, useState } from 'react';
import { LicenseInfo } from '../types/licensing';
import { getStorageItem, removeStorageItem, setStorageItem } from '../utils/storage';
import { getOrCreateDeviceFingerprint } from '../utils/deviceFingerprint';
import { sendHeartbeat } from '../utils/licensingClient';
import { ToastType } from '../components/Toast';

export interface UseLicenseOptions {
  showToast: (type: ToastType, message: string) => void;
  platformIdentifier?: string;
  appVersion?: string;
  onResetComplete?: () => Promise<void> | void;
}

export interface UseLicenseResult {
  licenseInfo: LicenseInfo | null;
  deviceFingerprint: string | null;
  licenseBootstrapComplete: boolean;
  isOnboardingComplete: boolean;
  setLicense: (info: LicenseInfo) => Promise<void>;
  resetLicense: () => Promise<void>;
  ensureDeviceFingerprint: () => Promise<string | null>;
}

export function useLicense(options: UseLicenseOptions): UseLicenseResult {
  const [licenseInfo, setLicenseInfo] = useState<LicenseInfo | null>(null);
  const [deviceFingerprint, setDeviceFingerprint] = useState<string | null>(null);
  const [licenseBootstrapComplete, setLicenseBootstrapComplete] = useState(true);
  const [isOnboardingComplete, setIsOnboardingComplete] = useState(true);

  const ensureDeviceFingerprint = useCallback(async () => {
    if (deviceFingerprint) {
      return deviceFingerprint;
    }
    try {
      const fingerprint = await getOrCreateDeviceFingerprint();
      setDeviceFingerprint(fingerprint);
      return fingerprint;
    } catch (error) {
      console.error('Unable to initialize device fingerprint', error);
      return null;
    }
  }, [deviceFingerprint]);

  useEffect(() => {
    void ensureDeviceFingerprint();
  }, [ensureDeviceFingerprint]);

  useEffect(() => {
    if (!deviceFingerprint) {
      return;
    }
    let cancelled = false;

    const hydrateLicense = async () => {
      const storedLicense = await getStorageItem<LicenseInfo>('vinsly-license-info');
      if (!storedLicense) {
        if (!cancelled) {
          setLicenseInfo(null);
          setIsOnboardingComplete(false);
          setLicenseBootstrapComplete(true);
        }
        return;
      }

      if (!storedLicense.token || !storedLicense.deviceFingerprint) {
        await removeStorageItem('vinsly-license-info');
        if (!cancelled) {
          setLicenseInfo(null);
          setIsOnboardingComplete(false);
          setLicenseBootstrapComplete(true);
        }
        return;
      }

      if (storedLicense.deviceFingerprint !== deviceFingerprint) {
        await removeStorageItem('vinsly-license-info');
        if (!cancelled) {
          setLicenseInfo(null);
          setIsOnboardingComplete(false);
          setLicenseBootstrapComplete(true);
        }
        return;
      }

      try {
        await sendHeartbeat({
          token: storedLicense.token,
          deviceFingerprint,
          appVersion: options.appVersion || undefined,
        });
        const refreshed: LicenseInfo = {
          ...storedLicense,
          status: 'active',
          lastChecked: new Date().toISOString(),
        };
        await setStorageItem('vinsly-license-info', refreshed);
        if (!cancelled) {
          setLicenseInfo(refreshed);
          setIsOnboardingComplete(true);
        }
      } catch (error) {
        console.error('Heartbeat validation failed:', error);
        await removeStorageItem('vinsly-license-info');
        if (!cancelled) {
          setLicenseInfo(null);
          setIsOnboardingComplete(false);
          options.showToast?.('error', 'We need to verify your licence again.');
        }
      } finally {
        if (!cancelled) {
          setLicenseBootstrapComplete(true);
        }
      }
    };

    void hydrateLicense();

    return () => {
      cancelled = true;
    };
  }, [deviceFingerprint, options.appVersion, options.showToast]);

  const setLicense = useCallback(
    async (info: LicenseInfo) => {
      setLicenseInfo(info);
      setIsOnboardingComplete(true);
      await setStorageItem('vinsly-license-info', info);
    },
    []
  );

  const resetLicense = useCallback(async () => {
    setLicenseInfo(null);
    setIsOnboardingComplete(false);
    await removeStorageItem('vinsly-license-info');
    if (options.onResetComplete) {
      await options.onResetComplete();
    }
  }, [options]);

  return {
    licenseInfo,
    deviceFingerprint,
    licenseBootstrapComplete,
    isOnboardingComplete,
    setLicense,
    resetLicense,
    ensureDeviceFingerprint,
  };
}
