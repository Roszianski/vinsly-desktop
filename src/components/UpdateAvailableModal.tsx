import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PendingUpdateDetails } from '../types/updater';

interface UpdateAvailableModalProps {
  isOpen: boolean;
  update: PendingUpdateDetails;
  isInstalling: boolean;
  onInstall: () => void;
  onSkip: () => void;
}

export const UpdateAvailableModal: React.FC<UpdateAvailableModalProps> = ({
  isOpen,
  update,
  isInstalling,
  onInstall,
  onSkip,
}) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="update-available-modal"
        className="fixed inset-0 z-[11000] flex items-center justify-center bg-black/40 px-4"
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
          <div className="px-6 py-5 border-b border-v-light-border dark:border-v-border bg-v-light-bg/60 dark:bg-v-dark/60">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-v-accent/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-v-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-v-light-text-secondary dark:text-v-text-secondary">
                  Update Available
                </p>
                <h2 className="text-xl font-semibold text-v-light-text-primary dark:text-v-text-primary">
                  Vinsly {update.version}
                </h2>
              </div>
            </div>
          </div>

          <div className="px-6 py-6 space-y-5">
            <p className="text-sm text-v-light-text-secondary dark:text-v-text-secondary">
              A newer version of Vinsly is available. We recommend updating before continuing for the best experience.
            </p>

            {update.notes && (
              <div className="p-4 rounded-xl bg-v-light-bg dark:bg-v-dark border border-v-light-border dark:border-v-border">
                <p className="text-xs uppercase tracking-wider text-v-light-text-secondary dark:text-v-text-secondary mb-2">
                  What's New
                </p>
                <p className="text-sm text-v-light-text-primary dark:text-v-text-primary whitespace-pre-wrap line-clamp-4">
                  {update.notes}
                </p>
              </div>
            )}

            <div className="flex flex-col gap-3">
              <button
                onClick={onInstall}
                disabled={isInstalling}
                className="w-full py-3 rounded-xl text-white font-semibold transition-colors flex items-center justify-center gap-2 bg-v-accent hover:bg-v-accent-hover disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isInstalling && (
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
                {isInstalling ? 'Installing Update…' : 'Update Now'}
              </button>
              <button
                onClick={onSkip}
                disabled={isInstalling}
                className="w-full py-3 rounded-xl border border-v-light-border dark:border-v-border text-sm font-medium text-v-light-text-secondary dark:text-v-text-secondary hover:border-v-accent hover:text-v-light-text-primary dark:hover:text-v-text-primary transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Skip for Now
              </button>
            </div>

            <p className="text-xs text-v-light-text-secondary dark:text-v-text-secondary text-center">
              The app will restart automatically after updating.
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default UpdateAvailableModal;
