import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { openUrl } from '@tauri-apps/plugin-opener';

interface UpdateCompleteModalProps {
  isOpen: boolean;
  version: string;
  onClose: () => void;
}

export const UpdateCompleteModal: React.FC<UpdateCompleteModalProps> = ({
  isOpen,
  version,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="update-complete-modal"
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
              <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-v-light-text-secondary dark:text-v-text-secondary">
                  Update Complete
                </p>
                <h2 className="text-xl font-semibold text-v-light-text-primary dark:text-v-text-primary">
                  Welcome to Vinsly {version}
                </h2>
              </div>
            </div>
          </div>

          <div className="px-6 py-6 space-y-5">
            <p className="text-sm text-v-light-text-secondary dark:text-v-text-secondary">
              Vinsly has been successfully updated. You're now running the latest version with all the newest features and improvements.
            </p>

            <div className="p-4 rounded-xl bg-v-light-bg dark:bg-v-dark border border-v-light-border dark:border-v-border">
              <p className="text-xs uppercase tracking-wider text-v-light-text-secondary dark:text-v-text-secondary mb-2">
                What's New
              </p>
              <button
                onClick={() => void openUrl(`https://github.com/Roszianski/vinsly-desktop/releases/tag/v${version}`)}
                className="text-sm text-v-accent hover:underline"
              >
                See release notes on GitHub →
              </button>
            </div>

            <button
              onClick={onClose}
              className="w-full py-3 rounded-xl text-white font-semibold transition-colors bg-v-accent hover:bg-v-accent-hover"
            >
              Get Started
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default UpdateCompleteModal;
