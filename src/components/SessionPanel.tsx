import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ClaudeSession,
  formatUptime,
  formatMemoryUsage,
  getProjectName,
} from '../types/session';
import { FolderIcon } from './icons/FolderIcon';
import { RefreshIcon } from './icons/RefreshIcon';
import { ConfirmDialog } from './ConfirmDialog';
import { killClaudeSession } from '../utils/tauriCommands';
import { revealItemInDir } from '@tauri-apps/plugin-opener';
import { useToast } from '../contexts/ToastContext';

type SortOption = 'name' | 'uptime' | 'cpu' | 'ram';

interface SessionPanelProps {
  isOpen: boolean;
  sessions: ClaudeSession[];
  isLoading: boolean;
  error: string | null;
  onClose: () => void;
  onRefresh: () => void;
}

export const SessionPanel: React.FC<SessionPanelProps> = ({
  isOpen,
  sessions,
  isLoading,
  error,
  onClose,
  onRefresh,
}) => {
  const [sortBy, setSortBy] = useState<SortOption>('uptime');

  const sortedSessions = useMemo(() => {
    return [...sessions].sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return getProjectName(a.workingDirectory).localeCompare(getProjectName(b.workingDirectory));
        case 'uptime':
          return a.startTime - b.startTime; // Oldest first (longest running)
        case 'cpu':
          return (b.cpuUsage ?? 0) - (a.cpuUsage ?? 0); // Highest first
        case 'ram':
          return (b.memoryUsage ?? 0) - (a.memoryUsage ?? 0); // Highest first
        default:
          return 0;
      }
    });
  }, [sessions, sortBy]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 dark:bg-black/40 z-40"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="fixed top-16 right-4 w-96 max-h-[70vh] bg-v-light-surface dark:bg-v-mid-dark border border-v-light-border dark:border-v-border rounded-lg shadow-xl z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-v-light-border dark:border-v-border">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-v-light-text-primary dark:text-v-text-primary">
                    Claude Code Sessions
                  </h3>
                  <p className="text-xs text-v-light-text-secondary dark:text-v-text-secondary mt-0.5">
                    {sessions.length} session{sessions.length !== 1 ? 's' : ''} detected
                  </p>
                </div>
                <button
                  onClick={onRefresh}
                  disabled={isLoading}
                  className={`p-2 rounded-md hover:bg-v-light-hover dark:hover:bg-v-light-dark transition-colors disabled:opacity-50 ${
                    isLoading ? 'text-v-light-text-secondary dark:text-v-text-secondary' : 'text-green-500'
                  }`}
                  title={isLoading ? 'Refreshing...' : 'Up to date'}
                >
                  {isLoading ? (
                    <RefreshIcon className="h-4 w-4 animate-spin" />
                  ) : (
                    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              </div>

              {/* Sort options */}
              <div className="flex items-center gap-1 mt-2">
                <span className="text-xs text-v-light-text-secondary dark:text-v-text-secondary mr-1">Sort:</span>
                {(['name', 'uptime', 'cpu', 'ram'] as SortOption[]).map((option) => (
                  <button
                    key={option}
                    onClick={() => setSortBy(option)}
                    className={`px-2 py-0.5 text-xs rounded transition-colors ${
                      sortBy === option
                        ? 'bg-v-accent/20 text-v-accent font-medium'
                        : 'text-v-light-text-secondary dark:text-v-text-secondary hover:bg-v-light-hover dark:hover:bg-v-light-dark'
                    }`}
                  >
                    {option === 'name' ? 'Name' : option === 'uptime' ? 'Uptime' : option.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Content */}
            <div className="overflow-y-auto max-h-[calc(70vh-100px)]">
              {error ? (
                <div className="p-4 text-center text-v-danger">
                  <p className="text-sm">Failed to detect sessions</p>
                  <p className="text-xs mt-1 opacity-75">{error}</p>
                </div>
              ) : sessions.length === 0 ? (
                <div className="p-8 text-center text-v-light-text-secondary dark:text-v-text-secondary">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-v-light-hover dark:bg-v-light-dark flex items-center justify-center">
                    <FolderIcon className="h-6 w-6" />
                  </div>
                  <p className="text-sm font-medium">No Claude Code sessions</p>
                  <p className="text-xs mt-1">
                    Sessions will appear here when you start Claude Code in a terminal
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-v-light-border dark:divide-v-border">
                  {sortedSessions.map(session => (
                    <SessionCard
                      key={session.pid}
                      session={session}
                      onRefresh={onRefresh}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2 border-t border-v-light-border dark:border-v-border bg-v-light-hover dark:bg-v-light-dark">
              <p className="text-xs text-v-light-text-secondary dark:text-v-text-secondary text-center">
                Auto-refreshing every 10 seconds
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

interface SessionCardProps {
  session: ClaudeSession;
  onRefresh: () => void;
}

const SessionCard: React.FC<SessionCardProps> = ({ session, onRefresh }) => {
  const { showToast } = useToast();
  const [showStopConfirm, setShowStopConfirm] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState<string | null>(null);
  const projectName = getProjectName(session.workingDirectory);

  const handleRevealInFinder = async () => {
    setIsActionLoading('reveal');
    try {
      await revealItemInDir(session.workingDirectory);
    } catch (error) {
      showToast('error', `Failed to open folder: ${error}`);
    } finally {
      setIsActionLoading(null);
    }
  };

  const handleStopSession = async () => {
    setShowStopConfirm(false);
    setIsActionLoading('stop');
    try {
      await killClaudeSession(session.pid);
      showToast('success', 'Session stopped');
      onRefresh();
    } catch (error) {
      showToast('error', `Failed to stop session: ${error}`);
    } finally {
      setIsActionLoading(null);
    }
  };

  return (
    <div className="px-4 py-3 hover:bg-v-light-hover dark:hover:bg-v-light-dark/50 transition-colors">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full flex-shrink-0 bg-v-accent" />
        <div className="flex-1 min-w-0">
          <span className="font-medium text-v-light-text-primary dark:text-v-text-primary truncate block">
            {projectName}
          </span>
          <p
            className="text-xs text-v-light-text-secondary dark:text-v-text-secondary truncate font-mono"
            title={session.workingDirectory}
          >
            {session.workingDirectory}
          </p>
        </div>
      </div>

      <div className="mt-2 flex items-center gap-4 text-xs text-v-light-text-secondary dark:text-v-text-secondary">
        <span title="Uptime">
          {formatUptime(session.startTime)}
        </span>
        {session.cpuUsage !== undefined && (
          <span title="CPU Usage">
            CPU: {session.cpuUsage.toFixed(1)}%
          </span>
        )}
        {session.memoryUsage !== undefined && (
          <span title="Memory Usage">
            RAM: {formatMemoryUsage(session.memoryUsage)}
          </span>
        )}
        <span className="text-xs opacity-50" title="Process ID">
          PID: {session.pid}
        </span>
      </div>

      {/* Action buttons */}
      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={handleRevealInFinder}
          disabled={isActionLoading === 'reveal'}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border border-v-light-border dark:border-v-border text-v-light-text-secondary dark:text-v-text-secondary hover:border-v-accent hover:text-v-accent transition-colors disabled:opacity-50"
          title="Open in Finder"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4.25 5.5a.75.75 0 00-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 00.75-.75v-4a.75.75 0 011.5 0v4A2.25 2.25 0 0112.75 17h-8.5A2.25 2.25 0 012 14.75v-8.5A2.25 2.25 0 014.25 4h5a.75.75 0 010 1.5h-5z" clipRule="evenodd" />
            <path fillRule="evenodd" d="M6.194 12.753a.75.75 0 001.06.053L16.5 4.44v2.81a.75.75 0 001.5 0v-4.5a.75.75 0 00-.75-.75h-4.5a.75.75 0 000 1.5h2.553l-9.056 8.194a.75.75 0 00-.053 1.06z" clipRule="evenodd" />
          </svg>
          Open Folder
        </button>
        <button
          onClick={() => setShowStopConfirm(true)}
          disabled={isActionLoading === 'stop'}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border border-v-light-border dark:border-v-border text-v-light-text-secondary dark:text-v-text-secondary hover:border-red-400 hover:text-red-500 transition-colors disabled:opacity-50 ml-auto"
          title="Stop this session"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
          </svg>
          Stop
        </button>
      </div>

      <ConfirmDialog
        isOpen={showStopConfirm}
        title="Stop Session"
        message={`Are you sure you want to stop the Claude Code session in "${projectName}"?`}
        confirmText="Stop Session"
        cancelText="Cancel"
        onConfirm={handleStopSession}
        onCancel={() => setShowStopConfirm(false)}
        variant="danger"
      />
    </div>
  );
};
