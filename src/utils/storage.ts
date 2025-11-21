import { Store } from '@tauri-apps/plugin-store';

let store: Store | null = null;

// Initialize the store
async function getStore(): Promise<Store> {
  if (!store) {
    store = await Store.load('vinsly-settings.json');
  }
  return store;
}

// Get a value from storage
export async function getStorageItem<T>(key: string, defaultValue?: T): Promise<T | null> {
  try {
    const s = await getStore();
    const value = await s.get<T>(key);
    return value ?? defaultValue ?? null;
  } catch (error) {
    console.error(`Error getting storage item ${key}:`, error);
    return defaultValue ?? null;
  }
}

// Set a value in storage
export async function setStorageItem<T>(key: string, value: T): Promise<void> {
  try {
    const s = await getStore();
    await s.set(key, value);
    await s.save();
  } catch (error) {
    console.error(`Error setting storage item ${key}:`, error);
  }
}

// Remove a value from storage
export async function removeStorageItem(key: string): Promise<void> {
  try {
    const s = await getStore();
    await s.delete(key);
    await s.save();
  } catch (error) {
    console.error(`Error removing storage item ${key}:`, error);
  }
}

// Clear all storage
export async function clearStorage(): Promise<void> {
  try {
    const s = await getStore();
    await s.clear();
    await s.save();
  } catch (error) {
    console.error('Error clearing storage:', error);
  }
}
