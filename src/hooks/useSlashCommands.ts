import { useCallback, useEffect, useRef, useState } from 'react';
import { AgentScope, SlashCommand } from '../types';
import {
  listSlashCommands,
  writeSlashCommand,
  deleteSlashCommand as deleteSlashCommandFile,
  listSlashCommandsFromDirectory,
} from '../utils/tauriCommands';
import { ToastType } from '../components/Toast';
import { getStorageItem, setStorageItem } from '../utils/storage';
import { devLog } from '../utils/devLogger';

const SLASH_COMMANDS_CACHE_KEY = 'vinsly-slash-commands-cache';

// Extract first non-empty line as description
function extractDescription(content: string): string {
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('---')) {
      // Truncate if too long
      return trimmed.length > 100 ? trimmed.slice(0, 100) + '...' : trimmed;
    }
  }
  return '';
}

// Convert backend SlashCommandFile to frontend SlashCommand
function parseSlashCommand(file: {
  name: string;
  path: string;
  content: string;
  scope: string;
}): SlashCommand {
  return {
    id: file.path,
    name: file.name,
    scope: file.scope === 'global' ? AgentScope.Global : AgentScope.Project,
    path: file.path,
    description: extractDescription(file.content),
    body: file.content,
    isFavorite: false,
  };
}

export interface UseSlashCommandsOptions {
  showToast: (type: ToastType, message: string) => void;
}

export interface UseSlashCommandsResult {
  commands: SlashCommand[];
  isLoading: boolean;
  commandsRef: React.RefObject<SlashCommand[]>;
  loadCommands: (options?: {
    projectPaths?: string[];
    includeGlobal?: boolean;
    watchedDirectories?: string[];
  }) => Promise<{ total: number; newCount: number }>;
  saveCommand: (command: SlashCommand, options?: { projectPath?: string }) => Promise<void>;
  deleteCommand: (commandId: string) => Promise<void>;
  toggleFavorite: (command: SlashCommand) => void;
}

export function useSlashCommands(options: UseSlashCommandsOptions): UseSlashCommandsResult {
  const { showToast } = options;

  const [commands, setCommands] = useState<SlashCommand[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCacheReady, setIsCacheReady] = useState(false);

  const commandsRef = useRef<SlashCommand[]>([]);
  const cacheHydratedRef = useRef(false);

  // Keep ref in sync
  useEffect(() => {
    commandsRef.current = commands;
  }, [commands]);

  // Hydrate from cache on mount
  useEffect(() => {
    if (cacheHydratedRef.current) return;

    const hydrate = async () => {
      try {
        const cached = await getStorageItem<SlashCommand[]>(SLASH_COMMANDS_CACHE_KEY);
        if (cached && cached.length > 0 && commandsRef.current.length === 0) {
          setCommands(cached);
        }
      } catch (error) {
        devLog.error('Failed to hydrate slash commands cache:', error);
      } finally {
        cacheHydratedRef.current = true;
        setIsCacheReady(true);
      }
    };

    void hydrate();
  }, []);

  // Persist to cache when commands change
  useEffect(() => {
    if (!isCacheReady) return;
    setStorageItem(SLASH_COMMANDS_CACHE_KEY, commands);
  }, [commands, isCacheReady]);

  const makeCommandKey = useCallback((cmd: SlashCommand) => {
    const scopePrefix = cmd.scope === AgentScope.Project ? 'project' : 'global';
    return `${scopePrefix}:${cmd.path || cmd.name}`;
  }, []);

  const loadCommands = useCallback(
    async (loadOptions: {
      projectPaths?: string[];
      includeGlobal?: boolean;
      watchedDirectories?: string[];
    } = {}): Promise<{ total: number; newCount: number }> => {
      const { projectPaths = [], includeGlobal = true, watchedDirectories = [] } = loadOptions;

      setIsLoading(true);
      try {
        const previousCommands = commandsRef.current;
        const seenKeys = new Set<string>();
        const allCommands: SlashCommand[] = [];

        const addCommand = (cmd: SlashCommand) => {
          const key = makeCommandKey(cmd);
          if (seenKeys.has(key)) return;
          seenKeys.add(key);
          allCommands.push(cmd);
        };

        // Load global commands
        if (includeGlobal) {
          const globalFiles = await listSlashCommands('global');
          for (const file of globalFiles) {
            addCommand(parseSlashCommand(file));
          }
        }

        // Load project commands
        for (const projectPath of projectPaths) {
          try {
            const projectFiles = await listSlashCommands('project', projectPath);
            for (const file of projectFiles) {
              addCommand(parseSlashCommand(file));
            }
          } catch (error) {
            devLog.error(`Error loading commands from ${projectPath}:`, error);
          }
        }

        // Load from watched directories
        for (const directory of watchedDirectories) {
          try {
            const watchedFiles = await listSlashCommandsFromDirectory(directory);
            for (const file of watchedFiles) {
              addCommand(parseSlashCommand(file));
            }
          } catch (error) {
            devLog.error(`Error loading commands from ${directory}:`, error);
          }
        }

        // Preserve favorites from previous state
        const previousFavorites = new Set(
          previousCommands.filter(c => c.isFavorite).map(makeCommandKey)
        );
        const commandsWithFavorites = allCommands.map(cmd => ({
          ...cmd,
          isFavorite: previousFavorites.has(makeCommandKey(cmd)),
        }));

        const previousKeys = new Set(previousCommands.map(makeCommandKey));
        const newCount = commandsWithFavorites.filter(
          cmd => !previousKeys.has(makeCommandKey(cmd))
        ).length;

        setCommands(commandsWithFavorites);

        return { total: commandsWithFavorites.length, newCount };
      } catch (error) {
        devLog.error('Error loading slash commands:', error);
        showToast('error', 'Failed to load slash commands');
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [makeCommandKey, showToast]
  );

  const saveCommand = useCallback(
    async (commandToSave: SlashCommand, saveOptions?: { projectPath?: string }) => {
      try {
        const scope = commandToSave.scope === AgentScope.Project ? 'project' : 'global';
        const projectPath = scope === 'project' ? saveOptions?.projectPath : undefined;

        if (scope === 'project' && !projectPath) {
          throw new Error('Select a project folder before saving a project command.');
        }

        const absolutePath = await writeSlashCommand(
          scope,
          commandToSave.name,
          commandToSave.body,
          projectPath
        );

        const persistedCommand: SlashCommand = {
          ...commandToSave,
          id: absolutePath,
          path: absolutePath,
          description: extractDescription(commandToSave.body),
        };

        setCommands(prev => {
          const exists = prev.some(cmd => cmd.id === commandToSave.id);
          if (exists) {
            return prev.map(cmd =>
              cmd.id === commandToSave.id ? persistedCommand : cmd
            );
          }
          return [...prev, persistedCommand];
        });

        // Clean up old file if path changed
        if (commandToSave.path && commandToSave.path !== absolutePath) {
          try {
            await deleteSlashCommandFile(commandToSave.path);
          } catch (cleanupError) {
            devLog.warn('Failed to remove previous command file:', cleanupError);
          }
        }

        showToast('success', `Command "/${commandToSave.name}" saved successfully`);
      } catch (error) {
        devLog.error('Error saving command:', error);
        showToast(
          'error',
          `Failed to save command: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    },
    [showToast]
  );

  const deleteCommand = useCallback(
    async (commandId: string) => {
      try {
        const command = commandsRef.current.find(c => c.id === commandId);
        if (!command) return;

        await deleteSlashCommandFile(command.path);
        setCommands(prev => prev.filter(c => c.id !== commandId));
        showToast('success', `Command "/${command.name}" deleted successfully`);
      } catch (error) {
        devLog.error('Error deleting command:', error);
        showToast(
          'error',
          `Failed to delete command: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    },
    [showToast]
  );

  const toggleFavorite = useCallback((commandToToggle: SlashCommand) => {
    setCommands(prev =>
      prev.map(cmd => {
        if (cmd.id === commandToToggle.id) {
          return { ...cmd, isFavorite: !cmd.isFavorite };
        }
        return cmd;
      })
    );
  }, []);

  return {
    commands,
    isLoading,
    commandsRef,
    loadCommands,
    saveCommand,
    deleteCommand,
    toggleFavorite,
  };
}
