import React, { useState } from 'react';
import { ClaudeSession, getStatusBgColor, getProjectName } from '../types/session';

interface SessionIndicatorProps {
  sessions: ClaudeSession[];
  isLoading: boolean;
  onClick?: () => void;
}

export const SessionIndicator: React.FC<SessionIndicatorProps> = ({
  sessions,
  isLoading,
  onClick,
}) => {
  const activeSessions = sessions.filter(s => s.status === 'active');
  const hasActiveSessions = activeSessions.length > 0;
  const totalSessions = sessions.length;

  if (isLoading && sessions.length === 0) {
    return (
      <button
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-v-light-bg dark:bg-v-dark border border-v-light-border dark:border-v-border text-v-light-text-secondary dark:text-v-text-secondary text-sm cursor-not-allowed shadow-none"
        disabled
      >
        <div className="w-2 h-2 rounded-full bg-gray-400 animate-pulse pointer-events-none" />
        <span className="pointer-events-none">Scanning...</span>
      </button>
    );
  }

  if (sessions.length === 0) {
    return (
      <button
        onClick={onClick}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-v-light-bg dark:bg-v-dark border border-v-light-border dark:border-v-border text-v-light-text-secondary dark:text-v-text-secondary text-sm hover:bg-v-light-hover dark:hover:bg-v-light-dark transition-colors cursor-pointer shadow-none"
      >
        <div className="w-2 h-2 rounded-full bg-yellow-500 pointer-events-none" />
        <span className="pointer-events-none">No sessions</span>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-v-light-bg dark:bg-v-dark border border-v-light-border dark:border-v-border text-v-light-text-primary dark:text-v-text-primary text-sm hover:bg-v-light-hover dark:hover:bg-v-light-dark transition-colors cursor-pointer shadow-none group"
    >
      <div className="relative flex items-center justify-center pointer-events-none">
        <div className="w-2 h-2 rounded-full bg-v-accent" />
        <div
          className="absolute w-2 h-2 rounded-full bg-v-accent opacity-20"
          style={{ animation: 'ping 3s cubic-bezier(0, 0, 0.2, 1) infinite' }}
        />
      </div>
      <span className="font-medium pointer-events-none">
        {totalSessions} session{totalSessions !== 1 ? 's' : ''}
      </span>
    </button>
  );
};
