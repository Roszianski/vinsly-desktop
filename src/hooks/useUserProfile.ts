import { useCallback, useEffect, useState } from 'react';
import { getStorageItem, setStorageItem } from '../utils/storage';

export interface UseUserProfileResult {
  userDisplayName: string;
  setDisplayName: (name: string) => Promise<void>;
}

export function useUserProfile(): UseUserProfileResult {
  const [userDisplayName, setUserDisplayName] = useState('');

  useEffect(() => {
    const loadDisplayName = async () => {
      const storedName = await getStorageItem<string>('vinsly-display-name');
      if (storedName) {
        setUserDisplayName(storedName);
      }
    };
    loadDisplayName();
  }, []);

  const setDisplayName = useCallback(async (name: string) => {
    const trimmed = name.trim();
    setUserDisplayName(trimmed);
    await setStorageItem('vinsly-display-name', trimmed);
  }, []);

  return {
    userDisplayName,
    setDisplayName,
  };
}
