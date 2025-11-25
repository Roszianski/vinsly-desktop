import { renderHook, act, waitFor } from '@testing-library/react';
import { useTheme } from '../useTheme';
import * as storage from '../../utils/storage';

jest.mock('../../utils/storage', () => ({
  getStorageItem: jest.fn(),
  setStorageItem: jest.fn(),
}));

describe('useTheme', () => {
  let mockMatchMedia: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockMatchMedia = jest.fn();
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: mockMatchMedia,
    });
    (storage.getStorageItem as jest.Mock).mockResolvedValue(null);
  });

  test('initializes from system preference', async () => {
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
    expect(result.current.theme).toBe('dark');
  });

  test('loads saved theme from storage', async () => {
    (storage.getStorageItem as jest.Mock).mockImplementation((key: string) => {
      if (key === 'vinsly-theme') return Promise.resolve('light');
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
    await waitFor(() => expect(result.current.theme).toBe('light'));
  });

  test('toggleTheme switches value and persists', async () => {
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

    act(() => {
      result.current.toggleTheme();
    });
    expect(result.current.theme).toBe('light');

    await waitFor(() => {
      expect(storage.setStorageItem).toHaveBeenCalledWith('vinsly-theme', 'light');
    });
  });
});
