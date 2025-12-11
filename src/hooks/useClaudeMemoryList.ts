import { useCallback, useEffect, useState, useRef } from 'react';
import { AgentScope, ClaudeMemory, ScanSettings } from '../types';
import { readClaudeMemory } from '../utils/tauriCommands';
import { ToastType } from '../components/Toast';
import { devLog } from '../utils/devLogger';
import { getStorageItem, setStorageItem } from '../utils/storage';

const MEMORIES_CACHE_KEY = 'vinsly-memories-cache';
const MEMORIES_SEEN_KEY = 'vinsly-seen-memory-ids';

export interface UseClaudeMemoryListOptions {
  showToast: (type: ToastType, message: string) => void;
  scanSettingsRef: React.RefObject<ScanSettings>;
}

export interface LoadMemoriesOptions {
  projectPaths?: string[];
  includeGlobal?: boolean;
}

export interface UseClaudeMemoryListResult {
  memories: ClaudeMemory[];
  isLoading: boolean;
  loadMemories: (options?: LoadMemoriesOptions) => Promise<{ total: number; newCount: number }>;
  toggleFavorite: (memory: ClaudeMemory) => void;
}

export function useClaudeMemoryList(options: UseClaudeMemoryListOptions): UseClaudeMemoryListResult {
  const { showToast, scanSettingsRef } = options;
  const [memories, setMemories] = useState<ClaudeMemory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCacheReady, setIsCacheReady] = useState(false);
  const cacheHydrated = useRef(false);
  const memoriesRef = useRef<ClaudeMemory[]>([]);

  // Keep ref in sync with state
  memoriesRef.current = memories;

  // Hydrate from cache on mount
  useEffect(() => {
    if (cacheHydrated.current) return;

    const hydrateCache = async () => {
      try {
        const cached = await getStorageItem<ClaudeMemory[]>(MEMORIES_CACHE_KEY);
        if (cached && cached.length > 0 && memoriesRef.current.length === 0) {
          setMemories(cached);
        }
      } catch (error) {
        devLog.error('Failed to hydrate memories cache:', error);
      } finally {
        cacheHydrated.current = true;
        setIsCacheReady(true);
      }
    };

    void hydrateCache();
  }, []);

  // Persist to cache when memories change
  useEffect(() => {
    if (!isCacheReady) return;
    setStorageItem(MEMORIES_CACHE_KEY, memories);
  }, [memories, isCacheReady]);

  const loadMemories = useCallback(async (loadOptions: LoadMemoriesOptions = {}): Promise<{ total: number; newCount: number }> => {
    const { projectPaths = [], includeGlobal = true } = loadOptions;
    setIsLoading(true);
    const discovered: ClaudeMemory[] = [];
    const currentPaths = new Set<string>();

    try {
      // 1. Load global CLAUDE.md
      if (includeGlobal) {
        try {
          const globalResult = await readClaudeMemory('global');
          if (globalResult.exists && !currentPaths.has(globalResult.path)) {
            currentPaths.add(globalResult.path);
            discovered.push({
              id: globalResult.path,
              scope: AgentScope.Global,
              path: globalResult.path,
              content: globalResult.content,
              exists: true,
            });
          }
        } catch (error) {
          devLog.error('Error loading global CLAUDE.md:', error);
        }
      }

      // 2. Combine project paths from options and watched directories
      const scanSettings = scanSettingsRef.current;
      const allProjectPaths = new Set([
        ...projectPaths,
        ...(scanSettings?.watchedDirectories || []),
      ]);

      // 3. Load project CLAUDE.md from all project paths
      for (const directory of allProjectPaths) {
        try {
          const projectResult = await readClaudeMemory('project', directory);
          if (projectResult.exists && !currentPaths.has(projectResult.path)) {
            currentPaths.add(projectResult.path);
            discovered.push({
              id: projectResult.path,
              scope: AgentScope.Project,
              path: projectResult.path,
              content: projectResult.content,
              exists: true,
            });
          }
        } catch (error) {
          // Silently skip directories that don't have CLAUDE.md
          devLog.debug(`No CLAUDE.md found in ${directory}:`, error);
        }
      }

      // Track new items by comparing with previously seen IDs
      let seenIds: string[] = [];
      try {
        seenIds = await getStorageItem<string[]>(MEMORIES_SEEN_KEY) || [];
      } catch {
        seenIds = [];
      }
      const seenSet = new Set(seenIds);
      const newCount = discovered.filter(m => !seenSet.has(m.id)).length;

      // Update seen IDs with all current memory IDs
      const updatedSeenIds = Array.from(new Set([...seenIds, ...discovered.map(m => m.id)]));
      await setStorageItem(MEMORIES_SEEN_KEY, updatedSeenIds);

      // Preserve favorite status from previous state
      setMemories(prev => {
        const prevFavorites = new Map(prev.map(m => [m.path, m.isFavorite]));
        return discovered.map(memory => ({
          ...memory,
          isFavorite: prevFavorites.get(memory.path) || false,
        }));
      });

      return { total: discovered.length, newCount };
    } catch (error) {
      devLog.error('Error discovering CLAUDE.md files:', error);
      showToast('error', 'Failed to load memory files');
      return { total: 0, newCount: 0 };
    } finally {
      setIsLoading(false);
    }
  }, [scanSettingsRef, showToast]);

  // Load on mount (but don't block on it - cache provides instant data)
  useEffect(() => {
    void loadMemories();
  }, [loadMemories]);

  const toggleFavorite = useCallback((memoryToToggle: ClaudeMemory) => {
    setMemories(prev =>
      prev.map(memory => {
        if (memory.path === memoryToToggle.path) {
          return {
            ...memory,
            isFavorite: !memory.isFavorite,
          };
        }
        return memory;
      })
    );
  }, []);

  return {
    memories,
    isLoading,
    loadMemories,
    toggleFavorite,
  };
}
