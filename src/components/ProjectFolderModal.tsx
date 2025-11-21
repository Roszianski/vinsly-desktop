import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FolderIcon } from './icons/FolderIcon';

interface ProjectFolderModalProps {
  isOpen: boolean;
  folders: string[];
  onRemove: (folder: string) => void;
  onClose: () => void;
}

export const ProjectFolderModal: React.FC<ProjectFolderModalProps> = ({
  isOpen,
  folders,
  onRemove,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="project-folder-modal"
        className="fixed inset-0 z-[13000] flex items-center justify-center bg-black/50 px-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="w-full max-w-2xl bg-v-light-surface dark:bg-v-mid-dark rounded-2xl shadow-2xl border border-v-light-border dark:border-v-border overflow-hidden flex flex-col max-h-[80vh]"
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-6 py-4 border-b border-v-light-border dark:border-v-border flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-v-light-text-primary dark:text-v-text-primary">
                Manage project folders
              </h2>
              <p className="text-xs text-v-light-text-secondary dark:text-v-text-secondary">
                Remove folders you no longer want to include in project scans.
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-v-light-text-secondary dark:text-v-text-secondary hover:text-v-light-text-primary dark:hover:text-white transition-colors text-2xl leading-none"
              aria-label="Close folder manager"
            >
              ×
            </button>
          </div>

          <div className="p-6 overflow-y-auto flex-1 space-y-2">
            {folders.length === 0 ? (
              <p className="text-sm text-v-light-text-secondary dark:text-v-text-secondary">
                No folders selected yet. Add some from the main scan window.
              </p>
            ) : (
              folders.map(folder => (
                <div
                  key={folder}
                  className="flex items-center justify-between text-sm bg-v-light-bg dark:bg-v-dark rounded-lg px-3 py-2 border border-v-light-border/70 dark:border-v-border/70"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FolderIcon className="w-4 h-4 text-v-accent flex-shrink-0" />
                    <span className="font-mono text-[12px] text-v-light-text-primary dark:text-v-text-primary truncate">
                      {folder}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemove(folder)}
                    className="text-xs text-v-danger hover:text-v-danger/80 transition-colors"
                  >
                    Remove
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="px-6 py-4 border-t border-v-light-border dark:border-v-border bg-v-light-hover/40 dark:bg-v-dark/40">
            <button
              type="button"
              onClick={onClose}
              className="w-full px-4 py-2.5 bg-v-accent hover:bg-v-accent-hover text-white text-sm font-semibold rounded-lg transition-colors"
            >
              Done
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
