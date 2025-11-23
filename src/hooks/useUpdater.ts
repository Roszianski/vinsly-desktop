import { useCallback, useEffect, useRef, useState } from 'react';
import { relaunch } from '@tauri-apps/plugin-process';
import { check, Update } from '@tauri-apps/plugin-updater';
import { PendingUpdateDetails } from '../types/updater';

export interface UseUpdaterResult {
  isChecking: boolean;
  isInstalling: boolean;
  pendingUpdate: PendingUpdateDetails | null;
  lastCheckedAt: string | null;
  checkForUpdate: () => Promise<PendingUpdateDetails | null>;
  installUpdate: () => Promise<void>;
  clearPendingUpdate: () => Promise<void>;
}

export function useUpdater(): UseUpdaterResult {
  const [isChecking, setIsChecking] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [pendingUpdate, setPendingUpdate] = useState<PendingUpdateDetails | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);
  const updateResourceRef = useRef<Update | null>(null);

  const releaseUpdateResource = useCallback(async () => {
    if (updateResourceRef.current) {
      try {
        await updateResourceRef.current.close();
      } catch (error) {
        console.warn('Failed to release updater resource', error);
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
    try {
      const update = await check();
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
          console.warn('Failed closing previous update resource', error);
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
      console.error('Update check failed:', error);
      throw error;
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
      console.error('Failed to install update:', error);
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
    checkForUpdate,
    installUpdate,
    clearPendingUpdate,
  };
}
