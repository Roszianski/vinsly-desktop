import {
  getStorageItem,
  getStorageItemWithResult,
  setStorageItem,
  setStorageItemWithResult,
  removeStorageItem,
  removeStorageItemWithResult,
  clearStorage,
  clearStorageWithResult,
} from '../storage';

// Mock the Tauri store plugin
const mockStore = {
  get: jest.fn(),
  set: jest.fn(),
  delete: jest.fn(),
  clear: jest.fn(),
  save: jest.fn(),
};

jest.mock('@tauri-apps/plugin-store', () => ({
  Store: {
    load: jest.fn(() => Promise.resolve(mockStore)),
  },
}));

describe('storage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStore.get.mockResolvedValue(undefined);
    mockStore.set.mockResolvedValue(undefined);
    mockStore.delete.mockResolvedValue(undefined);
    mockStore.clear.mockResolvedValue(undefined);
    mockStore.save.mockResolvedValue(undefined);
  });

  describe('getStorageItem', () => {
    it('returns stored value', async () => {
      mockStore.get.mockResolvedValue('test-value');
      const result = await getStorageItem('test-key');
      expect(result).toBe('test-value');
      expect(mockStore.get).toHaveBeenCalledWith('test-key');
    });

    it('returns default value when key not found', async () => {
      mockStore.get.mockResolvedValue(undefined);
      const result = await getStorageItem('missing-key', 'default');
      expect(result).toBe('default');
    });

    it('returns null when no value and no default', async () => {
      mockStore.get.mockResolvedValue(undefined);
      const result = await getStorageItem('missing-key');
      expect(result).toBeNull();
    });

    it('returns default value on error', async () => {
      mockStore.get.mockRejectedValue(new Error('Storage error'));
      const result = await getStorageItem('test-key', 'fallback');
      expect(result).toBe('fallback');
    });

    it('returns null on error when no default', async () => {
      mockStore.get.mockRejectedValue(new Error('Storage error'));
      const result = await getStorageItem('test-key');
      expect(result).toBeNull();
    });

    it('handles complex object values', async () => {
      const complexValue = { nested: { data: [1, 2, 3] }, flag: true };
      mockStore.get.mockResolvedValue(complexValue);
      const result = await getStorageItem('complex-key');
      expect(result).toEqual(complexValue);
    });
  });

  describe('getStorageItemWithResult', () => {
    it('returns success with stored value', async () => {
      mockStore.get.mockResolvedValue('test-value');
      const result = await getStorageItemWithResult('test-key');
      expect(result.success).toBe(true);
      expect(result.data).toBe('test-value');
      expect(result.error).toBeUndefined();
    });

    it('returns success with default when key not found', async () => {
      mockStore.get.mockResolvedValue(undefined);
      const result = await getStorageItemWithResult('missing-key', 'default');
      expect(result.success).toBe(true);
      expect(result.data).toBe('default');
    });

    it('returns success with null when no value and no default', async () => {
      mockStore.get.mockResolvedValue(undefined);
      const result = await getStorageItemWithResult('missing-key');
      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });

    it('returns failure with error message on error', async () => {
      mockStore.get.mockRejectedValue(new Error('Storage read failed'));
      const result = await getStorageItemWithResult('test-key');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Storage read failed');
      expect(result.data).toBeNull();
    });

    it('returns default value even on error', async () => {
      mockStore.get.mockRejectedValue(new Error('Storage error'));
      const result = await getStorageItemWithResult('test-key', 'fallback');
      expect(result.success).toBe(false);
      expect(result.data).toBe('fallback');
    });

    it('handles non-Error exceptions', async () => {
      mockStore.get.mockRejectedValue('string error');
      const result = await getStorageItemWithResult('test-key');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown storage error');
    });
  });

  describe('setStorageItem', () => {
    it('sets value and saves', async () => {
      await setStorageItem('test-key', 'test-value');
      expect(mockStore.set).toHaveBeenCalledWith('test-key', 'test-value');
      expect(mockStore.save).toHaveBeenCalled();
    });

    it('handles complex object values', async () => {
      const complexValue = { nested: { data: [1, 2, 3] } };
      await setStorageItem('complex-key', complexValue);
      expect(mockStore.set).toHaveBeenCalledWith('complex-key', complexValue);
    });

    it('does not throw on error', async () => {
      mockStore.set.mockRejectedValue(new Error('Write failed'));
      await expect(setStorageItem('test-key', 'value')).resolves.toBeUndefined();
    });
  });

  describe('setStorageItemWithResult', () => {
    it('returns success on successful set', async () => {
      const result = await setStorageItemWithResult('test-key', 'test-value');
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
      expect(mockStore.set).toHaveBeenCalledWith('test-key', 'test-value');
      expect(mockStore.save).toHaveBeenCalled();
    });

    it('returns failure with error message on error', async () => {
      mockStore.set.mockRejectedValue(new Error('Write failed'));
      const result = await setStorageItemWithResult('test-key', 'value');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Write failed');
    });

    it('returns failure when save fails', async () => {
      mockStore.save.mockRejectedValue(new Error('Save failed'));
      const result = await setStorageItemWithResult('test-key', 'value');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Save failed');
    });

    it('handles non-Error exceptions', async () => {
      mockStore.set.mockRejectedValue({ custom: 'error' });
      const result = await setStorageItemWithResult('test-key', 'value');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown storage error');
    });
  });

  describe('removeStorageItem', () => {
    it('deletes key and saves', async () => {
      await removeStorageItem('test-key');
      expect(mockStore.delete).toHaveBeenCalledWith('test-key');
      expect(mockStore.save).toHaveBeenCalled();
    });

    it('does not throw on error', async () => {
      mockStore.delete.mockRejectedValue(new Error('Delete failed'));
      await expect(removeStorageItem('test-key')).resolves.toBeUndefined();
    });
  });

  describe('removeStorageItemWithResult', () => {
    it('returns success on successful remove', async () => {
      const result = await removeStorageItemWithResult('test-key');
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
      expect(mockStore.delete).toHaveBeenCalledWith('test-key');
      expect(mockStore.save).toHaveBeenCalled();
    });

    it('returns failure with error message on error', async () => {
      mockStore.delete.mockRejectedValue(new Error('Delete failed'));
      const result = await removeStorageItemWithResult('test-key');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Delete failed');
    });

    it('returns failure when save fails', async () => {
      mockStore.save.mockRejectedValue(new Error('Save failed'));
      const result = await removeStorageItemWithResult('test-key');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Save failed');
    });
  });

  describe('clearStorage', () => {
    it('clears store and saves', async () => {
      await clearStorage();
      expect(mockStore.clear).toHaveBeenCalled();
      expect(mockStore.save).toHaveBeenCalled();
    });

    it('does not throw on error', async () => {
      mockStore.clear.mockRejectedValue(new Error('Clear failed'));
      await expect(clearStorage()).resolves.toBeUndefined();
    });
  });

  describe('clearStorageWithResult', () => {
    it('returns success on successful clear', async () => {
      const result = await clearStorageWithResult();
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
      expect(mockStore.clear).toHaveBeenCalled();
      expect(mockStore.save).toHaveBeenCalled();
    });

    it('returns failure with error message on error', async () => {
      mockStore.clear.mockRejectedValue(new Error('Clear failed'));
      const result = await clearStorageWithResult();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Clear failed');
    });

    it('returns failure when save fails', async () => {
      mockStore.save.mockRejectedValue(new Error('Save failed'));
      const result = await clearStorageWithResult();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Save failed');
    });
  });

});
