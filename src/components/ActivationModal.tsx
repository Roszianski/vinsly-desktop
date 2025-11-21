import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ActivationModalProps {
  isOpen: boolean;
  defaultEmail?: string;
  defaultDisplayName?: string;
  defaultScanGlobal?: boolean;
  defaultScanHome?: boolean;
  onComplete: (payload: {
    licenseKey: string;
    email: string;
    displayName: string;
    autoScanGlobal: boolean;
    autoScanHome: boolean;
  }) => Promise<void> | void;
  onClose: () => void;
}

type Step = 'license' | 'profile' | 'discovery';

export const ActivationModal: React.FC<ActivationModalProps> = ({
  isOpen,
  defaultEmail = '',
  defaultDisplayName = '',
  defaultScanGlobal = true,
  defaultScanHome = false,
  onComplete,
  onClose
}) => {
  const [step, setStep] = useState<Step>('license');
  const [licenseKey, setLicenseKey] = useState('');
  const [email, setEmail] = useState(defaultEmail);
  const [displayName, setDisplayName] = useState(defaultDisplayName);
  const [autoScanGlobal, setAutoScanGlobal] = useState(defaultScanGlobal);
  const [autoScanHome, setAutoScanHome] = useState(defaultScanHome);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ licenseKey?: string; email?: string; displayName?: string }>({});

  useEffect(() => {
    if (!isOpen) {
      setStep('license');
      setLicenseKey('');
      setErrors({});
      setAutoScanGlobal(defaultScanGlobal);
      setAutoScanHome(defaultScanHome);
      setIsSubmitting(false);
      setSubmitError(null);
    }
  }, [isOpen, defaultScanGlobal, defaultScanHome]);

  // ESC key handler to close modal
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const validateLicenseStep = () => {
    const nextErrors: typeof errors = {};
    if (!licenseKey.trim()) {
      nextErrors.licenseKey = 'Please enter your licence key';
    }
    if (!email.trim()) {
      nextErrors.email = 'Email required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      nextErrors.email = 'Enter a valid email';
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

  const handleLicenseSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (validateLicenseStep()) {
      setStep('profile');
      setErrors({});
    }
  };

  const handleProfileSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (validateProfileStep()) {
      setStep('discovery');
      setErrors({});
    }
  };

  const handleDiscoverySubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await onComplete({
        licenseKey: licenseKey.trim(),
        email: email.trim(),
        displayName: displayName.trim(),
        autoScanGlobal,
        autoScanHome,
      });
    } catch (error) {
      console.error('Activation completion failed:', error);
      setSubmitError('Something went wrong while setting up scans. Please try again.');
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const steps: Step[] = ['license', 'profile', 'discovery'];
  const currentIndex = steps.indexOf(step);

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
            <button
              onClick={onClose}
              className="text-v-light-text-secondary dark:text-v-text-secondary hover:text-v-light-text-primary dark:hover:text-white transition-colors text-2xl leading-none"
              aria-label="Close"
            >
              ×
            </button>
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
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    className={`w-full px-4 py-3 rounded-xl border bg-transparent text-v-light-text-primary dark:text-v-text-primary focus-visible:outline-none focus:ring-2 focus:ring-v-accent ${
                      errors.email ? 'border-red-400' : 'border-v-light-border dark:border-v-border'
                    }`}
                  />
                  {errors.email && (
                    <p className="text-xs text-red-500 mt-1">{errors.email}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-v-light-text-primary dark:text-v-text-primary mb-2">
                    Licence key
                  </label>
                  <input
                    type="text"
                    value={licenseKey}
                    onChange={(event) => setLicenseKey(event.target.value)}
                    placeholder="XXXX-XXXX-XXXX-XXXX"
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
                  className="w-full py-3 rounded-xl bg-v-accent text-white font-semibold hover:bg-v-accent-hover transition-colors"
                >
                  Validate licence
                </button>
                <p className="text-xs text-v-light-text-secondary dark:text-v-text-secondary text-center">
                  We&apos;ll verify your licence with Lemon Squeezy and store it securely on this device.
                </p>
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
                    placeholder="e.g. Lunar Labs"
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
            ) : (
              <form className="space-y-5" onSubmit={handleDiscoverySubmit}>
                <div className="space-y-3">
                  <div className={`flex items-center justify-between p-4 border border-v-light-border dark:border-v-border rounded-xl bg-v-light-bg/60 dark:bg-v-dark/60 ${isSubmitting ? 'opacity-70' : ''}`}>
                    <div className="mr-4">
                      <p className="text-sm font-semibold text-v-light-text-primary dark:text-v-text-primary">
                        Auto-scan global agents
                      </p>
                      <p className="text-xs text-v-light-text-secondary dark:text-v-text-secondary mt-1">
                        Keep `~/.claude/agents` in sync every time Vinsly launches. You can change this later in Settings → Agents.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => !isSubmitting && setAutoScanGlobal(prev => !prev)}
                      disabled={isSubmitting}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-v-accent ${
                        autoScanGlobal ? 'bg-v-accent' : 'bg-v-light-border dark:bg-v-border'
                      }`}
                      role="switch"
                      aria-checked={autoScanGlobal}
                      aria-disabled={isSubmitting}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
                          autoScanGlobal ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  <div className={`flex items-center justify-between p-4 border border-v-light-border dark:border-v-border rounded-xl bg-v-light-bg/60 dark:bg-v-dark/60 ${isSubmitting ? 'opacity-70' : ''}`}>
                    <div className="mr-4">
                      <p className="text-sm font-semibold text-v-light-text-primary dark:text-v-text-primary">
                        Scan home directory for project agents
                      </p>
                      <p className="text-xs text-v-light-text-secondary dark:text-v-text-secondary mt-1">
                        Vinsly will walk your home directory to discover `.claude/agents` folders in every project. Can be toggled anytime in Settings.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => !isSubmitting && setAutoScanHome(prev => !prev)}
                      disabled={isSubmitting}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-v-accent ${
                        autoScanHome ? 'bg-v-accent' : 'bg-v-light-border dark:bg-v-border'
                      }`}
                      role="switch"
                      aria-checked={autoScanHome}
                      aria-disabled={isSubmitting}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
                          autoScanHome ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
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
                    onClick={() => !isSubmitting && setStep('profile')}
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
                    {isSubmitting ? 'Scanning agents…' : 'Enter Vinsly'}
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
