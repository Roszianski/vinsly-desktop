import { useCallback, useEffect, useRef, useState } from 'react';
import { relaunch } from '@tauri-apps/plugin-process';
import { check, Update } from '@tauri-apps/plugin-updater';
import { PendingUpdateDetails } from '../types/updater';
import { devLog } from '../utils/devLogger';

// Network configuration for update checks
const UPDATE_CHECK_TIMEOUT_MS = 30000; // 30 second timeout per attempt
const UPDATE_MAX_RETRIES = 3;
const UPDATE_INITIAL_RETRY_DELAY_MS = 2000; // 2 seconds, doubles each retry

/**
 * Creates a promise that rejects after the specified timeout.
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(errorMessage));
    }, timeoutMs);

    promise
      .then((result) => {
        clearTimeout(timeoutId);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

/**
 * Sleep utility for retry delays.
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check for updates with retry logic and exponential backoff.
 */
async function checkWithRetry(): Promise<Update | null> {
  let lastError: Error | null = null;
  let delay = UPDATE_INITIAL_RETRY_DELAY_MS;

  for (let attempt = 0; attempt <= UPDATE_MAX_RETRIES; attempt++) {
    try {
      const update = await withTimeout(
        check(),
        UPDATE_CHECK_TIMEOUT_MS,
        'Update check timed out'
      );
      return update;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      devLog.warn(`[Updater] Attempt ${attempt + 1}/${UPDATE_MAX_RETRIES + 1} failed:`, lastError.message);

      // Don't sleep after the last attempt
      if (attempt < UPDATE_MAX_RETRIES) {
        await sleep(delay);
        delay *= 2; // Exponential backoff
      }
    }
  }

  throw lastError ?? new Error('Update check failed after retries');
}

export interface UseUpdaterResult {
  isChecking: boolean;
  isInstalling: boolean;
  pendingUpdate: PendingUpdateDetails | null;
  lastCheckedAt: string | null;
  lastCheckError: string | null;
  checkForUpdate: () => Promise<PendingUpdateDetails | null>;
  installUpdate: () => Promise<void>;
  clearPendingUpdate: () => Promise<void>;
}

export function useUpdater(): UseUpdaterResult {
  const [isChecking, setIsChecking] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [pendingUpdate, setPendingUpdate] = useState<PendingUpdateDetails | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);
  const [lastCheckError, setLastCheckError] = useState<string | null>(null);
  const updateResourceRef = useRef<Update | null>(null);

  const releaseUpdateResource = useCallback(async () => {
    if (updateResourceRef.current) {
      try {
        await updateResourceRef.current.close();
      } catch (error) {
        devLog.warn('Failed to release updater resource', error);
      } finally {
        updateResourceRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    return () => {
      void releaseUpdateResource();
    };
  }, [releaseUpdateResource]);

  const checkForUpdate = useCallback(async () => {
    if (typeof window === 'undefined' || !(window as any).__TAURI__) {
      return null;
    }
    setIsChecking(true);
    setLastCheckError(null);
    try {
      // Check for updates with retry logic and exponential backoff
      const update = await checkWithRetry();
      const checkedAt = new Date().toISOString();
      setLastCheckedAt(checkedAt);

      if (!update) {
        await releaseUpdateResource();
        setPendingUpdate(null);
        return null;
      }

      if (updateResourceRef.current) {
        try {
          await updateResourceRef.current.close();
        } catch (error) {
          devLog.warn('Failed closing previous update resource', error);
        }
      }
      updateResourceRef.current = update;

      const details: PendingUpdateDetails = {
        version: update.version,
        notes: typeof update.body === 'string' ? update.body : undefined,
        date: update.date,
      };
      setPendingUpdate(details);
      return details;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Update check failed';
      devLog.error('Update check failed after all retries:', errorMessage);
      setLastCheckError(errorMessage);
      // Don't throw - return null to indicate no update available
      // This prevents transient network issues from blocking the app
      return null;
    } finally {
      setIsChecking(false);
    }
  }, [releaseUpdateResource]);

  const installUpdate = useCallback(async () => {
    if (!updateResourceRef.current) {
      throw new Error('No update available to install');
    }

    setIsInstalling(true);
    try {
      await updateResourceRef.current.downloadAndInstall();
      await releaseUpdateResource();
      setPendingUpdate(null);
      await relaunch();
    } catch (error) {
      devLog.error('Failed to install update:', error);
      throw error;
    } finally {
      setIsInstalling(false);
    }
  }, [releaseUpdateResource]);

  const clearPendingUpdate = useCallback(async () => {
    await releaseUpdateResource();
    setPendingUpdate(null);
  }, [releaseUpdateResource]);

  return {
    isChecking,
    isInstalling,
    pendingUpdate,
    lastCheckedAt,
    lastCheckError,
    checkForUpdate,
    installUpdate,
    clearPendingUpdate,
  };
}
