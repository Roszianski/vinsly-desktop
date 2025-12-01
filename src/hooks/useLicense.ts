import { useCallback, useEffect, useState } from 'react';
import { LicenseInfo } from '../types/licensing';
import { getStorageItem, removeStorageItem, setStorageItem } from '../utils/storage';
import { getOrCreateDeviceFingerprint } from '../utils/deviceFingerprint';
import { sendHeartbeat } from '../utils/licensingClient';
import { ToastType } from '../components/Toast';

// Grace period constants
const GRACE_PERIOD_KEY = 'vinsly-license-grace-expires';
const GRACE_PERIOD_DAYS = 7;

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
  const [licenseBootstrapComplete, setLicenseBootstrapComplete] = useState(false);
  const [isOnboardingComplete, setIsOnboardingComplete] = useState(false);
  const [graceExpiresAt, setGraceExpiresAt] = useState<string | null>(null);

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

        // Heartbeat successful - clear any grace period and update license
        await removeStorageItem(GRACE_PERIOD_KEY);
        const refreshed: LicenseInfo = {
          ...storedLicense,
          status: 'active',
          lastChecked: new Date().toISOString(),
        };
        await setStorageItem('vinsly-license-info', refreshed);

        if (!cancelled) {
          setLicenseInfo(refreshed);
          setIsOnboardingComplete(true);
          setGraceExpiresAt(null);
        }
      } catch (error) {
        console.error('Heartbeat validation failed:', error);

        // Check if we're within grace period
        const storedGraceExpiry = await getStorageItem<string>(GRACE_PERIOD_KEY);
        const now = new Date();

        if (storedGraceExpiry) {
          // Grace period was already set - check if it's expired
          const expiryDate = new Date(storedGraceExpiry);

          if (now < expiryDate) {
            // Still within grace period - keep license active
            console.log('License heartbeat failed but within grace period until:', expiryDate);
            if (!cancelled) {
              setLicenseInfo(storedLicense);
              setIsOnboardingComplete(true);
              setGraceExpiresAt(storedGraceExpiry);

              const daysRemaining = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
              options.showToast?.('info', `License validation failed. You have ${daysRemaining} day(s) remaining in grace period.`);
            }
          } else {
            // Grace period expired - remove license
            console.log('License grace period expired');
            await removeStorageItem('vinsly-license-info');
            await removeStorageItem(GRACE_PERIOD_KEY);

            if (!cancelled) {
              setLicenseInfo(null);
              setIsOnboardingComplete(false);
              setGraceExpiresAt(null);
              options.showToast?.('error', 'License validation failed and grace period expired. Please reactivate.');
            }
          }
        } else {
          // No grace period set yet - start a new one
          const graceExpiry = new Date(now.getTime() + (GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000));
          const graceExpiryISO = graceExpiry.toISOString();
          await setStorageItem(GRACE_PERIOD_KEY, graceExpiryISO);

          console.log('Starting license grace period until:', graceExpiry);
          if (!cancelled) {
            setLicenseInfo(storedLicense);
            setIsOnboardingComplete(true);
            setGraceExpiresAt(graceExpiryISO);
            options.showToast?.('info', `License validation failed. Entering ${GRACE_PERIOD_DAYS}-day grace period.`);
          }
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
    setGraceExpiresAt(null);
    await removeStorageItem('vinsly-license-info');
    await removeStorageItem(GRACE_PERIOD_KEY);
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
