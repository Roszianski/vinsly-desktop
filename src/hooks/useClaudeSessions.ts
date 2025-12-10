import { useCallback, useState, useEffect, useRef } from 'react';
import { detectClaudeSessions, ClaudeSessionRaw } from '../utils/tauriCommands';
import { ClaudeSession, rawToSession } from '../types/session';
import { devLog } from '../utils/devLogger';

const DEFAULT_POLL_INTERVAL = 10000; // 10 seconds

export interface UseClaudeSessionsOptions {
  pollInterval?: number;
  autoStart?: boolean;
}

export interface UseClaudeSessionsResult {
  sessions: ClaudeSession[];
  isLoading: boolean;
  isPolling: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  startPolling: () => void;
  stopPolling: () => void;
  activeSessionCount: number;
}

export function useClaudeSessions(options?: UseClaudeSessionsOptions): UseClaudeSessionsResult {
  const pollInterval = options?.pollInterval ?? DEFAULT_POLL_INTERVAL;
  const autoStart = options?.autoStart ?? true;

  const [sessions, setSessions] = useState<ClaudeSession[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollTimerRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);

  // Track mount state to prevent state updates after unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!isMountedRef.current) return;
    setIsLoading(true);
    setError(null);
    try {
      const rawSessions = await detectClaudeSessions();
      if (!isMountedRef.current) return;
      const convertedSessions = rawSessions.map(rawToSession);
      setSessions(convertedSessions);
    } catch (err) {
      if (!isMountedRef.current) return;
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      devLog.error('Failed to detect Claude sessions:', err);
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  const startPolling = useCallback(() => {
    if (pollTimerRef.current) {
      return; // Already polling
    }

    setIsPolling(true);

    // Refresh immediately
    refresh();

    // Then poll at interval
    pollTimerRef.current = window.setInterval(() => {
      refresh();
    }, pollInterval);
  }, [refresh, pollInterval]);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      window.clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    setIsPolling(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) {
        window.clearInterval(pollTimerRef.current);
      }
    };
  }, []);

  // Auto-start polling if enabled
  useEffect(() => {
    if (autoStart) {
      startPolling();
    }

    return () => {
      stopPolling();
    };
  }, [autoStart, startPolling, stopPolling]);

  const activeSessionCount = sessions.filter(s => s.status === 'active').length;

  return {
    sessions,
    isLoading,
    isPolling,
    error,
    refresh,
    startPolling,
    stopPolling,
    activeSessionCount,
  };
}
