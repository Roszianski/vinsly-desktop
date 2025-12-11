import React, { createContext, useContext, useCallback, useEffect } from 'react';
import { Agent, AgentScope, Skill, LoadAgentsOptions, SlashCommand, ClaudeMemory, DetailedScanResult } from '../types';
import { MCPServer, MCPScope } from '../types/mcp';
import { Hook } from '../types/hooks';
import { useWorkspace } from '../hooks/useWorkspace';
import { useScanSettings } from '../hooks/useScanSettings';
import { useClaudeMemory } from '../hooks/useClaudeMemory';
import { useClaudeMemoryList } from '../hooks/useClaudeMemoryList';
import { useSlashCommands } from '../hooks/useSlashCommands';
import { useMCPServers } from '../hooks/useMCPServers';
import { useHooks } from '../hooks/useHooks';
import { useHistory } from '../hooks/useHistory';
import { useToast } from './ToastContext';
import { useLicenseContext } from './LicenseContext';
import { DEFAULT_HOME_DISCOVERY_DEPTH, discoverHomeDirectories } from '../utils/homeDiscovery';
import { saveScanSettings } from '../utils/scanSettings';
import { AgentCommands, SkillCommands } from '../utils/workspaceCommands';
import { ScanSettings } from '../types';
import { devLog } from '../utils/devLogger';

const HOME_DISCOVERY_MAX_DEPTH = DEFAULT_HOME_DISCOVERY_DEPTH;

interface WorkspaceContextType {
  // Agents
  agents: Agent[];
  saveAgent: (agent: Agent, options?: { projectPath?: string }) => Promise<void>;
  deleteAgent: (agentId: string) => Promise<void>;
  bulkDeleteAgents: (agentIds: string[]) => Promise<void>;
  importAgents: (agents: Agent[], errors: string[]) => Promise<void>;
  toggleAgentFavorite: (agent: Agent) => Promise<void>;

  // Skills
  skills: Skill[];
  saveSkill: (skill: Skill, options?: { projectPath?: string }) => Promise<void>;
  deleteSkill: (skillId: string) => Promise<void>;
  toggleSkillFavorite: (skill: Skill) => Promise<void>;
  refreshGlobalSkills: () => Promise<void>;

  // Slash Commands
  commands: SlashCommand[];
  isCommandsLoading: boolean;
  saveCommand: (command: SlashCommand, options?: { projectPath?: string }) => Promise<void>;
  deleteCommand: (commandId: string) => Promise<void>;
  toggleCommandFavorite: (command: SlashCommand) => void;
  duplicateCommand: (command: SlashCommand) => Promise<void>;

  // MCP Servers
  mcpServersList: MCPServer[];
  isMCPLoading: boolean;
  addMCPServer: (server: MCPServer, projectPath?: string) => Promise<void>;
  updateMCPServer: (server: MCPServer, oldServer: MCPServer, projectPath?: string) => Promise<void>;
  removeMCPServer: (name: string, scope: MCPScope) => Promise<void>;
  toggleMCPFavorite: (server: MCPServer) => void;

  // Hooks
  hooksList: Hook[];
  isHooksLoading: boolean;
  addHook: (hook: Hook, projectPath?: string) => Promise<void>;
  updateHook: (hook: Hook, oldHook: Hook, projectPath?: string) => Promise<void>;
  removeHook: (hook: Hook) => Promise<void>;
  toggleHookFavorite: (hook: Hook) => void;

  // Memory
  memories: ClaudeMemory[];
  isMemoryListLoading: boolean;
  globalMemory: ClaudeMemory | null;
  projectMemory: ClaudeMemory | null;
  isMemoryLoading: boolean;
  memoryActiveScope: AgentScope;
  setMemoryActiveScope: (scope: AgentScope) => void;
  saveMemory: (scope: AgentScope, content: string, projectPath?: string) => Promise<void>;
  toggleMemoryFavorite: (memory: ClaudeMemory) => void;
  cloneMemory: (memory: ClaudeMemory, destinationPath: string) => Promise<void>;

  // Scanning
  isScanBusy: boolean;
  scanSettings: ScanSettings;
  applyScanSettings: (settings: ScanSettings) => void;
  handleFullScan: (options?: LoadAgentsOptions) => Promise<DetailedScanResult>;

  // History (Undo/Redo)
  canUndo: boolean;
  canRedo: boolean;
  undo: () => Promise<string | null>;
  redo: () => Promise<string | null>;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

interface WorkspaceProviderProps {
  children: React.ReactNode;
}

export const WorkspaceProvider: React.FC<WorkspaceProviderProps> = ({ children }) => {
  const { showToast } = useToast();
  const { isOnboardingComplete, isActivationOpen, registerWorkspaceClear } = useLicenseContext();

  // Scan settings
  const scanSettingsHook = useScanSettings();
  const { scanSettings, scanSettingsRef, applyScanSettings, loadInitialSettings } = scanSettingsHook;

  // Workspace (agents and skills)
  const workspace = useWorkspace({
    showToast,
    scanSettingsRef,
    isOnboardingComplete,
  });

  const {
    agents,
    skills,
    isScanBusy,
    loadAgents,
    saveAgent: saveAgentToWorkspace,
    deleteAgent: deleteAgentFromWorkspace,
    bulkDeleteAgents: bulkDeleteAgentsFromWorkspace,
    importAgents: importAgentsToWorkspace,
    toggleAgentFavorite: toggleAgentFavoriteInWorkspace,
    saveSkill: saveSkillToWorkspace,
    deleteSkill: deleteSkillFromWorkspace,
    toggleSkillFavorite: toggleSkillFavoriteInWorkspace,
    refreshGlobalSkills,
    clearWorkspaceCache,
  } = workspace;

  // Register workspace clear for license reset
  useEffect(() => {
    registerWorkspaceClear(clearWorkspaceCache);
  }, [registerWorkspaceClear, clearWorkspaceCache]);

  // History (Undo/Redo)
  const history = useHistory({ maxStackSize: 20 });
  const { executeCommand, undo, redo, canUndo, canRedo } = history;

  // Memory
  const memory = useClaudeMemory({ showToast });
  const {
    globalMemory,
    projectMemory,
    isLoading: isMemoryLoading,
    activeScope: memoryActiveScope,
    setActiveScope: setMemoryActiveScope,
    saveMemory: saveMemoryToBackend,
  } = memory;

  const memoryList = useClaudeMemoryList({ showToast, scanSettingsRef });
  const {
    memories,
    isLoading: isMemoryListLoading,
    loadMemories,
    toggleFavorite: toggleMemoryFavorite,
  } = memoryList;

  // Slash Commands
  const slashCommands = useSlashCommands({ showToast });
  const {
    commands,
    isLoading: isCommandsLoading,
    loadCommands,
    saveCommand: saveCommandToBackend,
    deleteCommand: deleteCommandFromBackend,
    toggleFavorite: toggleCommandFavorite,
  } = slashCommands;

  // MCP Servers
  const mcpServers = useMCPServers({ showToast });
  const {
    servers: mcpServersList,
    isLoading: isMCPLoading,
    loadServers: loadMCPServers,
    addServer: addMCPServerToBackend,
    updateServer: updateMCPServerToBackend,
    removeServer: removeMCPServerFromBackend,
    toggleFavorite: toggleMCPFavorite,
  } = mcpServers;

  // Hooks
  const hooksHook = useHooks({ showToast });
  const {
    hooks: hooksList,
    isLoading: isHooksLoading,
    loadHooks,
    addHook: addHookToBackend,
    updateHook: updateHookToBackend,
    removeHook: removeHookFromBackend,
    toggleFavorite: toggleHookFavorite,
  } = hooksHook;

  // Initialize workspace when onboarding completes
  useEffect(() => {
    if (!isOnboardingComplete || isActivationOpen) {
      return;
    }

    const initializeWorkspace = async () => {
      const storedSettings = await loadInitialSettings();

      let homeDirectories: string[] = [];
      if (storedSettings.autoScanHomeDirectoryOnStartup && storedSettings.fullDiskAccessEnabled) {
        try {
          homeDirectories = await discoverHomeDirectories({
            maxDepth: HOME_DISCOVERY_MAX_DEPTH,
            includeProtectedDirs: false, // Never scan Music/Movies/Pictures - no Claude projects there
          });
        } catch (error) {
          devLog.error('Error discovering home directories:', error);
        }
      } else if (storedSettings.autoScanHomeDirectoryOnStartup && !storedSettings.fullDiskAccessEnabled) {
        devLog.log('Skipping automatic home scan because Full Disk Access is disabled.');
      }

      const homeScanEnabled = storedSettings.autoScanHomeDirectoryOnStartup && storedSettings.fullDiskAccessEnabled;
      const shouldScanWatched = (storedSettings.autoScanGlobalOnStartup || homeScanEnabled)
        && storedSettings.watchedDirectories.length > 0;

      await loadAgents({
        includeGlobal: storedSettings.autoScanGlobalOnStartup,
        additionalDirectories: homeDirectories,
        scanWatchedDirectories: shouldScanWatched,
      });

      // Collect all project paths for loading other resources
      const allProjectPaths = [
        ...homeDirectories,
        ...(shouldScanWatched ? storedSettings.watchedDirectories : []),
      ];

      await loadCommands({
        includeGlobal: storedSettings.autoScanGlobalOnStartup,
        projectPaths: allProjectPaths,
        watchedDirectories: storedSettings.watchedDirectories,
      });

      await loadMCPServers({
        includeGlobal: storedSettings.autoScanGlobalOnStartup,
        projectPaths: allProjectPaths,
      });

      await loadHooks({
        includeGlobal: storedSettings.autoScanGlobalOnStartup,
        projectPaths: allProjectPaths,
      });

      await loadMemories({
        includeGlobal: storedSettings.autoScanGlobalOnStartup,
        projectPaths: allProjectPaths,
      });
    };

    initializeWorkspace();
  }, [isActivationOpen, isOnboardingComplete, loadAgents, loadCommands, loadMCPServers, loadHooks, loadMemories, loadInitialSettings]);

  // Agent operations with undo support
  const saveAgent = useCallback(async (agent: Agent, options?: { projectPath?: string }) => {
    await saveAgentToWorkspace(agent, options);
  }, [saveAgentToWorkspace]);

  const deleteAgent = useCallback(async (agentId: string) => {
    const agentToDelete = agents.find(a => a.id === agentId);
    if (!agentToDelete) return;

    // Extract project path for PROJECT agents before deletion for proper restoration
    const projectPath = agentToDelete.scope === AgentScope.Project
      ? agentToDelete.path?.split('/.claude/agents')[0] || undefined
      : undefined;

    const command = AgentCommands.delete(
      agentToDelete,
      async (agent) => {
        await deleteAgentFromWorkspace(agent.id);
      },
      async (agent) => {
        // Pass projectPath for PROJECT agents to ensure proper restoration
        await saveAgentToWorkspace(agent, { projectPath });
      }
    );

    const success = await executeCommand(command);
    if (success) {
      showToast('success', `Deleted agent "${agentToDelete.name}"`, undefined, {
        label: 'Undo',
        onClick: () => { void undo(); }
      });
    }
  }, [agents, deleteAgentFromWorkspace, saveAgentToWorkspace, executeCommand, undo, showToast]);

  const bulkDeleteAgents = useCallback(async (agentIds: string[]) => {
    const agentsToDelete = agents.filter(a => agentIds.includes(a.id));
    if (agentsToDelete.length === 0) return;

    // Extract project paths for each agent before deletion
    const agentProjectPaths = new Map(
      agentsToDelete
        .filter(a => a.scope === AgentScope.Project)
        .map(a => [a.id, a.path?.split('/.claude/agents')[0] || undefined])
    );

    const command = AgentCommands.bulkDelete(
      agentsToDelete,
      async (agentsToRemove) => {
        await bulkDeleteAgentsFromWorkspace(agentsToRemove.map(a => a.id));
      },
      async (agentsToRestore) => {
        for (const agent of agentsToRestore) {
          const projectPath = agentProjectPaths.get(agent.id);
          await saveAgentToWorkspace(agent, { projectPath });
        }
      }
    );

    const success = await executeCommand(command);
    if (success) {
      showToast('success', `Deleted ${agentsToDelete.length} agent(s)`, undefined, {
        label: 'Undo',
        onClick: () => { void undo(); }
      });
    }
  }, [agents, bulkDeleteAgentsFromWorkspace, saveAgentToWorkspace, executeCommand, undo, showToast]);

  const toggleAgentFavorite = useCallback(async (agent: Agent) => {
    const command = AgentCommands.toggleFavorite(
      agent,
      async () => {
        toggleAgentFavoriteInWorkspace(agent);
      }
    );
    await executeCommand(command);
  }, [toggleAgentFavoriteInWorkspace, executeCommand]);

  // Skill operations with undo support
  const saveSkill = useCallback(async (skill: Skill, options?: { projectPath?: string }) => {
    await saveSkillToWorkspace(skill, options);
  }, [saveSkillToWorkspace]);

  const deleteSkill = useCallback(async (skillId: string) => {
    const skillToDelete = skills.find(s => s.id === skillId);
    if (!skillToDelete) return;

    // Extract project path for PROJECT skills before deletion for proper restoration
    const projectPath = skillToDelete.scope === AgentScope.Project
      ? skillToDelete.directoryPath?.split('/.claude/skills')[0] || undefined
      : undefined;

    const command = SkillCommands.delete(
      skillToDelete,
      async (skill) => {
        await deleteSkillFromWorkspace(skill.id);
      },
      async (skill) => {
        // Pass projectPath for PROJECT skills to ensure proper restoration
        await saveSkillToWorkspace(skill, { projectPath });
      }
    );

    const success = await executeCommand(command);
    if (success) {
      showToast('success', `Deleted skill "${skillToDelete.name}"`, undefined, {
        label: 'Undo',
        onClick: () => { void undo(); }
      });
    }
  }, [skills, deleteSkillFromWorkspace, saveSkillToWorkspace, executeCommand, undo, showToast]);

  const toggleSkillFavorite = useCallback(async (skill: Skill) => {
    const command = SkillCommands.toggleFavorite(
      skill,
      async () => {
        toggleSkillFavoriteInWorkspace(skill);
      }
    );
    await executeCommand(command);
  }, [toggleSkillFavoriteInWorkspace, executeCommand]);

  // Command operations
  const saveCommand = useCallback(async (command: SlashCommand, options?: { projectPath?: string }) => {
    await saveCommandToBackend(command, options);
  }, [saveCommandToBackend]);

  const deleteCommand = useCallback(async (commandId: string) => {
    await deleteCommandFromBackend(commandId);
  }, [deleteCommandFromBackend]);

  const duplicateCommand = useCallback(async (commandToDuplicate: SlashCommand) => {
    let newName = `${commandToDuplicate.name}-copy`;
    const existingNames = new Set(commands.map(c => c.name));
    let counter = 1;
    while (existingNames.has(newName)) {
      newName = `${commandToDuplicate.name}-copy-${counter}`;
      counter++;
    }

    const duplicatedCommand = {
      ...commandToDuplicate,
      id: crypto.randomUUID(),
      name: newName,
      path: '',
    };

    // Extract project path from the original command's path for project commands
    // Path format: /path/to/project/.claude/commands/name.md
    let projectPath: string | undefined;
    if (commandToDuplicate.scope === AgentScope.Project && commandToDuplicate.path) {
      const claudeIndex = commandToDuplicate.path.indexOf('/.claude/');
      if (claudeIndex !== -1) {
        projectPath = commandToDuplicate.path.substring(0, claudeIndex);
      }
    }

    try {
      await saveCommandToBackend(duplicatedCommand, { projectPath });
      showToast('success', `Duplicated command as "/${newName}"`);
    } catch (error) {
      devLog.error('Error duplicating command:', error);
      showToast('error', 'Failed to duplicate command.');
    }
  }, [commands, saveCommandToBackend, showToast]);

  // MCP operations
  const addMCPServer = useCallback(async (server: MCPServer, projectPath?: string) => {
    await addMCPServerToBackend(server, projectPath);
  }, [addMCPServerToBackend]);

  const updateMCPServer = useCallback(async (server: MCPServer, oldServer: MCPServer, projectPath?: string) => {
    await updateMCPServerToBackend(server, oldServer, projectPath);
  }, [updateMCPServerToBackend]);

  const removeMCPServer = useCallback(async (name: string, scope: MCPScope) => {
    await removeMCPServerFromBackend(name, scope);
  }, [removeMCPServerFromBackend]);

  // Hook operations
  const addHook = useCallback(async (hook: Hook, projectPath?: string) => {
    await addHookToBackend(hook, projectPath);
  }, [addHookToBackend]);

  const updateHook = useCallback(async (hook: Hook, oldHook: Hook, projectPath?: string) => {
    await updateHookToBackend(hook, oldHook, projectPath);
  }, [updateHookToBackend]);

  const removeHook = useCallback(async (hook: Hook) => {
    await removeHookFromBackend(hook);
  }, [removeHookFromBackend]);

  // Memory operations
  const saveMemory = useCallback(async (scope: AgentScope, content: string, projectPath?: string) => {
    await saveMemoryToBackend(scope, content, projectPath);
    // Reload the memories list to pick up the newly saved/created memory
    await loadMemories();
  }, [saveMemoryToBackend, loadMemories]);

  const cloneMemory = useCallback(async (memoryToClone: ClaudeMemory, destinationPath: string) => {
    try {
      await saveMemoryToBackend(AgentScope.Project, memoryToClone.content, destinationPath);
      await loadMemories();
      showToast('success', 'Memory cloned to new project');
    } catch (error) {
      devLog.error('Error cloning memory:', error);
      showToast('error', 'Failed to clone memory.');
    }
  }, [saveMemoryToBackend, loadMemories, showToast]);

  // Full scan operation
  const handleFullScan = useCallback(async (options?: LoadAgentsOptions): Promise<DetailedScanResult> => {
    const agentResult = await loadAgents(options);

    // Collect all project paths from options
    const projectPathsFromOptions = options?.projectPaths
      ? (Array.isArray(options.projectPaths) ? options.projectPaths : [options.projectPaths])
      : [];
    const additionalDirs = options?.additionalDirectories || [];
    const watchedDirs = options?.scanWatchedDirectories ? scanSettings.watchedDirectories : [];

    const allProjectPaths = [
      ...projectPathsFromOptions,
      ...additionalDirs,
      ...watchedDirs,
    ];

    // Use Promise.allSettled to allow partial success - if one loader fails,
    // the others can still complete successfully
    const results = await Promise.allSettled([
      loadCommands({
        includeGlobal: options?.includeGlobal,
        projectPaths: allProjectPaths,
        watchedDirectories: scanSettings.watchedDirectories,
      }),
      loadMCPServers({
        includeGlobal: options?.includeGlobal,
        projectPaths: allProjectPaths,
      }),
      loadHooks({
        includeGlobal: options?.includeGlobal,
        projectPaths: allProjectPaths,
      }),
      loadMemories({
        includeGlobal: options?.includeGlobal,
        projectPaths: allProjectPaths,
      }),
    ]);

    // Log any failures but don't throw - allow app to continue with partial data
    const loaderNames = ['Commands', 'MCP Servers', 'Hooks', 'Memories'];
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        devLog.error(`Failed to load ${loaderNames[index]}:`, result.reason);
      }
    });

    // Extract results from each loader (default to 0 if failed or void)
    const defaultResult = { total: 0, newCount: 0 };
    const commandsResult = results[0].status === 'fulfilled' && results[0].value ? results[0].value : defaultResult;
    const mcpResult = results[1].status === 'fulfilled' && results[1].value ? results[1].value : defaultResult;
    const hooksResult = results[2].status === 'fulfilled' && results[2].value ? results[2].value : defaultResult;
    const memoriesResult = results[3].status === 'fulfilled' && results[3].value ? results[3].value : defaultResult;

    // Build detailed result
    const detailedResult: DetailedScanResult = {
      total: agentResult.total + commandsResult.total + mcpResult.total + hooksResult.total + memoriesResult.total,
      newCount: agentResult.newCount + commandsResult.newCount + mcpResult.newCount + hooksResult.newCount + memoriesResult.newCount,
      breakdown: {
        agents: { total: agentResult.total, new: agentResult.newCount },
        skills: { total: 0, new: 0 }, // Skills are loaded as part of agents
        commands: { total: commandsResult.total, new: commandsResult.newCount },
        mcpServers: { total: mcpResult.total, new: mcpResult.newCount },
        hooks: { total: hooksResult.total, new: hooksResult.newCount },
        memories: { total: memoriesResult.total, new: memoriesResult.newCount },
      },
    };

    // Show enhanced toast with breakdown when new items found
    if (detailedResult.newCount > 0) {
      const parts: string[] = [];
      if (detailedResult.breakdown.agents.new > 0) {
        parts.push(`${detailedResult.breakdown.agents.new} agent${detailedResult.breakdown.agents.new === 1 ? '' : 's'}`);
      }
      if (detailedResult.breakdown.commands.new > 0) {
        parts.push(`${detailedResult.breakdown.commands.new} command${detailedResult.breakdown.commands.new === 1 ? '' : 's'}`);
      }
      if (detailedResult.breakdown.mcpServers.new > 0) {
        parts.push(`${detailedResult.breakdown.mcpServers.new} MCP server${detailedResult.breakdown.mcpServers.new === 1 ? '' : 's'}`);
      }
      if (detailedResult.breakdown.hooks.new > 0) {
        parts.push(`${detailedResult.breakdown.hooks.new} hook${detailedResult.breakdown.hooks.new === 1 ? '' : 's'}`);
      }
      if (detailedResult.breakdown.memories.new > 0) {
        parts.push(`${detailedResult.breakdown.memories.new} memor${detailedResult.breakdown.memories.new === 1 ? 'y' : 'ies'}`);
      }
      showToast('success', `Scan complete: Found ${parts.join(', ')}`);
    } else {
      showToast('success', `Scan complete: ${detailedResult.total} resource${detailedResult.total === 1 ? '' : 's'} (no new)`);
    }

    return detailedResult;
  }, [loadAgents, loadCommands, loadMCPServers, loadHooks, loadMemories, scanSettings.watchedDirectories, showToast]);

  const value: WorkspaceContextType = {
    // Agents
    agents,
    saveAgent,
    deleteAgent,
    bulkDeleteAgents,
    importAgents: importAgentsToWorkspace,
    toggleAgentFavorite,

    // Skills
    skills,
    saveSkill,
    deleteSkill,
    toggleSkillFavorite,
    refreshGlobalSkills,

    // Commands
    commands,
    isCommandsLoading,
    saveCommand,
    deleteCommand,
    toggleCommandFavorite,
    duplicateCommand,

    // MCP
    mcpServersList,
    isMCPLoading,
    addMCPServer,
    updateMCPServer,
    removeMCPServer,
    toggleMCPFavorite,

    // Hooks
    hooksList,
    isHooksLoading,
    addHook,
    updateHook,
    removeHook,
    toggleHookFavorite,

    // Memory
    memories,
    isMemoryListLoading,
    globalMemory,
    projectMemory,
    isMemoryLoading,
    memoryActiveScope,
    setMemoryActiveScope,
    saveMemory,
    toggleMemoryFavorite,
    cloneMemory,

    // Scanning
    isScanBusy,
    scanSettings,
    applyScanSettings,
    handleFullScan,

    // History
    canUndo,
    canRedo,
    undo,
    redo,
  };

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
};

export const useWorkspaceContext = () => {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspaceContext must be used within a WorkspaceProvider');
  }
  return context;
};
