import { useCallback, useEffect, useRef, useState } from 'react';
import { AgentScope, ClaudeMemory } from '../types';
import { readClaudeMemory, writeClaudeMemory } from '../utils/tauriCommands';
import { ToastType } from '../components/Toast';
import { devLog } from '../utils/devLogger';

export interface UseClaudeMemoryOptions {
  showToast: (type: ToastType, message: string) => void;
  projectPath?: string;
}

export interface UseClaudeMemoryResult {
  globalMemory: ClaudeMemory | null;
  projectMemory: ClaudeMemory | null;
  isLoading: boolean;
  activeScope: AgentScope;
  setActiveScope: (scope: AgentScope) => void;
  loadMemory: (scope?: AgentScope, dynamicProjectPath?: string) => Promise<void>;
  saveMemory: (scope: AgentScope, content: string, dynamicProjectPath?: string) => Promise<void>;
  currentMemory: ClaudeMemory | null;
}

export function useClaudeMemory(options: UseClaudeMemoryOptions): UseClaudeMemoryResult {
  const { showToast, projectPath } = options;

  const [globalMemory, setGlobalMemory] = useState<ClaudeMemory | null>(null);
  const [projectMemory, setProjectMemory] = useState<ClaudeMemory | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeScope, setActiveScope] = useState<AgentScope>(AgentScope.Global);

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedContentRef = useRef<{ global: string; project: string }>({
    global: '',
    project: '',
  });

  // Load memory files on mount and when project path changes
  useEffect(() => {
    const loadBoth = async () => {
      setIsLoading(true);
      try {
        // Load global memory
        const globalResult = await readClaudeMemory('global');
        const globalMem: ClaudeMemory = {
          id: 'global',
          scope: AgentScope.Global,
          path: globalResult.path,
          content: globalResult.content,
          exists: globalResult.exists,
        };
        setGlobalMemory(globalMem);
        lastSavedContentRef.current.global = globalResult.content;

        // Load project memory if project path is set
        if (projectPath) {
          const projectResult = await readClaudeMemory('project', projectPath);
          const projectMem: ClaudeMemory = {
            id: 'project',
            scope: AgentScope.Project,
            path: projectResult.path,
            content: projectResult.content,
            exists: projectResult.exists,
          };
          setProjectMemory(projectMem);
          lastSavedContentRef.current.project = projectResult.content;
        } else {
          setProjectMemory(null);
        }
      } catch (error) {
        devLog.error('Error loading CLAUDE.md files:', error);
        showToast('error', 'Failed to load memory files');
      } finally {
        setIsLoading(false);
      }
    };

    void loadBoth();
  }, [projectPath, showToast]);

  const loadMemory = useCallback(async (scope?: AgentScope, dynamicProjectPath?: string) => {
    const effectiveProjectPath = dynamicProjectPath || projectPath;
    setIsLoading(true);
    try {
      if (!scope || scope === AgentScope.Global) {
        const globalResult = await readClaudeMemory('global');
        const globalMem: ClaudeMemory = {
          id: 'global',
          scope: AgentScope.Global,
          path: globalResult.path,
          content: globalResult.content,
          exists: globalResult.exists,
        };
        setGlobalMemory(globalMem);
        lastSavedContentRef.current.global = globalResult.content;
      }

      if ((!scope || scope === AgentScope.Project) && effectiveProjectPath) {
        const projectResult = await readClaudeMemory('project', effectiveProjectPath);
        const projectMem: ClaudeMemory = {
          id: 'project',
          scope: AgentScope.Project,
          path: projectResult.path,
          content: projectResult.content,
          exists: projectResult.exists,
        };
        setProjectMemory(projectMem);
        lastSavedContentRef.current.project = projectResult.content;
      }
    } catch (error) {
      devLog.error('Error loading CLAUDE.md:', error);
      showToast('error', 'Failed to load memory file');
    } finally {
      setIsLoading(false);
    }
  }, [projectPath, showToast]);

  const saveMemory = useCallback(async (scope: AgentScope, content: string, dynamicProjectPath?: string) => {
    // Cancel any pending save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    const scopeKey = scope === AgentScope.Global ? 'global' : 'project';

    // Skip if content hasn't changed
    if (lastSavedContentRef.current[scopeKey] === content) {
      return;
    }

    try {
      const tauriScope = scope === AgentScope.Global ? 'global' : 'project';
      const effectiveProjectPath = dynamicProjectPath || projectPath;
      const pathArg = scope === AgentScope.Project ? effectiveProjectPath : undefined;

      const savedPath = await writeClaudeMemory(tauriScope, content, pathArg);
      lastSavedContentRef.current[scopeKey] = content;

      // Update state
      const updatedMemory: ClaudeMemory = {
        id: scopeKey,
        scope,
        path: savedPath,
        content,
        exists: true,
      };

      if (scope === AgentScope.Global) {
        setGlobalMemory(updatedMemory);
      } else {
        setProjectMemory(updatedMemory);
      }

      showToast('success', 'Memory saved');
    } catch (error) {
      devLog.error('Error saving CLAUDE.md:', error);
      showToast('error', `Failed to save memory: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [projectPath, showToast]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  const currentMemory = activeScope === AgentScope.Global ? globalMemory : projectMemory;

  return {
    globalMemory,
    projectMemory,
    isLoading,
    activeScope,
    setActiveScope,
    loadMemory,
    saveMemory,
    currentMemory,
  };
}
