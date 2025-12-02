import React, { createContext, useContext, useCallback } from 'react';
import { Agent, AgentScope, Skill, SlashCommand, ClaudeMemory } from '../types';
import { MCPServer } from '../types/mcp';
import { Hook } from '../types/hooks';
import { useNavigation, View } from '../hooks/useNavigation';
import { useWorkspaceContext } from './WorkspaceContext';

interface NavigationContextType {
  currentView: View;
  selectedAgent: Agent | null;
  selectedSkill: Skill | null;
  selectedCommand: SlashCommand | null;
  selectedMemory: ClaudeMemory | null;
  selectedMCPServer: MCPServer | null;
  selectedHook: Hook | null;

  // Navigation actions
  navigateHome: () => void;
  navigateToView: (view: 'subagents' | 'skills' | 'team' | 'analytics' | 'memory' | 'commands' | 'mcp' | 'hooks') => void;
  cancelEditing: () => void;

  // Agent navigation
  navigateToAgentCreate: (returnView?: 'subagents' | 'team') => void;
  navigateToAgentEdit: (agent: Agent, returnView?: 'subagents' | 'team') => void;
  navigateToAgentDuplicate: (agent: Agent, returnView?: 'subagents' | 'team') => void;

  // Skill navigation
  navigateToSkillCreate: () => void;
  navigateToSkillEdit: (skill: Skill) => void;

  // Command navigation
  navigateToCommandCreate: () => void;
  navigateToCommandEdit: (command: SlashCommand) => void;

  // Memory navigation
  navigateToMemoryCreate: () => void;
  navigateToMemoryEdit: (memory: ClaudeMemory) => void;

  // MCP navigation
  navigateToMCPCreate: () => void;
  navigateToMCPEdit: (server: MCPServer) => void;

  // Hook navigation
  navigateToHookCreate: () => void;
  navigateToHookEdit: (hook: Hook) => void;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

interface NavigationProviderProps {
  children: React.ReactNode;
}

export const NavigationProvider: React.FC<NavigationProviderProps> = ({ children }) => {
  const { agents } = useWorkspaceContext();

  const navigation = useNavigation({ agents });

  const {
    currentView,
    selectedAgent,
    selectedSkill,
    selectedCommand,
    selectedMemory,
    selectedMCPServer,
    selectedHook,
    navigateHome,
    navigateToEdit,
    navigateToCreate,
    navigateToDuplicate,
    navigateToSkillEdit,
    navigateToSkillCreate,
    navigateToCommandEdit,
    navigateToCommandCreate,
    navigateToMemoryEdit,
    navigateToMemoryCreate,
    navigateToMCPEdit,
    navigateToMCPCreate,
    navigateToHookEdit,
    navigateToHookCreate,
    navigateToView,
    cancelEditing,
  } = navigation;

  // Helper to determine return destination for agent navigation
  const getAgentReturnView = useCallback((): 'subagents' | 'team' => {
    return currentView === 'team' ? 'team' : 'subagents';
  }, [currentView]);

  // Wrap navigation functions with clearer names
  const navigateToAgentCreate = useCallback((returnView?: 'subagents' | 'team') => {
    navigateToCreate(returnView ?? getAgentReturnView());
  }, [getAgentReturnView, navigateToCreate]);

  const navigateToAgentEdit = useCallback((agent: Agent, returnView?: 'subagents' | 'team') => {
    navigateToEdit(agent, returnView ?? getAgentReturnView());
  }, [getAgentReturnView, navigateToEdit]);

  const navigateToAgentDuplicate = useCallback((agent: Agent, returnView?: 'subagents' | 'team') => {
    navigateToDuplicate(agent, returnView ?? getAgentReturnView());
  }, [getAgentReturnView, navigateToDuplicate]);

  const value: NavigationContextType = {
    currentView,
    selectedAgent,
    selectedSkill,
    selectedCommand,
    selectedMemory,
    selectedMCPServer,
    selectedHook,

    navigateHome,
    navigateToView,
    cancelEditing,

    navigateToAgentCreate,
    navigateToAgentEdit,
    navigateToAgentDuplicate,

    navigateToSkillCreate,
    navigateToSkillEdit,

    navigateToCommandCreate,
    navigateToCommandEdit,

    navigateToMemoryCreate,
    navigateToMemoryEdit,

    navigateToMCPCreate,
    navigateToMCPEdit,

    navigateToHookCreate,
    navigateToHookEdit,
  };

  return (
    <NavigationContext.Provider value={value}>
      {children}
    </NavigationContext.Provider>
  );
};

export const useNavigationContext = () => {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigationContext must be used within a NavigationProvider');
  }
  return context;
};
