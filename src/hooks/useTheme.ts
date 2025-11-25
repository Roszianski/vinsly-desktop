import { useState, useEffect, useRef } from 'react';
import { getStorageItem, setStorageItem } from '../utils/storage';

export type Theme = 'light' | 'dark';

/**
 * Result interface for the useTheme hook
 */
export interface UseThemeResult {
  theme: Theme;
  themeLoaded: boolean;
  setThemeMode: (mode: Theme) => void;
  toggleTheme: () => void;
  getSystemTheme: () => Theme;
}

const getInitialTheme = (): Theme => {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'dark';
};

/**
 * Custom hook for managing theme state with persistence and system preference detection
 *
 * @returns UseThemeResult object containing theme state and control functions
 */
export function useTheme(): UseThemeResult {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [themeLoaded, setThemeLoaded] = useState(false);
  const themeResolvedRef = useRef(false);

  const getSystemTheme = (): Theme => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'dark';
  };

  const setThemeMode = (mode: Theme) => {
    setThemeLoaded(true);
    setTheme(mode);
  };

  const toggleTheme = () => {
    themeResolvedRef.current = true;
    setThemeMode(theme === 'dark' ? 'light' : 'dark');
  };

  // Load theme preference from storage on mount
  useEffect(() => {
    const loadTheme = async () => {
      if (themeResolvedRef.current) return;
      const savedPreference = await getStorageItem<'system' | Theme>('vinsly-theme-preference');
      const systemTheme = getSystemTheme();

      if (savedPreference) {
        const initialTheme = savedPreference === 'system' ? systemTheme : savedPreference;
        if (themeResolvedRef.current) return;
        themeResolvedRef.current = true;
        setThemeMode(initialTheme);
        return;
      }

      const savedTheme = await getStorageItem<Theme>('vinsly-theme');
      const fallbackTheme = savedTheme || systemTheme;
      if (themeResolvedRef.current) return;
      themeResolvedRef.current = true;
      setThemeMode(fallbackTheme);
    };

    loadTheme();
  }, []);

  // Apply theme to DOM and persist to storage
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove(theme === 'dark' ? 'light' : 'dark');
    root.classList.add(theme);
    if (themeLoaded) {
      setStorageItem('vinsly-theme', theme);
    }
  }, [theme, themeLoaded]);

  return {
    theme,
    themeLoaded,
    setThemeMode,
    toggleTheme,
    getSystemTheme,
  };
}
