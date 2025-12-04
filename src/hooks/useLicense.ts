import { useCallback, useEffect, useRef, useState } from 'react';
import { LicenseInfo } from '../types/licensing';
import { getStorageItem, removeStorageItem, setStorageItem } from '../utils/storage';
import { validateLicenseWithLemon } from '../utils/lemonLicensingClient';
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
  licenseBootstrapComplete: boolean;
  isOnboardingComplete: boolean;
  setLicense: (info: LicenseInfo) => Promise<void>;
  resetLicense: () => Promise<void>;
}

export function useLicense(options: UseLicenseOptions): UseLicenseResult {
  const [licenseInfo, setLicenseInfo] = useState<LicenseInfo | null>(null);
  const [licenseBootstrapComplete, setLicenseBootstrapComplete] = useState(false);
  const [isOnboardingComplete, setIsOnboardingComplete] = useState(false);
  const [graceExpiresAt, setGraceExpiresAt] = useState<string | null>(null);

  // Use refs for callbacks to avoid re-running effects when options object changes
  const showToastRef = useRef(options.showToast);
  const onResetCompleteRef = useRef(options.onResetComplete);
  useEffect(() => {
    showToastRef.current = options.showToast;
    onResetCompleteRef.current = options.onResetComplete;
  }, [options.showToast, options.onResetComplete]);

  // Hydrate license on mount and validate with Lemon Squeezy
  useEffect(() => {
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

      // Validate required fields
      if (!storedLicense.licenseKey || !storedLicense.instanceId) {
        console.warn('Invalid stored license - missing required fields');
        await removeStorageItem('vinsly-license-info');
        if (!cancelled) {
          setLicenseInfo(null);
          setIsOnboardingComplete(false);
          setLicenseBootstrapComplete(true);
        }
        return;
      }

      try {
        // Validate with Lemon Squeezy
        const validation = await validateLicenseWithLemon(
          storedLicense.licenseKey,
          storedLicense.instanceId
        );

        if (!validation.valid || validation.status !== 'active') {
          // License is invalid or not active
          throw new Error(`License validation failed: ${validation.error || validation.status}`);
        }

        // Validation successful - clear any grace period and update license
        await removeStorageItem(GRACE_PERIOD_KEY);
        const refreshed: LicenseInfo = {
          ...storedLicense,
          status: 'active',
          lastChecked: new Date().toISOString(),
          // Update with latest data from Lemon Squeezy
          activationLimit: validation.licenseKey?.activation_limit ?? storedLicense.activationLimit,
          activationUsage: validation.licenseKey?.activation_usage ?? storedLicense.activationUsage,
        };
        await setStorageItem('vinsly-license-info', refreshed);

        if (!cancelled) {
          setLicenseInfo(refreshed);
          setIsOnboardingComplete(true);
          setGraceExpiresAt(null);
        }
      } catch (error) {
        console.error('License validation failed:', error);

        // Check if we're within grace period
        const storedGraceExpiry = await getStorageItem<string>(GRACE_PERIOD_KEY);
        const now = new Date();

        if (storedGraceExpiry) {
          // Grace period was already set - check if it's expired
          const expiryDate = new Date(storedGraceExpiry);

          if (now < expiryDate) {
            // Still within grace period - keep license active
            console.log('License validation failed but within grace period until:', expiryDate);
            if (!cancelled) {
              setLicenseInfo(storedLicense);
              setIsOnboardingComplete(true);
              setGraceExpiresAt(storedGraceExpiry);

              const daysRemaining = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
              showToastRef.current?.('info', `License validation failed. ${daysRemaining} day(s) remaining in grace period.`);
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
              showToastRef.current?.('error', 'License grace period expired. Please reactivate.');
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
            showToastRef.current?.('info', `License validation failed. Entering ${GRACE_PERIOD_DAYS}-day grace period.`);
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
  }, []); // Run only on mount - refs ensure latest callbacks are used

  const setLicense = useCallback(
    async (info: LicenseInfo) => {
      setLicenseInfo(info);
      setIsOnboardingComplete(true);
      await setStorageItem('vinsly-license-info', info);
      // Clear grace period when setting new license
      await removeStorageItem(GRACE_PERIOD_KEY);
      setGraceExpiresAt(null);
    },
    []
  );

  const resetLicense = useCallback(async () => {
    setLicenseInfo(null);
    setIsOnboardingComplete(false);
    setGraceExpiresAt(null);
    await removeStorageItem('vinsly-license-info');
    await removeStorageItem(GRACE_PERIOD_KEY);
    if (onResetCompleteRef.current) {
      await onResetCompleteRef.current();
    }
  }, []); // Uses ref for callback

  return {
    licenseInfo,
    licenseBootstrapComplete,
    isOnboardingComplete,
    setLicense,
    resetLicense,
  };
}
