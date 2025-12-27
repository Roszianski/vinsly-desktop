import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export type UnsavedChangesAction = 'save' | 'discard' | 'cancel';

interface UnsavedChangesDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** What type of item has unsaved changes */
  itemType?: string;
  /** Name of the item with unsaved changes (optional) */
  itemName?: string;
  /** Callback when user chooses an action */
  onAction: (action: UnsavedChangesAction) => void;
  /** Whether save is in progress */
  isSaving?: boolean;
  /** Whether the save option should be available */
  canSave?: boolean;
}

/**
 * Dialog shown when user tries to navigate away with unsaved changes
 * Provides options to save, discard, or cancel the navigation
 */
export const UnsavedChangesDialog: React.FC<UnsavedChangesDialogProps> = ({
  isOpen,
  itemType = 'item',
  itemName,
  onAction,
  isSaving = false,
  canSave = true,
}) => {
  const message = itemName
    ? `You have unsaved changes to "${itemName}". What would you like to do?`
    : `You have unsaved changes to this ${itemType}. What would you like to do?`;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[12000]"
            onClick={() => !isSaving && onAction('cancel')}
          />

          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[12001] w-full max-w-md"
          >
            <div
              className="bg-v-light-surface dark:bg-v-mid-dark border border-v-light-border dark:border-v-border rounded-xl shadow-xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-6 py-4 border-b border-v-light-border dark:border-v-border">
                <div className="flex items-center gap-3">
                  {/* Warning Icon */}
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-v-warning/10 flex items-center justify-center">
                    <svg className="w-5 h-5 text-v-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <h2 className="text-lg font-semibold text-v-light-text-primary dark:text-v-text-primary">
                    Unsaved Changes
                  </h2>
                </div>
              </div>

              {/* Content */}
              <div className="px-6 py-4">
                <p className="text-sm text-v-light-text-secondary dark:text-v-text-secondary">
                  {message}
                </p>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 bg-v-light-hover/50 dark:bg-v-light-dark/30 border-t border-v-light-border dark:border-v-border">
                <div className="flex items-center justify-end gap-3">
                  <button
                    onClick={() => onAction('cancel')}
                    disabled={isSaving}
                    className="px-4 py-2 text-sm font-medium text-v-light-text-secondary dark:text-v-text-secondary hover:text-v-light-text-primary dark:hover:text-v-text-primary transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => onAction('discard')}
                    disabled={isSaving}
                    className="px-4 py-2 text-sm font-medium text-v-danger border border-v-danger/30 rounded-md hover:bg-v-danger/10 transition-colors disabled:opacity-50"
                  >
                    Discard Changes
                  </button>
                  {canSave && (
                    <button
                      onClick={() => onAction('save')}
                      disabled={isSaving}
                      className="px-4 py-2 text-sm font-medium bg-v-accent text-white rounded-md hover:bg-v-accent-hover transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                      {isSaving && (
                        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                      )}
                      {isSaving ? 'Saving...' : 'Save & Continue'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
