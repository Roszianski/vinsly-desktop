import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { devLog } from '../utils/devLogger';

interface ChangeLicenseModalProps {
  isOpen: boolean;
  onValidateLicense?: (payload: { licenseKey: string }) => Promise<void>;
  onComplete: (payload: { licenseKey: string }) => Promise<void> | void;
  onClose: () => void;
}

export const ChangeLicenseModal: React.FC<ChangeLicenseModalProps> = ({
  isOpen,
  onValidateLicense,
  onComplete,
  onClose,
}) => {
  const [licenseKey, setLicenseKey] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [validationState, setValidationState] = useState<'idle' | 'validating' | 'success'>('idle');
  const [licenseError, setLicenseError] = useState<string | null>(null);
  const validationSuccessTimer = useRef<number | null>(null);

  const resetFormState = useCallback(() => {
    setLicenseKey('');
    setIsSubmitting(false);
    setSubmitError(null);
    setValidationState('idle');
    setLicenseError(null);
    if (validationSuccessTimer.current) {
      window.clearTimeout(validationSuccessTimer.current);
      validationSuccessTimer.current = null;
    }
  }, []);

  useEffect(() => {
    if (!isOpen) {
      resetFormState();
    }
  }, [isOpen, resetFormState]);

  useEffect(() => {
    return () => {
      if (validationSuccessTimer.current) {
        window.clearTimeout(validationSuccessTimer.current);
      }
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (validationState === 'validating' || validationState === 'success' || isSubmitting) return;

    setLicenseError(null);
    setSubmitError(null);

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setLicenseError('Please connect to the internet to validate your licence key.');
      return;
    }

    if (!licenseKey.trim()) {
      setLicenseError('Please enter your licence key');
      return;
    }

    // First validate the license
    if (onValidateLicense) {
      try {
        setValidationState('validating');
        await onValidateLicense({ licenseKey: licenseKey.trim() });
        setValidationState('success');
      } catch (error) {
        devLog.error('Licence validation failed:', error);
        const message = error instanceof Error && error.message
          ? error.message
          : 'Unable to validate your licence. Please try again.';
        setLicenseError(message);
        setValidationState('idle');
        return;
      }
    } else {
      setValidationState('success');
    }

    // Then complete the license change
    setIsSubmitting(true);
    try {
      await onComplete({ licenseKey: licenseKey.trim() });
    } catch (error) {
      devLog.error('License change failed:', error);
      const message = error instanceof Error && error.message
        ? error.message
        : 'Unable to activate your licence. Please try again.';
      setSubmitError(message);
      setValidationState('idle');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const isButtonBusy = validationState === 'validating' || isSubmitting;

  return (
    <AnimatePresence>
      <motion.div
        key="change-license-modal"
        className="fixed inset-0 z-[11000] flex items-center justify-center bg-black/40 px-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="w-full max-w-lg bg-v-light-surface dark:bg-v-mid-dark rounded-2xl shadow-2xl border border-v-light-border dark:border-v-border overflow-hidden"
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2 }}
        >
          <div className="px-6 py-5 border-b border-v-light-border dark:border-v-border flex items-center justify-between bg-v-light-bg/60 dark:bg-v-dark/60">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-v-light-text-secondary dark:text-v-text-secondary">
                Settings
              </p>
              <h2 className="text-xl font-semibold text-v-light-text-primary dark:text-v-text-primary">
                Change Licence
              </h2>
            </div>
            <button
              onClick={onClose}
              disabled={isButtonBusy}
              className="p-2 rounded-lg hover:bg-v-light-hover dark:hover:bg-v-light-dark text-v-light-text-secondary dark:text-v-text-secondary disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Close"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form className="px-6 py-6 space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm font-semibold text-v-light-text-primary dark:text-v-text-primary mb-2">
                New licence key
              </label>
              <input
                type="text"
                value={licenseKey}
                onChange={(event) => setLicenseKey(event.target.value)}
                placeholder="XXXX-XXXX-XXXX-XXXX"
                disabled={isButtonBusy}
                className={`w-full px-4 py-3 rounded-xl border bg-transparent text-v-light-text-primary dark:text-v-text-primary focus-visible:outline-none focus:ring-2 focus:ring-v-accent ${
                  licenseError ? 'border-red-400' : 'border-v-light-border dark:border-v-border'
                }`}
              />
              {licenseError && (
                <p className="text-xs text-red-500 mt-1">{licenseError}</p>
              )}
            </div>

            {submitError && (
              <p className="text-sm text-red-500" role="alert">
                {submitError}
              </p>
            )}

            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isButtonBusy}
                className="px-4 py-3 rounded-xl border border-v-light-border dark:border-v-border text-sm font-medium text-v-light-text-secondary dark:text-v-text-secondary hover:border-v-accent hover:text-v-light-text-primary dark:hover:text-v-text-primary transition-colors disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isButtonBusy}
                className="flex-1 py-3 rounded-xl text-white font-semibold transition-colors flex items-center justify-center gap-2 bg-v-accent hover:bg-v-accent-hover disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isButtonBusy && (
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
                {validationState === 'validating'
                  ? 'Validating…'
                  : isSubmitting
                    ? 'Activating…'
                    : 'Change Licence'}
              </button>
            </div>

            <p className="text-xs text-v-light-text-secondary dark:text-v-text-secondary text-center">
              Your current licence will be deactivated and replaced with the new one.
            </p>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ChangeLicenseModal;
