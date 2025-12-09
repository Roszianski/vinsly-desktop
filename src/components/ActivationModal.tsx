import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { checkFullDiskAccess, openFullDiskAccessSettings } from '../utils/tauriCommands';

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

type Step = 'license' | 'profile' | 'scanning' | 'permissions';

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
  const validationSuccessTimer = useRef<number | null>(null);
  const wasOpenRef = useRef(false);
  const postGrantCheckTimeoutRef = useRef<number | null>(null);
  const [showSequoiaTip, setShowSequoiaTip] = useState(false);
  const isSequoiaOrNewer = isMacPlatform && typeof macOSVersionMajor === 'number' && macOSVersionMajor >= 15;

  const resetFormState = useCallback(() => {
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
      console.error('Failed to check full disk access:', error);
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
    setIsOpeningFullDiskSettings(true);
    setFullDiskStatusMessage(null);
    try {
      await openFullDiskAccessSettings();
      setFullDiskStatusMessage({
        tone: 'info',
        text: 'System Settings opened. In Privacy & Security → Full Disk Access (HT210595), add or enable Vinsly, then click “Check again”.',
      });
      if (postGrantCheckTimeoutRef.current) {
        window.clearTimeout(postGrantCheckTimeoutRef.current);
      }
      postGrantCheckTimeoutRef.current = window.setTimeout(() => {
        void refreshFullDiskStatus();
        postGrantCheckTimeoutRef.current = null;
      }, 2500);
    } catch (error) {
      console.error('Failed to open Full Disk Access settings:', error);
      const details = error instanceof Error ? error.message : String(error);
      setFullDiskStatusMessage({
        tone: 'warn',
        text: `Unable to open System Settings automatically (${details}). Please open Privacy & Security → Full Disk Access manually.`,
      });
    } finally {
      setIsOpeningFullDiskSettings(false);
    }
  }, [isMacPlatform]);

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
        console.error('Licence validation failed:', error);
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
    if (isMacPlatform) {
      setStep('permissions');
    } else {
      void handleCompletionSubmit();
    }
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
    } catch (error) {
      console.error('Activation completion failed:', error);
      const message = error instanceof Error && error.message
        ? error.message
        : 'Something went wrong while setting up. Please try again.';
      setSubmitError(message);
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const steps: Step[] = isMacPlatform
    ? ['license', 'profile', 'scanning', 'permissions']
    : ['license', 'profile', 'scanning'];
  const currentIndex = steps.indexOf(step);
  const isLicenseButtonBusy = validationState === 'validating' || validationState === 'success';
  const fullDiskStatusLabel =
    fullDiskStatus === 'granted'
      ? 'Granted'
      : fullDiskStatus === 'checking'
        ? 'Checking…'
        : fullDiskStatus === 'denied'
          ? 'Not granted'
          : 'Not checked';
  const fullDiskStatusTone =
    fullDiskStatus === 'granted'
      ? 'bg-green-500/10 text-green-500 dark:text-green-400'
      : fullDiskStatus === 'checking'
        ? 'bg-v-light-border/60 dark:bg-v-border/40 text-v-light-text-secondary dark:text-v-text-secondary'
        : 'bg-amber-500/10 text-amber-600 dark:text-amber-300';
  const isFullDiskToggleDisabled = isMacPlatform && fullDiskStatus !== 'granted';
  const fullDiskMessageClass =
    fullDiskStatusMessage?.tone === 'warn'
      ? 'text-amber-600 dark:text-amber-300'
      : 'text-v-light-text-secondary dark:text-v-text-secondary';

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
                  <p className="text-sm font-semibold text-v-light-text-primary dark:text-v-text-primary mb-3">
                    Auto-scan on startup
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

                    {/* Home directory */}
                    <label className={`flex items-center gap-3 p-3 bg-v-light-bg dark:bg-v-dark rounded-xl border border-v-light-border dark:border-v-border cursor-pointer hover:border-v-accent transition-colors ${isSubmitting ? 'opacity-70 pointer-events-none' : ''}`}>
                      <input
                        type="checkbox"
                        checked={autoScanHome}
                        onChange={(e) => setAutoScanHome(e.target.checked)}
                        disabled={isSubmitting}
                        className="w-4 h-4 rounded border-v-light-border dark:border-v-border text-v-accent focus:ring-v-accent focus:ring-offset-0"
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-v-light-text-primary dark:text-v-text-primary">Home directory</p>
                        <p className="text-xs text-v-light-text-secondary dark:text-v-text-secondary">
                          {isMacPlatform ? 'Requires Full Disk Access' : 'Scan entire home folder'}
                        </p>
                      </div>
                    </label>
                  </div>
                </div>

                {!isMacPlatform && submitError && (
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
                    {isMacPlatform ? 'Continue' : isSubmitting ? 'Setting up…' : 'Enter Vinsly'}
                  </button>
                </div>
              </form>
            ) : (
              <form className="space-y-5" onSubmit={handleCompletionSubmit}>
                <div className="space-y-4">
                  <div className={`p-4 border border-v-light-border dark:border-v-border rounded-xl bg-v-light-bg/60 dark:bg-v-dark/60 space-y-3 ${isSubmitting ? 'opacity-70' : ''}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-v-light-text-primary dark:text-v-text-primary">
                          Full Disk Access (recommended)
                        </p>
                        <p className="text-xs text-v-light-text-secondary dark:text-v-text-secondary mt-1">
                          Enables scanning Desktop, Documents, and other protected folders.
                        </p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${fullDiskStatusTone}`}>
                        {fullDiskStatusLabel}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void handleOpenFullDiskSettings()}
                        disabled={isOpeningFullDiskSettings || isSubmitting}
                        className="px-4 py-2 rounded-lg text-sm font-medium bg-v-accent text-white hover:bg-v-accent-hover disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                      >
                        {isOpeningFullDiskSettings ? 'Opening…' : 'Grant Access'}
                      </button>
                    </div>
                    <div className="flex items-center justify-between gap-3 border-t border-dashed border-v-light-border dark:border-v-border pt-3">
                      <p className="text-xs font-medium text-v-light-text-primary dark:text-v-text-primary">
                        Use Full Disk Access for home scans
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          if (!isFullDiskToggleDisabled && !isSubmitting) {
                            setFullDiskAccessEnabled(prev => !prev);
                          }
                        }}
                        disabled={isSubmitting || isFullDiskToggleDisabled}
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-v-accent ${
                          fullDiskAccessEnabled && !isFullDiskToggleDisabled ? 'bg-v-accent' : 'bg-v-light-border dark:bg-v-border'
                        } ${isSubmitting || isFullDiskToggleDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                        role="switch"
                        aria-checked={fullDiskAccessEnabled && !isFullDiskToggleDisabled}
                        aria-disabled={isSubmitting || isFullDiskToggleDisabled}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
                            fullDiskAccessEnabled && !isFullDiskToggleDisabled ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                    {fullDiskStatus !== 'granted' && (
                      <p className="text-xs text-amber-600 dark:text-amber-300">
                        System Settings → Privacy &amp; Security → Full Disk Access
                      </p>
                    )}
                    {fullDiskStatusMessage && (
                      <p className={`text-xs ${fullDiskMessageClass}`}>
                        {fullDiskStatusMessage.text}
                      </p>
                    )}
                    {isSequoiaOrNewer && (
                      <div className="text-xs text-v-light-text-secondary dark:text-v-text-secondary border border-dashed border-v-light-border dark:border-v-border rounded-lg p-3 bg-v-light-bg/40 dark:bg-v-dark/40">
                        <button
                          type="button"
                          onClick={() => setShowSequoiaTip(prev => !prev)}
                          className="font-semibold text-v-accent hover:text-v-accent-hover"
                        >
                          Having trouble on macOS 15 (Sequoia)?
                        </button>
                        {showSequoiaTip && (
                          <p className="mt-2">
                            Apple’s beta can hide helper binaries in the Full Disk Access list. Even if Vinsly isn’t visible, the entitlement still works once granted. Click “Check status” here to confirm.
                          </p>
                        )}
                      </div>
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
                    onClick={() => !isSubmitting && setStep('scanning')}
                    disabled={isSubmitting}
                    className="px-4 py-3 rounded-xl border border-v-light-border dark:border-v-border text-sm font-medium text-v-light-text-secondary dark:text-v-text-secondary hover:border-v-accent hover:text-v-light-text-primary dark:hover:text-v-text-primary transition-colors disabled:opacity-60"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-3 rounded-xl bg-v-accent text-white font-semibold hover:bg-v-accent-hover transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                    aria-busy={isSubmitting}
                  >
                    {isSubmitting && (
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
                    {isSubmitting ? 'Finalising…' : 'Enter Vinsly'}
                  </button>
                </div>
                {isSubmitting && (
                  <p className="text-xs text-v-light-text-secondary dark:text-v-text-secondary text-center">
                    Setting up your workspace. This can take a few seconds while we scan for agents.
                  </p>
                )}
              </form>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ActivationModal;
