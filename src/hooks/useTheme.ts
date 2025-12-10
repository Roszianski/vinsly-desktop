import { useState, useEffect, useRef } from 'react';
import { getStorageItem, setStorageItem } from '../utils/storage';
import { setTitleBarTheme } from '../utils/tauriCommands';

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

// localStorage key for theme cache (read synchronously in index.html to prevent flash)
const THEME_CACHE_KEY = 'vinsly-theme-cache';

// Read from localStorage cache first (set by index.html script), fallback to 'light'
const getInitialTheme = (): Theme => {
  if (typeof window !== 'undefined') {
    const cached = localStorage.getItem(THEME_CACHE_KEY);
    if (cached === 'light' || cached === 'dark') {
      return cached;
    }
  }
  return 'light';
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
        // Write to localStorage cache for instant access on next load
        localStorage.setItem(THEME_CACHE_KEY, initialTheme);
        setThemeMode(initialTheme);
        return;
      }

      const savedTheme = await getStorageItem<Theme>('vinsly-theme');
      // Default to light mode for new users
      const fallbackTheme = savedTheme || 'light';
      if (themeResolvedRef.current) return;
      themeResolvedRef.current = true;
      // Write to localStorage cache for instant access on next load
      localStorage.setItem(THEME_CACHE_KEY, fallbackTheme);
      setThemeMode(fallbackTheme);
    };

    loadTheme();
  }, []);

  // Apply theme to DOM, update title bar, and persist to storage
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove(theme === 'dark' ? 'light' : 'dark');
    root.classList.add(theme);
    // Update macOS title bar appearance to match theme
    setTitleBarTheme(theme === 'dark').catch(() => {
      // Silently ignore errors (e.g., on non-macOS platforms)
    });
    if (themeLoaded) {
      setStorageItem('vinsly-theme', theme);
      // Also save to localStorage cache for instant access on next load
      localStorage.setItem(THEME_CACHE_KEY, theme);
      // Note: Disk cache for Rust is written automatically by setTitleBarTheme
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
