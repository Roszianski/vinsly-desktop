import { renderHook, waitFor, act } from '@testing-library/react';
import { useUserProfile } from '../useUserProfile';
import * as storage from '../../utils/storage';

jest.mock('../../utils/storage', () => ({
  getStorageItem: jest.fn(),
  setStorageItem: jest.fn(),
}));

describe('useUserProfile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (storage.getStorageItem as jest.Mock).mockResolvedValue(null);
  });

  test('loads stored display name', async () => {
    (storage.getStorageItem as jest.Mock).mockResolvedValue('Alice');
    const { result } = renderHook(() => useUserProfile());
    await waitFor(() => expect(result.current.userDisplayName).toBe('Alice'));
  });

  test('sets and persists trimmed display name', async () => {
    const { result } = renderHook(() => useUserProfile());
    await act(async () => {
      await result.current.setDisplayName('  Bob  ');
    });
    expect(result.current.userDisplayName).toBe('Bob');
    expect(storage.setStorageItem).toHaveBeenCalledWith('vinsly-display-name', 'Bob');
  });
});
