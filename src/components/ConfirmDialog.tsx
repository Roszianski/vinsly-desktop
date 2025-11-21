import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'danger' | 'warning' | 'info';
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  variant = 'danger'
}) => {
  if (!isOpen) return null;

  const variantStyles = {
    danger: {
      button: 'bg-red-500 hover:bg-red-600 text-white',
      icon: '⚠️'
    },
    warning: {
      button: 'bg-yellow-500 hover:bg-yellow-600 text-white',
      icon: '⚠️'
    },
    info: {
      button: 'bg-v-accent hover:bg-v-accent-hover text-white',
      icon: 'ℹ️'
    }
  };

  const style = variantStyles[variant];

  return (
    <AnimatePresence>
      <motion.div
        key="confirm-dialog-overlay"
        className="fixed inset-0 z-[12000] flex items-center justify-center bg-black/50 px-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onCancel}
      >
        <motion.div
          className="w-full max-w-md bg-v-light-surface dark:bg-v-mid-dark rounded-xl shadow-2xl border border-v-light-border dark:border-v-border overflow-hidden"
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.15 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-v-light-border dark:border-v-border">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{style.icon}</span>
              <h2 className="text-lg font-semibold text-v-light-text-primary dark:text-v-text-primary">
                {title}
              </h2>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-5">
            <p className="text-sm text-v-light-text-secondary dark:text-v-text-secondary">
              {message}
            </p>
          </div>

          {/* Actions */}
          <div className="px-6 py-4 bg-v-light-hover/50 dark:bg-v-dark/30 flex items-center justify-end gap-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-v-light-text-primary dark:text-v-text-primary hover:bg-v-light-border dark:hover:bg-v-border rounded-md transition-colors"
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              className={`px-4 py-2 text-sm font-semibold rounded-md transition-all duration-150 active:scale-95 ${style.button}`}
            >
              {confirmText}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
