import { useCallback, useState, useRef, useEffect } from 'react';
import {
  listHooks,
  addHook as addHookCmd,
  removeHook as removeHookCmd,
  HookInfoRaw,
  HookConfigRaw,
} from '../utils/tauriCommands';
import {
  Hook,
  HookScope,
  HookEventType,
  createHookId,
  hookToConfig,
} from '../types/hooks';
import { ToastType } from '../components/Toast';
import { devLog } from '../utils/devLogger';
import { getStorageItem, setStorageItem } from '../utils/storage';

const HOOKS_CACHE_KEY = 'vinsly-hooks-cache';
const HOOKS_SEEN_KEY = 'vinsly-seen-hook-ids';

/**
 * Convert raw hook info from Rust to Hook type
 */
function rawToHook(raw: HookInfoRaw): Hook {
  return {
    id: raw.id,
    name: raw.name,
    type: raw.event_type as HookEventType,
    matcher: raw.matcher,
    command: raw.command,
    timeout: raw.timeout,
    scope: raw.scope as HookScope,
    sourcePath: raw.source_path,
    enabled: raw.enabled,
  };
}

/**
 * Convert Hook to raw config for Rust
 */
function hookToRawConfig(hook: Hook): HookConfigRaw {
  const config = hookToConfig(hook);
  return {
    type: config.type,
    matcher: config.matcher,
    command: config.command,
    timeout: config.timeout,
  };
}

export interface UseHooksOptions {
  showToast: (type: ToastType, message: string) => void;
}

export interface LoadHooksOptions {
  projectPaths?: string[];
  includeGlobal?: boolean;
}

export interface UseHooksResult {
  hooks: Hook[];
  hooksRef: React.RefObject<Hook[]>;
  isLoading: boolean;
  loadHooks: (options?: LoadHooksOptions) => Promise<{ total: number; newCount: number }>;
  addHook: (hook: Hook, projectPath?: string) => Promise<void>;
  updateHook: (hook: Hook, oldHook: Hook, projectPath?: string) => Promise<void>;
  removeHook: (hook: Hook, projectPath?: string) => Promise<void>;
  toggleFavorite: (hook: Hook) => void;
  getHookById: (id: string) => Hook | undefined;
  getHooksByType: (type: HookEventType) => Hook[];
}

export function useHooks({ showToast }: UseHooksOptions): UseHooksResult {
  const [hooks, setHooks] = useState<Hook[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCacheReady, setIsCacheReady] = useState(false);
  const hooksRef = useRef<Hook[]>([]);
  const cacheHydrated = useRef(false);

  // Keep ref in sync with state
  hooksRef.current = hooks;

  // Hydrate from cache on mount
  useEffect(() => {
    if (cacheHydrated.current) return;

    const hydrateCache = async () => {
      try {
        const cached = await getStorageItem<Hook[]>(HOOKS_CACHE_KEY);
        if (cached && cached.length > 0 && hooksRef.current.length === 0) {
          setHooks(cached);
        }
      } catch (error) {
        devLog.error('Failed to hydrate hooks cache:', error);
      } finally {
        cacheHydrated.current = true;
        setIsCacheReady(true);
      }
    };

    void hydrateCache();
  }, []);

  // Persist to cache when hooks change
  useEffect(() => {
    if (!isCacheReady) return;
    setStorageItem(HOOKS_CACHE_KEY, hooks);
  }, [hooks, isCacheReady]);

  const loadHooks = useCallback(async (options: LoadHooksOptions = {}): Promise<{ total: number; newCount: number }> => {
    const { projectPaths = [], includeGlobal = true } = options;
    setIsLoading(true);
    try {
      const allHooks: Hook[] = [];
      const currentIds = new Set<string>();

      const addHook = (hook: Hook) => {
        if (currentIds.has(hook.id)) return;
        currentIds.add(hook.id);
        allHooks.push(hook);
      };

      // Load global hooks
      if (includeGlobal) {
        const globalHooks = await listHooks();
        for (const raw of globalHooks) {
          addHook(rawToHook(raw));
        }
      }

      // Load project-specific hooks
      for (const projectPath of projectPaths) {
        try {
          const projectHooks = await listHooks(projectPath);
          for (const raw of projectHooks) {
            addHook(rawToHook(raw));
          }
        } catch (error) {
          devLog.error(`Error loading hooks from ${projectPath}:`, error);
        }
      }

      // Track new items by comparing with previously seen IDs
      let seenIds: string[] = [];
      try {
        seenIds = await getStorageItem<string[]>(HOOKS_SEEN_KEY) || [];
      } catch {
        seenIds = [];
      }
      const seenSet = new Set(seenIds);
      const newCount = allHooks.filter(h => !seenSet.has(h.id)).length;

      // Update seen IDs with all current hook IDs
      const updatedSeenIds = Array.from(new Set([...seenIds, ...allHooks.map(h => h.id)]));
      await setStorageItem(HOOKS_SEEN_KEY, updatedSeenIds);

      setHooks(allHooks);
      return { total: allHooks.length, newCount };
    } catch (error) {
      devLog.error('Failed to load hooks:', error);
      showToast('error', `Failed to load hooks: ${error}`);
      return { total: 0, newCount: 0 };
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  const addHookFn = useCallback(async (hook: Hook, projectPath?: string) => {
    try {
      const rawConfig = hookToRawConfig(hook);
      await addHookCmd(hook.scope, hook.type, rawConfig, projectPath);

      // Add to local state with a generated ID
      const newHook: Hook = {
        ...hook,
        id: createHookId(hook.name, hook.scope, hooks.length),
      };

      setHooks(prev => [...prev, newHook]);
      showToast('success', `Added hook "${hook.name}"`);
    } catch (error) {
      devLog.error('Failed to add hook:', error);
      showToast('error', `Failed to add hook: ${error}`);
      throw error;
    }
  }, [showToast, hooks.length]);

  const updateHook = useCallback(async (
    hook: Hook,
    oldHook: Hook,
    projectPath?: string
  ) => {
    try {
      // Find the index of the old hook in its event type group
      const hooksOfType = hooksRef.current.filter(
        h => h.type === oldHook.type && h.scope === oldHook.scope
      );
      const hookIndex = hooksOfType.findIndex(h => h.id === oldHook.id);

      if (hookIndex === -1) {
        throw new Error('Hook not found');
      }

      // Remove old hook
      await removeHookCmd(oldHook.scope, oldHook.type, hookIndex, projectPath);

      // Add new hook
      const rawConfig = hookToRawConfig(hook);
      await addHookCmd(hook.scope, hook.type, rawConfig, projectPath);

      // Update local state
      setHooks(prev => {
        const filtered = prev.filter(h => h.id !== oldHook.id);
        return [...filtered, hook];
      });

      showToast('success', `Updated hook "${hook.name}"`);
    } catch (error) {
      devLog.error('Failed to update hook:', error);
      showToast('error', `Failed to update hook: ${error}`);
      throw error;
    }
  }, [showToast]);

  const removeHookFn = useCallback(async (hook: Hook, projectPath?: string) => {
    try {
      // Find the index of the hook in its event type group
      const hooksOfType = hooksRef.current.filter(
        h => h.type === hook.type && h.scope === hook.scope
      );
      const hookIndex = hooksOfType.findIndex(h => h.id === hook.id);

      if (hookIndex === -1) {
        throw new Error('Hook not found');
      }

      await removeHookCmd(hook.scope, hook.type, hookIndex, projectPath);

      // Remove from local state
      setHooks(prev => prev.filter(h => h.id !== hook.id));
      showToast('success', `Removed hook "${hook.name}"`);
    } catch (error) {
      devLog.error('Failed to remove hook:', error);
      showToast('error', `Failed to remove hook: ${error}`);
      throw error;
    }
  }, [showToast]);

  const toggleFavorite = useCallback((hook: Hook) => {
    setHooks(prev =>
      prev.map(h =>
        h.id === hook.id ? { ...h, isFavorite: !h.isFavorite } : h
      )
    );
  }, []);

  const getHookById = useCallback((id: string): Hook | undefined => {
    return hooksRef.current.find(h => h.id === id);
  }, []);

  const getHooksByType = useCallback((type: HookEventType): Hook[] => {
    return hooksRef.current.filter(h => h.type === type);
  }, []);

  return {
    hooks,
    hooksRef,
    isLoading,
    loadHooks,
    addHook: addHookFn,
    updateHook,
    removeHook: removeHookFn,
    toggleFavorite,
    getHookById,
    getHooksByType,
  };
}
