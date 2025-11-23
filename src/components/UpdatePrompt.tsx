import React from 'react';
import { motion } from 'framer-motion';
import { PendingUpdateDetails } from '../types/updater';

interface UpdatePromptProps {
  update: PendingUpdateDetails;
  isInstalling: boolean;
  onInstall: () => void;
  onRemindLater: () => void;
}

export const UpdatePrompt: React.FC<UpdatePromptProps> = ({
  update,
  isInstalling,
  onInstall,
  onRemindLater,
}) => {
  const notesPreview = update.notes
    ? update.notes.length > 320
      ? `${update.notes.slice(0, 320)}…`
      : update.notes
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.2 }}
      className="fixed bottom-6 right-6 z-[12000] w-full max-w-sm rounded-2xl border border-v-light-border dark:border-v-border bg-v-light-surface dark:bg-v-mid-dark shadow-2xl p-5 space-y-4"
    >
      <div>
        <p className="text-xs uppercase tracking-[0.35em] text-v-light-text-secondary dark:text-v-text-secondary">
          Update available
        </p>
        <h3 className="text-lg font-semibold text-v-light-text-primary dark:text-v-text-primary mt-1.5">
          Vinsly {update.version}
        </h3>
        {update.date && (
          <p className="text-xs text-v-light-text-secondary dark:text-v-text-secondary">
            Published {new Date(update.date).toLocaleDateString()}
          </p>
        )}
      </div>

      {notesPreview && (
        <p className="text-sm text-v-light-text-secondary dark:text-v-text-secondary whitespace-pre-line">
          {notesPreview}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <button
          onClick={onInstall}
          disabled={isInstalling}
          className="w-full px-4 py-2 rounded-xl bg-v-accent text-white font-semibold hover:bg-v-accent-hover disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
        >
          {isInstalling ? 'Installing…' : 'Install & restart'}
        </button>
        <button
          onClick={onRemindLater}
          disabled={isInstalling}
          className="w-full px-4 py-2 rounded-xl border border-v-light-border dark:border-v-border text-sm font-medium text-v-light-text-primary dark:text-v-text-primary hover:border-v-accent/60 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
        >
          Remind me later
        </button>
      </div>
    </motion.div>
  );
};

