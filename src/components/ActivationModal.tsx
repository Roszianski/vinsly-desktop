import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { checkFullDiskAccess, openFullDiskAccessSettings } from '../utils/tauriCommands';
import { devLog } from '../utils/devLogger';

// Key for saving activation progress (survives app restart)
const ACTIVATION_PROGRESS_KEY = 'vinsly-activation-progress';

interface SavedActivationProgress {
  step: Step;
  licenseKey: string;
  displayName: string;
  autoScanGlobal: boolean;
  autoScanWatched: boolean;
}

interface ActivationModalProps {
  isOpen: boolean;
  defaultDisplayName?: string;
  defaultScanGlobal?: boolean;
  defaultScanWatched?: boolean;
  defaultScanHome?: boolean;
  defaultFullDiskAccess?: boolean;
  isMacPlatform?: boolean;
  macOSVersionMajor?: number | null;
  onValidateLicense?: (payload: { licenseKey: string }) => Promise<void>;
  onComplete: (payload: {
    licenseKey: string;
    displayName: string;
    autoScanGlobal: boolean;
    autoScanWatched: boolean;
    autoScanHome: boolean;
    fullDiskAccessEnabled: boolean;
  }) => Promise<void> | void;
  onClose: () => void;
}

type Step = 'license' | 'profile' | 'scanning';

export const ActivationModal: React.FC<ActivationModalProps> = ({
  isOpen,
  defaultDisplayName = '',
  defaultScanGlobal = true,
  defaultScanWatched = true,
  defaultScanHome = false,
  defaultFullDiskAccess = false,
  isMacPlatform = false,
  macOSVersionMajor = null,
  onValidateLicense,
  onComplete,
  onClose
}) => {
  const [step, setStep] = useState<Step>('license');
  const [licenseKey, setLicenseKey] = useState('');
  const [displayName, setDisplayName] = useState(defaultDisplayName);
  const [autoScanGlobal, setAutoScanGlobal] = useState(defaultScanGlobal);
  const [autoScanWatched, setAutoScanWatched] = useState(defaultScanWatched);
  const [autoScanHome, setAutoScanHome] = useState(defaultScanHome);
  const [fullDiskAccessEnabled, setFullDiskAccessEnabled] = useState(defaultFullDiskAccess);
  const [fullDiskStatus, setFullDiskStatus] = useState<'unknown' | 'checking' | 'granted' | 'denied'>('unknown');
  const [isOpeningFullDiskSettings, setIsOpeningFullDiskSettings] = useState(false);
  const [fullDiskStatusMessage, setFullDiskStatusMessage] = useState<{ tone: 'info' | 'warn'; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [validationState, setValidationState] = useState<'idle' | 'validating' | 'success'>('idle');
  const [licenseStepError, setLicenseStepError] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ licenseKey?: string; displayName?: string }>({});
  const [showFdaGuide, setShowFdaGuide] = useState(false);
  const validationSuccessTimer = useRef<number | null>(null);
  const wasOpenRef = useRef(false);
  const postGrantCheckTimeoutRef = useRef<number | null>(null);
  const progressRestoredRef = useRef(false);

  // Save activation progress to localStorage (survives app restart)
  const saveProgress = useCallback(() => {
    const progress: SavedActivationProgress = {
      step,
      licenseKey,
      displayName,
      autoScanGlobal,
      autoScanWatched,
    };
    localStorage.setItem(ACTIVATION_PROGRESS_KEY, JSON.stringify(progress));
  }, [step, licenseKey, displayName, autoScanGlobal, autoScanWatched]);

  // Clear saved progress
  const clearProgress = useCallback(() => {
    localStorage.removeItem(ACTIVATION_PROGRESS_KEY);
  }, []);

  // Restore progress from localStorage on mount
  useEffect(() => {
    if (isOpen && !progressRestoredRef.current) {
      progressRestoredRef.current = true;
      try {
        const saved = localStorage.getItem(ACTIVATION_PROGRESS_KEY);
        if (saved) {
          const progress: SavedActivationProgress = JSON.parse(saved);
          if (progress.step && progress.licenseKey) {
            setStep(progress.step);
            setLicenseKey(progress.licenseKey);
            setDisplayName(progress.displayName || defaultDisplayName);
            setAutoScanGlobal(progress.autoScanGlobal ?? defaultScanGlobal);
            setAutoScanWatched(progress.autoScanWatched ?? defaultScanWatched);
            // Mark validation as already done since license was saved
            setValidationState('success');
            devLog.log('Restored activation progress:', progress.step);
          }
        }
      } catch (err) {
        devLog.error('Failed to restore activation progress:', err);
      }
    }
  }, [isOpen, defaultDisplayName, defaultScanGlobal, defaultScanWatched]);

  const resetFormState = useCallback(() => {
    // Don't reset if we just restored progress
    if (progressRestoredRef.current && localStorage.getItem(ACTIVATION_PROGRESS_KEY)) {
      return;
    }
    setStep('license');
    setLicenseKey('');
    setDisplayName(defaultDisplayName);
    setErrors({});
    setAutoScanGlobal(defaultScanGlobal);
    setAutoScanWatched(defaultScanWatched);
    setAutoScanHome(defaultScanHome);
    setFullDiskAccessEnabled(defaultFullDiskAccess);
    setFullDiskStatus('unknown');
    setFullDiskStatusMessage(null);
    setIsOpeningFullDiskSettings(false);
    setIsSubmitting(false);
    setSubmitError(null);
    setValidationState('idle');
    setLicenseStepError(null);
    setShowFdaGuide(false);
    if (validationSuccessTimer.current) {
      window.clearTimeout(validationSuccessTimer.current);
      validationSuccessTimer.current = null;
    }
  }, [defaultDisplayName, defaultScanGlobal, defaultScanWatched, defaultScanHome, defaultFullDiskAccess]);

  const refreshFullDiskStatus = useCallback(async () => {
    if (!isMacPlatform) {
      setFullDiskStatus('granted');
      setFullDiskStatusMessage(null);
      return;
    }
    setFullDiskStatus('checking');
    setFullDiskStatusMessage(null);
    try {
      const granted = await checkFullDiskAccess();
      setFullDiskStatus(granted ? 'granted' : 'denied');
      if (!granted) {
        setFullDiskAccessEnabled(false);
        setFullDiskStatusMessage({
          tone: 'warn',
          text: 'Access not granted. Grant permission or use watched folders instead.',
        });
      } else {
        setFullDiskStatusMessage(null);
      }
    } catch (error) {
      devLog.error('Failed to check full disk access:', error);
      setFullDiskStatus('denied');
      setFullDiskStatusMessage({
        tone: 'warn',
        text: 'Unable to verify Full Disk Access right now. Try again or keep using watched folders.',
      });
    }
  }, [isMacPlatform]);

  useEffect(() => {
    if (!isOpen) {
      resetFormState();
    }
  }, [isOpen, resetFormState]);

  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      resetFormState();
    }
    wasOpenRef.current = isOpen;
  }, [isOpen, resetFormState]);

  useEffect(() => {
    if (isOpen) {
      void refreshFullDiskStatus();
    }
  }, [isOpen, refreshFullDiskStatus]);

  const handleOpenFullDiskSettings = useCallback(async () => {
    if (!isMacPlatform) {
      setFullDiskStatusMessage({
        tone: 'info',
        text: 'Full Disk Access is a macOS-only permission. You can continue without granting it.',
      });
      return;
    }
    // Save progress before showing guide (user may restart app)
    saveProgress();
    // Show the two-step guide popup
    setShowFdaGuide(true);
  }, [isMacPlatform, saveProgress]);

  const handleFdaGuideOpenSettings = useCallback(async () => {
    setIsOpeningFullDiskSettings(true);
    try {
      await openFullDiskAccessSettings();
    } catch (error) {
      devLog.error('Failed to open Full Disk Access settings:', error);
    } finally {
      setIsOpeningFullDiskSettings(false);
    }
  }, []);

  const handleFdaGuideClose = useCallback(() => {
    setShowFdaGuide(false);
    // Check FDA status after closing guide
    void refreshFullDiskStatus();
  }, [refreshFullDiskStatus]);

  useEffect(() => {
    return () => {
      if (validationSuccessTimer.current) {
        window.clearTimeout(validationSuccessTimer.current);
      }
      if (postGrantCheckTimeoutRef.current) {
        window.clearTimeout(postGrantCheckTimeoutRef.current);
      }
    };
  }, []);

  const validateLicenseStep = () => {
    const nextErrors: typeof errors = {};
    if (!licenseKey.trim()) {
      nextErrors.licenseKey = 'Please enter your licence key';
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const validateProfileStep = () => {
    const nextErrors: typeof errors = {};
    if (!displayName.trim()) {
      nextErrors.displayName = 'Display name required';
    } else if (displayName.trim().length < 3) {
      nextErrors.displayName = 'Use at least 3 characters';
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleLicenseSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (validationState === 'validating' || validationState === 'success') return;

    setLicenseStepError(null);

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setLicenseStepError('Please switch your Wi-Fi on so we can validate your licence key.');
      return;
    }

    if (!validateLicenseStep()) {
      return;
    }

    const proceedToProfile = () => {
      if (validationSuccessTimer.current) {
        window.clearTimeout(validationSuccessTimer.current);
      }
      validationSuccessTimer.current = window.setTimeout(() => {
        setValidationState('idle');
        setStep('profile');
        setErrors({});
      }, 1200);
    };

    if (onValidateLicense) {
      try {
        setValidationState('validating');
        await onValidateLicense({
          licenseKey: licenseKey.trim(),
        });
        setValidationState('success');
        proceedToProfile();
      } catch (error) {
        devLog.error('Licence validation failed:', error);
        setLicenseStepError('Something went wrong while validating your licence. Please try again.');
        setValidationState('idle');
        return;
      }
    } else {
      setValidationState('success');
      proceedToProfile();
    }
  };

  const handleProfileSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (validateProfileStep()) {
      setStep('scanning');
      setErrors({});
    }
  };

  const handleScanningSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void handleCompletionSubmit();
  };

  const handleCompletionSubmit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await onComplete({
        licenseKey: licenseKey.trim(),
        displayName: displayName.trim(),
        autoScanGlobal,
        autoScanWatched,
        autoScanHome,
        fullDiskAccessEnabled: isMacPlatform ? (fullDiskAccessEnabled && fullDiskStatus === 'granted') : true,
      });
      // Clear saved progress on successful completion
      clearProgress();
    } catch (error) {
      devLog.error('Activation completion failed:', error);
      const message = error instanceof Error && error.message
        ? error.message
        : 'Something went wrong while setting up. Please try again.';
      setSubmitError(message);
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const steps: Step[] = ['license', 'profile', 'scanning'];
  const currentIndex = steps.indexOf(step);
  const isLicenseButtonBusy = validationState === 'validating' || validationState === 'success';

  return (
    <AnimatePresence>
      <motion.div
        key="activation-modal"
        className="fixed inset-0 z-[11000] flex items-center justify-center bg-black/40 px-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="w-full max-w-xl bg-v-light-surface dark:bg-v-mid-dark rounded-2xl shadow-2xl border border-v-light-border dark:border-v-border overflow-hidden"
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2 }}
        >
          <div className="px-6 py-5 border-b border-v-light-border dark:border-v-border flex items-center justify-between bg-v-light-bg/60 dark:bg-v-dark/60">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-v-light-text-secondary dark:text-v-text-secondary">Welcome to</p>
              <h2 className="text-2xl font-semibold text-v-light-text-primary dark:text-v-text-primary">VINSLY</h2>
            </div>
          </div>

          <div className="px-6 py-6 space-y-6">
            <div className="flex items-center gap-3 text-sm font-medium text-v-light-text-secondary dark:text-v-text-secondary">
              {steps.map((_, idx) => (
                <div
                  key={`step-${idx}`}
                  className={`flex-1 h-1 rounded-full ${idx <= currentIndex ? 'bg-v-accent' : 'bg-v-light-border dark:bg-v-border'}`}
                />
              ))}
            </div>

            {step === 'license' ? (
              <form className="space-y-5" onSubmit={handleLicenseSubmit}>
                <div>
                  <label className="block text-sm font-semibold text-v-light-text-primary dark:text-v-text-primary mb-2">
                    Licence key
                  </label>
                  <input
                    type="text"
                    value={licenseKey}
                    onChange={(event) => setLicenseKey(event.target.value)}
                    placeholder="XXXX-XXXX-XXXX-XXXX"
                    disabled={isLicenseButtonBusy}
                    className={`w-full px-4 py-3 rounded-xl border bg-transparent text-v-light-text-primary dark:text-v-text-primary focus-visible:outline-none focus:ring-2 focus:ring-v-accent ${
                      errors.licenseKey ? 'border-red-400' : 'border-v-light-border dark:border-v-border'
                    }`}
                  />
                  {errors.licenseKey && (
                    <p className="text-xs text-red-500 mt-1">{errors.licenseKey}</p>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={isLicenseButtonBusy}
                  className="w-full py-3 rounded-xl text-white font-semibold transition-colors flex items-center justify-center gap-2 bg-v-accent hover:bg-v-accent-hover disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {validationState === 'validating' && (
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        strokeDasharray="60"
                        strokeDashoffset="20"
                        strokeLinecap="round"
                      />
                    </svg>
                  )}
                  {validationState === 'success' ? (
                    <>
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none">
                        <path
                          d="M5 13l4 4L19 7"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      Validated
                    </>
                  ) : (
                    <>
                      {validationState === 'validating' ? 'Validating…' : 'Validate licence'}
                    </>
                  )}
                </button>
                <p className="text-xs text-v-light-text-secondary dark:text-v-text-secondary text-center">
                  We&apos;ll store your licence securely on this device and validate it with the Vinsly licence server.
                </p>
                {licenseStepError && (
                  <p className="text-xs text-red-500 mt-2 text-center">
                    {licenseStepError}
                  </p>
                )}
              </form>
            ) : step === 'profile' ? (
              <form className="space-y-5" onSubmit={handleProfileSubmit}>
                <div>
                  <label className="block text-sm font-semibold text-v-light-text-primary dark:text-v-text-primary mb-2">
                    Display name
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    placeholder="e.g. Alex"
                    className={`w-full px-4 py-3 rounded-xl border bg-transparent text-v-light-text-primary dark:text-v-text-primary focus-visible:outline-none focus:ring-2 focus:ring-v-accent ${
                      errors.displayName ? 'border-red-400' : 'border-v-light-border dark:border-v-border'
                    }`}
                  />
                  {errors.displayName && (
                    <p className="text-xs text-red-500 mt-1">{errors.displayName}</p>
                  )}
                </div>
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setStep('license')}
                    className="px-4 py-3 rounded-xl border border-v-light-border dark:border-v-border text-sm font-medium text-v-light-text-secondary dark:text-v-text-secondary hover:border-v-accent hover:text-v-light-text-primary dark:hover:text-v-text-primary transition-colors"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 rounded-xl bg-v-accent text-white font-semibold hover:bg-v-accent-hover transition-colors"
                  >
                    Continue
                  </button>
                </div>
              </form>
            ) : step === 'scanning' ? (
              <form className="space-y-5" onSubmit={handleScanningSubmit}>
                <div>
                  <p className="text-sm font-semibold text-v-light-text-primary dark:text-v-text-primary mb-1">
                    Auto-scan on startup
                  </p>
                  <p className="text-xs text-v-light-text-secondary dark:text-v-text-secondary mb-3">
                    These are optional. You can always scan manually once you're in the app.
                  </p>
                  <div className="space-y-3">
                    {/* Global resources */}
                    <label className={`flex items-center gap-3 p-3 bg-v-light-bg dark:bg-v-dark rounded-xl border border-v-light-border dark:border-v-border cursor-pointer hover:border-v-accent transition-colors ${isSubmitting ? 'opacity-70 pointer-events-none' : ''}`}>
                      <input
                        type="checkbox"
                        checked={autoScanGlobal}
                        onChange={(e) => setAutoScanGlobal(e.target.checked)}
                        disabled={isSubmitting}
                        className="w-4 h-4 rounded border-v-light-border dark:border-v-border text-v-accent focus:ring-v-accent focus:ring-offset-0"
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-v-light-text-primary dark:text-v-text-primary">Global resources</p>
                        <p className="text-xs text-v-light-text-secondary dark:text-v-text-secondary">~/.claude</p>
                      </div>
                    </label>

                    {/* Watched folders */}
                    <label className={`flex items-center gap-3 p-3 bg-v-light-bg dark:bg-v-dark rounded-xl border border-v-light-border dark:border-v-border cursor-pointer hover:border-v-accent transition-colors ${isSubmitting ? 'opacity-70 pointer-events-none' : ''}`}>
                      <input
                        type="checkbox"
                        checked={autoScanWatched}
                        onChange={(e) => setAutoScanWatched(e.target.checked)}
                        disabled={isSubmitting}
                        className="w-4 h-4 rounded border-v-light-border dark:border-v-border text-v-accent focus:ring-v-accent focus:ring-offset-0"
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-v-light-text-primary dark:text-v-text-primary">Watched folders</p>
                        <p className="text-xs text-v-light-text-secondary dark:text-v-text-secondary">Configured in settings</p>
                      </div>
                    </label>

                    {/* FDA tip for macOS users */}
                    {isMacPlatform && (
                      <p className="text-xs text-v-light-text-secondary dark:text-v-text-secondary px-3 py-2 border border-dashed border-v-light-border dark:border-v-border rounded-xl">
                        Tip: To scan your entire home directory, enable Full Disk Access in Vinsly's Permissions settings.
                      </p>
                    )}
                  </div>
                </div>

                {submitError && (
                  <p className="text-sm text-red-500" role="alert">
                    {submitError}
                  </p>
                )}

                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setStep('profile')}
                    disabled={isSubmitting}
                    className="px-4 py-3 rounded-xl border border-v-light-border dark:border-v-border text-sm font-medium text-v-light-text-secondary dark:text-v-text-secondary hover:border-v-accent hover:text-v-light-text-primary dark:hover:text-v-text-primary transition-colors disabled:opacity-60"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-3 rounded-xl bg-v-accent text-white font-semibold hover:bg-v-accent-hover transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {isSubmitting ? 'Setting up…' : 'Enter Vinsly'}
                  </button>
                </div>
              </form>
            ) : null}
          </div>
        </motion.div>
      </motion.div>

      {/* FDA Guide Popup */}
      {showFdaGuide && (
        <motion.div
          key="fda-guide"
          className="fixed inset-0 z-[12000] flex items-center justify-center bg-black/60 px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="w-full max-w-md bg-v-light-surface dark:bg-v-mid-dark rounded-2xl shadow-2xl border border-v-light-border dark:border-v-border overflow-hidden"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
          >
            <div className="px-6 py-5 border-b border-v-light-border dark:border-v-border">
              <h3 className="text-lg font-semibold text-v-light-text-primary dark:text-v-text-primary">
                Enable Full Disk Access
              </h3>
            </div>

            <div className="px-6 py-6 space-y-5">
              {/* Step 1 */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-v-accent text-white text-xs font-bold">1</span>
                  <p className="text-sm font-semibold text-v-light-text-primary dark:text-v-text-primary">
                    Grant Permission
                  </p>
                </div>
                <p className="text-xs text-v-light-text-secondary dark:text-v-text-secondary ml-8">
                  Click below to open System Settings. Find <strong>Full Disk Access</strong> and enable Vinsly.
                </p>
                <button
                  type="button"
                  onClick={() => void handleFdaGuideOpenSettings()}
                  disabled={isOpeningFullDiskSettings}
                  className="ml-8 px-4 py-2 rounded-lg bg-v-accent text-white text-sm font-medium hover:bg-v-accent-hover transition-colors disabled:opacity-60"
                >
                  {isOpeningFullDiskSettings ? 'Opening…' : 'Open System Settings'}
                </button>
              </div>

              {/* Step 2 */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-v-light-border dark:bg-v-border text-v-light-text-secondary dark:text-v-text-secondary text-xs font-bold">2</span>
                  <p className="text-sm font-semibold text-v-light-text-primary dark:text-v-text-primary">
                    Restart Vinsly
                  </p>
                </div>
                <p className="text-xs text-v-light-text-secondary dark:text-v-text-secondary ml-8">
                  After granting access, <strong>quit and reopen Vinsly</strong>. Your progress is saved and you&apos;ll continue from here.
                </p>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-v-light-border dark:border-v-border flex justify-end gap-3">
              <button
                type="button"
                onClick={handleFdaGuideClose}
                className="px-4 py-2 rounded-lg border border-v-light-border dark:border-v-border text-sm font-medium text-v-light-text-secondary dark:text-v-text-secondary hover:border-v-accent hover:text-v-light-text-primary dark:hover:text-v-text-primary transition-colors"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ActivationModal;
