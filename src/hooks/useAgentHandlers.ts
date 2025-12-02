import { useCallback } from 'react';
import { Agent } from '../types';
import { AgentCommands } from '../utils/workspaceCommands';
import { ToastType } from '../components/Toast';

export interface UseAgentHandlersOptions {
  agents: Agent[];
  showToast: (type: ToastType, message: string, duration?: number, action?: { label: string; onClick: () => void }) => void;
  executeCommand: (command: { description: string; execute: () => Promise<void>; undo: () => Promise<void> }) => Promise<boolean>;
  undo: () => Promise<string | undefined>;
  saveAgentToWorkspace: (agent: Agent, options?: { projectPath?: string }) => Promise<void>;
  deleteAgentFromWorkspace: (agentId: string) => Promise<void>;
  bulkDeleteAgents: (agentIds: string[]) => Promise<void>;
  importAgents: (imported: Agent[], errors: string[]) => Promise<void>;
  toggleAgentFavorite: (agent: Agent) => void;
  cancelEditing: () => void;
}

export interface UseAgentHandlersResult {
  handleSaveAgent: (agent: Agent, options?: { projectPath?: string }) => Promise<void>;
  handleDeleteAgent: (agentId: string) => Promise<void>;
  handleBulkDelete: (agentIds: string[]) => Promise<void>;
  handleImportAgents: (imported: Agent[], errors: string[]) => Promise<void>;
  handleToggleFavorite: (agent: Agent) => Promise<void>;
}

/**
 * Hook that encapsulates agent-related handlers with undo/redo support
 */
export function useAgentHandlers(options: UseAgentHandlersOptions): UseAgentHandlersResult {
  const {
    agents,
    showToast,
    executeCommand,
    undo,
    saveAgentToWorkspace,
    deleteAgentFromWorkspace,
    bulkDeleteAgents,
    importAgents,
    toggleAgentFavorite,
    cancelEditing,
  } = options;

  const handleSaveAgent = useCallback(
    async (agentToSave: Agent, saveOptions?: { projectPath?: string }) => {
      await saveAgentToWorkspace(agentToSave, saveOptions);
      cancelEditing();
    },
    [saveAgentToWorkspace, cancelEditing]
  );

  const handleDeleteAgent = useCallback(
    async (agentIdToDelete: string) => {
      const agentToDelete = agents.find(a => a.id === agentIdToDelete);
      if (!agentToDelete) return;

      const command = AgentCommands.delete(
        agentToDelete,
        async (agent) => {
          await deleteAgentFromWorkspace(agent.id);
        },
        async (agent) => {
          await saveAgentToWorkspace(agent);
        }
      );

      const success = await executeCommand(command);
      if (success) {
        showToast('success', `Deleted agent "${agentToDelete.name}"`, undefined, {
          label: 'Undo',
          onClick: () => { void undo(); }
        });
      }
    },
    [agents, deleteAgentFromWorkspace, saveAgentToWorkspace, executeCommand, showToast, undo]
  );

  const handleBulkDelete = useCallback(
    async (agentIdsToDelete: string[]) => {
      const agentsToDelete = agents.filter(a => agentIdsToDelete.includes(a.id));
      if (agentsToDelete.length === 0) return;

      const command = AgentCommands.bulkDelete(
        agentsToDelete,
        async (agentsToRemove) => {
          await bulkDeleteAgents(agentsToRemove.map(a => a.id));
        },
        async (agentsToRestore) => {
          for (const agent of agentsToRestore) {
            await saveAgentToWorkspace(agent);
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
    },
    [agents, bulkDeleteAgents, saveAgentToWorkspace, executeCommand, showToast, undo]
  );

  const handleImportAgents = useCallback(
    async (importedAgents: Agent[], errors: string[]) => {
      await importAgents(importedAgents, errors);
    },
    [importAgents]
  );

  const handleToggleFavorite = useCallback(
    async (agentToToggle: Agent) => {
      const command = AgentCommands.toggleFavorite(
        agentToToggle,
        async () => {
          toggleAgentFavorite(agentToToggle);
        }
      );

      await executeCommand(command);
    },
    [toggleAgentFavorite, executeCommand]
  );

  return {
    handleSaveAgent,
    handleDeleteAgent,
    handleBulkDelete,
    handleImportAgents,
    handleToggleFavorite,
  };
}
