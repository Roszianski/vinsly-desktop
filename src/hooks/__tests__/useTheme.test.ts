import { renderHook, act, waitFor } from '@testing-library/react';
import { useTheme } from '../useTheme';
import * as storage from '../../utils/storage';

jest.mock('../../utils/storage', () => ({
  getStorageItem: jest.fn(),
  setStorageItem: jest.fn(),
}));

jest.mock('../../utils/tauriCommands', () => ({
  setTitleBarTheme: jest.fn().mockResolvedValue(undefined),
}));

describe('useTheme', () => {
  let mockMatchMedia: jest.Mock;
  const localStorageMock: Record<string, string> = {};

  beforeEach(() => {
    jest.clearAllMocks();

    // Clear localStorage mock
    Object.keys(localStorageMock).forEach(key => delete localStorageMock[key]);

    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: jest.fn((key: string) => localStorageMock[key] || null),
        setItem: jest.fn((key: string, value: string) => {
          localStorageMock[key] = value;
        }),
        removeItem: jest.fn((key: string) => {
          delete localStorageMock[key];
        }),
        clear: jest.fn(() => {
          Object.keys(localStorageMock).forEach(key => delete localStorageMock[key]);
        }),
      },
      writable: true,
    });

    mockMatchMedia = jest.fn();
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: mockMatchMedia,
    });

    // Default: no saved preferences
    (storage.getStorageItem as jest.Mock).mockResolvedValue(null);
  });

  test('defaults to light theme for new users', async () => {
    mockMatchMedia.mockImplementation((query: string) => ({
      matches: query === '(prefers-color-scheme: dark)',
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }));

    const { result } = renderHook(() => useTheme());
    await waitFor(() => expect(result.current.themeLoaded).toBe(true));
    // New users default to light theme, not system preference
    expect(result.current.theme).toBe('light');
  });

  test('uses system preference when preference is set to system', async () => {
    mockMatchMedia.mockImplementation((query: string) => ({
      matches: query === '(prefers-color-scheme: dark)',
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }));

    (storage.getStorageItem as jest.Mock).mockImplementation((key: string) => {
      if (key === 'vinsly-theme-preference') return Promise.resolve('system');
      return Promise.resolve(null);
    });

    const { result } = renderHook(() => useTheme());
    await waitFor(() => expect(result.current.themeLoaded).toBe(true));
    expect(result.current.theme).toBe('dark');
  });

  test('loads saved theme from storage', async () => {
    (storage.getStorageItem as jest.Mock).mockImplementation((key: string) => {
      if (key === 'vinsly-theme') return Promise.resolve('dark');
      return Promise.resolve(null);
    });
    mockMatchMedia.mockImplementation(() => ({
      matches: false,
      media: '(prefers-color-scheme: dark)',
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }));
    const { result } = renderHook(() => useTheme());
    await waitFor(() => expect(result.current.theme).toBe('dark'));
  });

  test('loads from localStorage cache instantly', async () => {
    // Set cache before hook runs
    localStorageMock['vinsly-theme-cache'] = 'dark';

    mockMatchMedia.mockImplementation(() => ({
      matches: false,
      media: '(prefers-color-scheme: dark)',
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }));

    const { result } = renderHook(() => useTheme());
    // Initial state should be from cache (synchronous)
    expect(result.current.theme).toBe('dark');
  });

  test('toggleTheme switches value and persists', async () => {
    // Start with light theme (default)
    mockMatchMedia.mockImplementation(() => ({
      matches: false,
      media: '(prefers-color-scheme: dark)',
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }));

    const { result } = renderHook(() => useTheme());
    await waitFor(() => expect(result.current.themeLoaded).toBe(true));
    expect(result.current.theme).toBe('light');

    act(() => {
      result.current.toggleTheme();
    });
    expect(result.current.theme).toBe('dark');

    await waitFor(() => {
      expect(storage.setStorageItem).toHaveBeenCalledWith('vinsly-theme', 'dark');
    });
  });
});
