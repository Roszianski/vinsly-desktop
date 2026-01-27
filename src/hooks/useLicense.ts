import { useCallback, useEffect, useRef, useState } from 'react';
import { LicenseInfo } from '../types/licensing';
import { getStorageItem, removeStorageItem, setStorageItem } from '../utils/storage';
import { validateLicenseWithLemon, LemonLicenseValidationResult } from '../utils/lemonLicensingClient';
import { ToastType } from '../components/Toast';
import { devLog } from '../utils/devLogger';

// Grace period constants
const GRACE_PERIOD_KEY = 'vinsly-license-grace-expires';
const GRACE_PERIOD_DAYS = 7;

// Network error handling constants
const LAST_VALIDATED_KEY = 'vinsly-license-last-validated';
const SOFT_FAILURE_THRESHOLD_MS = 3 * 60 * 1000; // 3 minutes
const HARD_FAILURE_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours

// Helper to check if an error is a network/timeout error
function isNetworkError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return msg.includes('timeout') || msg.includes('network') || msg.includes('fetch');
  }
  return false;
}

// Helper to check if a validation response indicates a network error
function isNetworkValidationError(validation: LemonLicenseValidationResult): boolean {
  const error = validation.error?.toLowerCase() ?? '';
  return (
    error.includes('timeout') ||
    error.includes('network') ||
    error.includes('fetch') ||
    error.startsWith('server_error') ||
    error.startsWith('request_failed') ||
    error === 'tauri_invoke_failed'
  );
}

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
        devLog.warn('Invalid stored license - missing required fields');
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

        const statusLower = validation.status?.toLowerCase();
        const isBadStatus = statusLower === 'revoked' || statusLower === 'expired' || statusLower === 'disabled';

        if (!validation.valid || isBadStatus) {
          // Check if this is a network error rather than an actual license issue
          if (isNetworkValidationError(validation)) {
            throw new Error(`Network error during validation: ${validation.error}`);
          }
          // License is actually invalid or not active
          throw new Error(`License validation failed: ${validation.error || validation.status}`);
        }

        // Validation successful - clear any grace period and update license
        await removeStorageItem(GRACE_PERIOD_KEY);
        const now = new Date().toISOString();
        const refreshed: LicenseInfo = {
          ...storedLicense,
          status: 'active',
          lastChecked: now,
          lastValidated: now, // Track successful API validation
          // Update with latest data from Lemon Squeezy
          activationLimit: validation.licenseKey?.activation_limit ?? storedLicense.activationLimit,
          activationUsage: validation.licenseKey?.activation_usage ?? storedLicense.activationUsage,
        };
        await setStorageItem('vinsly-license-info', refreshed);
        await setStorageItem(LAST_VALIDATED_KEY, now);

        if (!cancelled) {
          setLicenseInfo(refreshed);
          setIsOnboardingComplete(true);
          setGraceExpiresAt(null);
        }
      } catch (error) {
        devLog.error('License validation failed:', error);

        const now = new Date();
        const networkError = isNetworkError(error);

        // If it's a network error, check when we last successfully validated
        if (networkError) {
          const lastValidatedStr = await getStorageItem<string>(LAST_VALIDATED_KEY);
          if (lastValidatedStr) {
            const lastValidated = new Date(lastValidatedStr);
            const timeSinceValidation = now.getTime() - lastValidated.getTime();

            if (timeSinceValidation < SOFT_FAILURE_THRESHOLD_MS) {
              // Recently validated (< 3 min) - silently continue without any toast
              devLog.log('Network error but recently validated, continuing silently');
              if (!cancelled) {
                setLicenseInfo(storedLicense);
                setIsOnboardingComplete(true);
              }
              return;
            }

            if (timeSinceValidation < HARD_FAILURE_THRESHOLD_MS) {
              // Validated within 24 hours - show info toast but don't enter grace period
              devLog.log('Network error but validated within 24h, showing info toast');
              if (!cancelled) {
                setLicenseInfo(storedLicense);
                setIsOnboardingComplete(true);
                showToastRef.current?.('info', 'Unable to verify license. Will retry later.');
              }
              return;
            }
          }
          // No recent validation or > 24 hours - fall through to grace period logic
          devLog.warn('Network error with stale or no previous validation, entering grace period');
        }

        // Check if we're within grace period
        const storedGraceExpiry = await getStorageItem<string>(GRACE_PERIOD_KEY);

        if (storedGraceExpiry) {
          // Grace period was already set - check if it's expired
          const expiryDate = new Date(storedGraceExpiry);

          if (now < expiryDate) {
            // Still within grace period - keep license active
            if (!cancelled) {
              setLicenseInfo(storedLicense);
              setIsOnboardingComplete(true);
              setGraceExpiresAt(storedGraceExpiry);

              const daysRemaining = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
              showToastRef.current?.('info', `License validation failed. ${daysRemaining} day(s) remaining in grace period.`);
            }
          } else {
            if (networkError) {
              // Grace period expired, but we still can't validate due to network/internal issues.
              // Keep the stored license and extend the grace period so users aren't forced to re-activate
              // during outages or app-side regressions.
              const extendedExpiry = new Date(now.getTime() + (GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000));
              const extendedExpiryISO = extendedExpiry.toISOString();
              await setStorageItem(GRACE_PERIOD_KEY, extendedExpiryISO);

              if (!cancelled) {
                setLicenseInfo(storedLicense);
                setIsOnboardingComplete(true);
                setGraceExpiresAt(extendedExpiryISO);
                showToastRef.current?.('info', 'Unable to verify license right now. Please check your connection and try again later.');
              }
            } else {
              // Grace period expired - remove license
              await removeStorageItem('vinsly-license-info');
              await removeStorageItem(GRACE_PERIOD_KEY);
              await removeStorageItem(LAST_VALIDATED_KEY);

              if (!cancelled) {
                setLicenseInfo(null);
                setIsOnboardingComplete(false);
                setGraceExpiresAt(null);
                showToastRef.current?.('error', 'License grace period expired. Please reactivate.');
              }
            }
          }
        } else {
          // No grace period set yet - start a new one
          const graceExpiry = new Date(now.getTime() + (GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000));
          const graceExpiryISO = graceExpiry.toISOString();
          await setStorageItem(GRACE_PERIOD_KEY, graceExpiryISO);

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
    await removeStorageItem(LAST_VALIDATED_KEY);
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
