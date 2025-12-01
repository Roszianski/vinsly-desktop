import { useCallback, useEffect, useState } from 'react';
import { AgentScope, ClaudeMemory, ScanSettings } from '../types';
import { readClaudeMemory } from '../utils/tauriCommands';
import { ToastType } from '../components/Toast';

export interface UseClaudeMemoryListOptions {
  showToast: (type: ToastType, message: string) => void;
  scanSettingsRef: React.RefObject<ScanSettings>;
}

export interface UseClaudeMemoryListResult {
  memories: ClaudeMemory[];
  isLoading: boolean;
  loadMemories: () => Promise<void>;
  toggleFavorite: (memory: ClaudeMemory) => void;
}

export function useClaudeMemoryList(options: UseClaudeMemoryListOptions): UseClaudeMemoryListResult {
  const { showToast, scanSettingsRef } = options;
  const [memories, setMemories] = useState<ClaudeMemory[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadMemories = useCallback(async () => {
    setIsLoading(true);
    const discovered: ClaudeMemory[] = [];
    const seenPaths = new Set<string>();

    try {
      // 1. Load global CLAUDE.md
      try {
        const globalResult = await readClaudeMemory('global');
        if (globalResult.exists && !seenPaths.has(globalResult.path)) {
          seenPaths.add(globalResult.path);
          discovered.push({
            id: globalResult.path,
            scope: AgentScope.Global,
            path: globalResult.path,
            content: globalResult.content,
            exists: true,
          });
        }
      } catch (error) {
        console.error('Error loading global CLAUDE.md:', error);
      }

      // 2. Load project CLAUDE.md from watched directories
      const scanSettings = scanSettingsRef.current;
      if (scanSettings?.watchedDirectories) {
        for (const directory of scanSettings.watchedDirectories) {
          try {
            const projectResult = await readClaudeMemory('project', directory);
            if (projectResult.exists && !seenPaths.has(projectResult.path)) {
              seenPaths.add(projectResult.path);
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
            console.debug(`No CLAUDE.md found in ${directory}:`, error);
          }
        }
      }

      // Preserve favorite status from previous state
      setMemories(prev => {
        const prevFavorites = new Map(prev.map(m => [m.path, m.isFavorite]));
        return discovered.map(memory => ({
          ...memory,
          isFavorite: prevFavorites.get(memory.path) || false,
        }));
      });
    } catch (error) {
      console.error('Error discovering CLAUDE.md files:', error);
      showToast('error', 'Failed to load memory files');
    } finally {
      setIsLoading(false);
    }
  }, [scanSettingsRef, showToast]);

  // Load on mount
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
