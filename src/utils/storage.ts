import { Store } from '@tauri-apps/plugin-store';
import { devLog } from './devLogger';

let store: Store | null = null;

/**
 * Result type for storage operations.
 * Allows callers to handle errors appropriately.
 */
export interface StorageResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

// Initialize the store
async function getStore(): Promise<Store> {
  if (!store) {
    store = await Store.load('vinsly-settings.json');
  }
  return store;
}

/**
 * Get a value from storage.
 * Returns the value directly for backward compatibility.
 * Use getStorageItemWithResult for explicit error handling.
 */
export async function getStorageItem<T>(key: string, defaultValue?: T): Promise<T | null> {
  try {
    const s = await getStore();
    const value = await s.get<T>(key);
    return value ?? defaultValue ?? null;
  } catch (error) {
    devLog.error(`Error getting storage item ${key}:`, error);
    return defaultValue ?? null;
  }
}

/**
 * Get a value from storage with explicit result handling.
 * Returns a StorageResult with the value or error information.
 */
export async function getStorageItemWithResult<T>(key: string, defaultValue?: T): Promise<StorageResult<T | null>> {
  try {
    const s = await getStore();
    const value = await s.get<T>(key);
    return {
      success: true,
      data: value ?? defaultValue ?? null,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown storage error';
    devLog.error(`Error getting storage item ${key}:`, error);
    return {
      success: false,
      data: defaultValue ?? null,
      error: errorMsg,
    };
  }
}

/**
 * Set a value in storage.
 * Returns void for backward compatibility.
 * Use setStorageItemWithResult for explicit error handling.
 */
export async function setStorageItem<T>(key: string, value: T): Promise<void> {
  try {
    const s = await getStore();
    await s.set(key, value);
    await s.save();
  } catch (error) {
    devLog.error(`Error setting storage item ${key}:`, error);
  }
}

/**
 * Set a value in storage with explicit result handling.
 * Returns a StorageResult indicating success or failure.
 */
export async function setStorageItemWithResult<T>(key: string, value: T): Promise<StorageResult> {
  try {
    const s = await getStore();
    await s.set(key, value);
    await s.save();
    return { success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown storage error';
    devLog.error(`Error setting storage item ${key}:`, error);
    return { success: false, error: errorMsg };
  }
}

/**
 * Remove a value from storage.
 * Returns void for backward compatibility.
 * Use removeStorageItemWithResult for explicit error handling.
 */
export async function removeStorageItem(key: string): Promise<void> {
  try {
    const s = await getStore();
    await s.delete(key);
    await s.save();
  } catch (error) {
    devLog.error(`Error removing storage item ${key}:`, error);
  }
}

/**
 * Remove a value from storage with explicit result handling.
 * Returns a StorageResult indicating success or failure.
 */
export async function removeStorageItemWithResult(key: string): Promise<StorageResult> {
  try {
    const s = await getStore();
    await s.delete(key);
    await s.save();
    return { success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown storage error';
    devLog.error(`Error removing storage item ${key}:`, error);
    return { success: false, error: errorMsg };
  }
}

/**
 * Clear all storage.
 * Returns void for backward compatibility.
 * Use clearStorageWithResult for explicit error handling.
 */
export async function clearStorage(): Promise<void> {
  try {
    const s = await getStore();
    await s.clear();
    await s.save();
  } catch (error) {
    devLog.error('Error clearing storage:', error);
  }
}

/**
 * Clear all storage with explicit result handling.
 * Returns a StorageResult indicating success or failure.
 */
export async function clearStorageWithResult(): Promise<StorageResult> {
  try {
    const s = await getStore();
    await s.clear();
    await s.save();
    return { success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown storage error';
    devLog.error('Error clearing storage:', error);
    return { success: false, error: errorMsg };
  }
}
