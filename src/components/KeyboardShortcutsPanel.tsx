/**
 * KeyboardShortcutsPanel
 * Displays all available keyboard shortcuts in a modal
 * Shows Mac and Windows/Linux variants
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface KeyboardShortcut {
  action: string;
  mac: string;
  windows: string;
  description?: string;
}

interface KeyboardShortcutsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  isMacLike: boolean;
}

const shortcuts: KeyboardShortcut[] = [
  {
    action: 'Create New Agent',
    mac: '⌘ N',
    windows: 'Ctrl + N',
    description: 'Create a new agent from any screen',
  },
  {
    action: 'Undo',
    mac: '⌘ Z',
    windows: 'Ctrl + Z',
    description: 'Undo last action (delete, toggle favorite, etc.)',
  },
  {
    action: 'Redo',
    mac: '⌘ ⇧ Z',
    windows: 'Ctrl + Shift + Z',
    description: 'Redo last undone action',
  },
  {
    action: 'Agent wizard — next step',
    mac: 'Enter',
    windows: 'Enter',
    description: 'Advance to the next step while filling the agent creation wizard (outside text areas)',
  },
];

export function KeyboardShortcutsPanel({
  isOpen,
  onClose,
  isMacLike,
}: KeyboardShortcutsPanelProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/30 dark:bg-black/50"
        />

        {/* Panel */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-2xl mx-4 bg-v-light-surface dark:bg-v-mid-dark rounded-2xl shadow-2xl border border-v-light-border dark:border-v-border overflow-hidden"
        >
          {/* Header */}
          <div className="px-6 py-5 border-b border-v-light-border dark:border-v-border bg-v-light-bg dark:bg-v-dark">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-v-light-text-primary dark:text-v-text-primary">
                  Keyboard Shortcuts
                </h2>
                <p className="text-sm text-v-light-text-secondary dark:text-v-text-secondary mt-1">
                  {isMacLike ? 'macOS' : 'Windows/Linux'} shortcuts
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg text-v-light-text-secondary dark:text-v-text-secondary hover:bg-v-light-hover dark:hover:bg-v-light-dark transition-colors"
                aria-label="Close shortcuts panel"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* Shortcuts List */}
          <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
            <div className="space-y-3">
              {shortcuts.map((shortcut, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-4 rounded-xl border transition-all bg-v-light-bg dark:bg-v-dark border-v-light-border dark:border-v-border hover:border-v-accent/50"
                >
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-v-light-text-primary dark:text-v-text-primary">
                      {shortcut.action}
                    </h3>
                    {shortcut.description && (
                      <p className="text-sm text-v-light-text-secondary dark:text-v-text-secondary mt-1">
                        {shortcut.description}
                      </p>
                    )}
                  </div>
                  <div className="ml-4 flex items-center gap-2">
                    <kbd className="px-3 py-1.5 text-sm font-mono font-semibold bg-v-light-surface dark:bg-v-mid-dark border border-v-light-border dark:border-v-border rounded-lg shadow-sm text-v-light-text-primary dark:text-v-text-primary whitespace-nowrap">
                      {isMacLike ? shortcut.mac : shortcut.windows}
                    </kbd>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-v-light-border dark:border-v-border bg-v-light-bg dark:bg-v-dark">
            <p className="text-xs text-v-light-text-secondary dark:text-v-text-secondary text-center">
              Press <kbd className="px-1.5 py-0.5 text-xs font-mono bg-v-light-hover dark:bg-v-light-dark rounded">Esc</kbd> to close
            </p>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
