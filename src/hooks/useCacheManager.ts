import { useCallback, useRef, useEffect } from 'react';
import { getStorageItem, setStorageItem, removeStorageItem } from '../utils/storage';

/**
 * Cache entry with metadata
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl?: number; // Time-to-live in milliseconds
}

/**
 * Cache configuration options
 */
export interface CacheConfig {
  /** Default TTL for cache entries in milliseconds (default: no expiry) */
  defaultTtl?: number;
  /** Whether to persist cache to storage (default: true) */
  persist?: boolean;
  /** Prefix for storage keys (default: 'vinsly-cache') */
  storagePrefix?: string;
}

/**
 * Cache manager interface
 */
export interface CacheManager {
  /** Get a cached value by key */
  get: <T>(key: string) => Promise<T | null>;
  /** Set a cached value with optional TTL override */
  set: <T>(key: string, data: T, ttl?: number) => Promise<void>;
  /** Check if a cache key exists and is valid */
  has: (key: string) => Promise<boolean>;
  /** Invalidate (remove) a single cache key */
  invalidate: (key: string) => Promise<void>;
  /** Invalidate multiple cache keys */
  invalidateMany: (keys: string[]) => Promise<void>;
  /** Invalidate all cache entries matching a pattern */
  invalidatePattern: (pattern: RegExp) => Promise<void>;
  /** Clear all cache entries */
  clear: () => Promise<void>;
  /** Get all cache keys */
  getKeys: () => string[];
  /** Check if cache entry has expired */
  isExpired: (key: string) => Promise<boolean>;
}

/**
 * In-memory cache store for fast access
 */
const memoryCache = new Map<string, CacheEntry<unknown>>();

/**
 * Check if a cache entry has expired
 */
function isEntryExpired(entry: CacheEntry<unknown>): boolean {
  if (!entry.ttl) return false;
  return Date.now() > entry.timestamp + entry.ttl;
}

/**
 * Get the full storage key with prefix
 */
function getStorageKey(prefix: string, key: string): string {
  return `${prefix}:${key}`;
}

/**
 * Custom hook for centralized cache management
 * Provides a consistent API for caching data with optional TTL and persistence
 */
export function useCacheManager(config: CacheConfig = {}): CacheManager {
  const {
    defaultTtl,
    persist = true,
    storagePrefix = 'vinsly-cache',
  } = config;

  // Track registered keys for this manager instance
  const registeredKeys = useRef<Set<string>>(new Set());

  // Cleanup expired entries periodically
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      for (const [key, entry] of memoryCache.entries()) {
        if (isEntryExpired(entry)) {
          memoryCache.delete(key);
        }
      }
    }, 60000); // Clean up every minute

    return () => clearInterval(cleanupInterval);
  }, []);

  const get = useCallback(async <T>(key: string): Promise<T | null> => {
    const fullKey = getStorageKey(storagePrefix, key);

    // Try memory cache first
    const memoryEntry = memoryCache.get(fullKey) as CacheEntry<T> | undefined;
    if (memoryEntry) {
      if (isEntryExpired(memoryEntry)) {
        memoryCache.delete(fullKey);
        if (persist) {
          await removeStorageItem(fullKey);
        }
        return null;
      }
      return memoryEntry.data;
    }

    // Try persistent storage
    if (persist) {
      const storedEntry = await getStorageItem<CacheEntry<T>>(fullKey);
      if (storedEntry) {
        if (isEntryExpired(storedEntry)) {
          await removeStorageItem(fullKey);
          return null;
        }
        // Populate memory cache
        memoryCache.set(fullKey, storedEntry as CacheEntry<unknown>);
        return storedEntry.data;
      }
    }

    return null;
  }, [persist, storagePrefix]);

  const set = useCallback(async <T>(key: string, data: T, ttl?: number): Promise<void> => {
    const fullKey = getStorageKey(storagePrefix, key);
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttl ?? defaultTtl,
    };

    // Update memory cache
    memoryCache.set(fullKey, entry as CacheEntry<unknown>);
    registeredKeys.current.add(fullKey);

    // Persist if enabled
    if (persist) {
      await setStorageItem(fullKey, entry);
    }
  }, [defaultTtl, persist, storagePrefix]);

  const has = useCallback(async (key: string): Promise<boolean> => {
    const result = await get(key);
    return result !== null;
  }, [get]);

  const invalidate = useCallback(async (key: string): Promise<void> => {
    const fullKey = getStorageKey(storagePrefix, key);
    memoryCache.delete(fullKey);
    registeredKeys.current.delete(fullKey);
    if (persist) {
      await removeStorageItem(fullKey);
    }
  }, [persist, storagePrefix]);

  const invalidateMany = useCallback(async (keys: string[]): Promise<void> => {
    await Promise.all(keys.map(key => invalidate(key)));
  }, [invalidate]);

  const invalidatePattern = useCallback(async (pattern: RegExp): Promise<void> => {
    const keysToInvalidate: string[] = [];

    for (const fullKey of memoryCache.keys()) {
      const key = fullKey.replace(`${storagePrefix}:`, '');
      if (pattern.test(key)) {
        keysToInvalidate.push(key);
      }
    }

    await invalidateMany(keysToInvalidate);
  }, [invalidateMany, storagePrefix]);

  const clear = useCallback(async (): Promise<void> => {
    // Clear all keys registered by this manager
    for (const fullKey of registeredKeys.current) {
      memoryCache.delete(fullKey);
      if (persist) {
        await removeStorageItem(fullKey);
      }
    }
    registeredKeys.current.clear();
  }, [persist]);

  const getKeys = useCallback((): string[] => {
    return Array.from(registeredKeys.current).map(
      fullKey => fullKey.replace(`${storagePrefix}:`, '')
    );
  }, [storagePrefix]);

  const isExpired = useCallback(async (key: string): Promise<boolean> => {
    const fullKey = getStorageKey(storagePrefix, key);

    const memoryEntry = memoryCache.get(fullKey);
    if (memoryEntry) {
      return isEntryExpired(memoryEntry);
    }

    if (persist) {
      const storedEntry = await getStorageItem<CacheEntry<unknown>>(fullKey);
      if (storedEntry) {
        return isEntryExpired(storedEntry);
      }
    }

    return true; // Non-existent entries are considered expired
  }, [persist, storagePrefix]);

  return {
    get,
    set,
    has,
    invalidate,
    invalidateMany,
    invalidatePattern,
    clear,
    getKeys,
    isExpired,
  };
}

/**
 * Pre-configured cache keys used throughout the application
 */
export const CACHE_KEYS = {
  AGENTS: 'agents',
  SKILLS: 'skills',
  MEMORIES: 'memories',
  COMMANDS: 'commands',
  SCAN_SETTINGS: 'scan-settings',
  LICENSE_INFO: 'license-info',
  THEME: 'theme',
  USER_PROFILE: 'user-profile',
} as const;

/**
 * Default cache TTLs for different data types (in milliseconds)
 */
export const CACHE_TTLS = {
  /** No expiry for user preferences */
  PREFERENCES: undefined,
  /** 5 minutes for frequently changing data */
  SHORT: 5 * 60 * 1000,
  /** 1 hour for semi-static data */
  MEDIUM: 60 * 60 * 1000,
  /** 24 hours for static data */
  LONG: 24 * 60 * 60 * 1000,
} as const;

/**
 * Create a workspace-specific cache manager
 * This is the primary cache manager for agent/skill data
 */
export function useWorkspaceCache(): CacheManager {
  return useCacheManager({
    storagePrefix: 'vinsly-workspace',
    persist: true,
  });
}

/**
 * Create a session-only cache manager (not persisted)
 * Useful for temporary data that shouldn't survive app restarts
 */
export function useSessionCache(): CacheManager {
  return useCacheManager({
    storagePrefix: 'vinsly-session',
    persist: false,
    defaultTtl: CACHE_TTLS.MEDIUM,
  });
}
