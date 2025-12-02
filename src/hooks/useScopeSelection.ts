/**
 * Shared hook for scope selection with project folder picker
 * Used by AgentEditorScreen, SkillEditorScreen, and SlashCommandEditorScreen
 */

import { useState, useCallback, useMemo } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { AgentScope } from '../types';

export interface UseScopeSelectionOptions {
  /** Initial scope value */
  initialScope: AgentScope;
  /** Initial project folder path (for editing existing project-scoped items) */
  initialProjectPath?: string;
  /** Callback when scope changes */
  onScopeChange?: (scope: AgentScope) => void;
  /** Callback when project folder changes */
  onProjectPathChange?: (path: string) => void;
  /** Whether to automatically open folder picker when selecting project scope */
  autoOpenPicker?: boolean;
}

export interface ScopeSelectionState {
  /** Current scope */
  scope: AgentScope;
  /** Selected project folder path */
  projectFolderPath: string;
  /** Error message for project folder selection */
  projectFolderError: string;
  /** Whether folder picker is currently open */
  isPickingProjectFolder: boolean;
  /** Change scope (may trigger folder picker) */
  handleScopeChange: (newScope: AgentScope) => void;
  /** Open folder picker dialog */
  handlePickProjectFolder: (event?: React.MouseEvent) => Promise<void>;
  /** Set scope directly without triggering folder picker */
  setScope: (scope: AgentScope) => void;
  /** Set project folder path directly */
  setProjectFolderPath: (path: string) => void;
  /** Clear project folder error */
  clearProjectFolderError: () => void;
  /** Set project folder error */
  setProjectFolderError: (error: string) => void;
  /** Whether scope selection is valid (global is always valid, project requires folder) */
  isValid: boolean;
  /** Display path (last 2 segments for UI) */
  displayProjectPath: string;
  /** Reset to initial state */
  reset: () => void;
}

export function useScopeSelection(options: UseScopeSelectionOptions): ScopeSelectionState {
  const {
    initialScope,
    initialProjectPath = '',
    onScopeChange,
    onProjectPathChange,
    autoOpenPicker = true,
  } = options;

  const [scope, setScopeInternal] = useState<AgentScope>(initialScope);
  const [projectFolderPath, setProjectFolderPathInternal] = useState(initialProjectPath);
  const [projectFolderError, setProjectFolderError] = useState('');
  const [isPickingProjectFolder, setIsPickingProjectFolder] = useState(false);

  const setScope = useCallback(
    (newScope: AgentScope) => {
      setScopeInternal(newScope);
      onScopeChange?.(newScope);
      if (newScope === AgentScope.Global) {
        setProjectFolderPathInternal('');
        onProjectPathChange?.('');
      }
    },
    [onScopeChange, onProjectPathChange]
  );

  const setProjectFolderPath = useCallback(
    (path: string) => {
      setProjectFolderPathInternal(path);
      onProjectPathChange?.(path);
      if (path) {
        setProjectFolderError('');
      }
    },
    [onProjectPathChange]
  );

  const handlePickProjectFolder = useCallback(
    async (event?: React.MouseEvent) => {
      event?.stopPropagation();
      if (isPickingProjectFolder) return;

      setIsPickingProjectFolder(true);
      try {
        const selectedPath = await open({
          directory: true,
          multiple: false,
          title: 'Select Project Directory',
        });

        if (selectedPath && typeof selectedPath === 'string') {
          setProjectFolderPath(selectedPath);
          setScopeInternal(AgentScope.Project);
          onScopeChange?.(AgentScope.Project);
        }
      } catch (error) {
        console.error('Failed to select project folder:', error);
        setProjectFolderError('Unable to open the folder picker. Please try again.');
      } finally {
        setIsPickingProjectFolder(false);
      }
    },
    [isPickingProjectFolder, setProjectFolderPath, onScopeChange]
  );

  const handleScopeChange = useCallback(
    (newScope: AgentScope) => {
      if (newScope === AgentScope.Project && !projectFolderPath && autoOpenPicker) {
        // Trigger folder picker when switching to Project without a folder
        handlePickProjectFolder();
      } else {
        setScope(newScope);
      }
    },
    [projectFolderPath, autoOpenPicker, handlePickProjectFolder, setScope]
  );

  const clearProjectFolderError = useCallback(() => {
    setProjectFolderError('');
  }, []);

  const isValid = useMemo(() => {
    if (scope === AgentScope.Global) return true;
    return Boolean(projectFolderPath && projectFolderPath.trim().length > 0);
  }, [scope, projectFolderPath]);

  const displayProjectPath = useMemo(() => {
    if (!projectFolderPath) return 'Choose folder...';
    return projectFolderPath.split('/').slice(-2).join('/');
  }, [projectFolderPath]);

  const reset = useCallback(() => {
    setScopeInternal(initialScope);
    setProjectFolderPathInternal(initialProjectPath);
    setProjectFolderError('');
  }, [initialScope, initialProjectPath]);

  return {
    scope,
    projectFolderPath,
    projectFolderError,
    isPickingProjectFolder,
    handleScopeChange,
    handlePickProjectFolder,
    setScope,
    setProjectFolderPath,
    clearProjectFolderError,
    setProjectFolderError,
    isValid,
    displayProjectPath,
    reset,
  };
}

export default useScopeSelection;
