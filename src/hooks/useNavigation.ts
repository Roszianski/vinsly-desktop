import { useCallback, useState } from 'react';
import { Agent, AgentScope, ClaudeMemory, Skill, SlashCommand } from '../types';
import { MCPServer } from '../types/mcp';
import { Hook, HookScope } from '../types/hooks';

export type View =
  | 'subagents'
  | 'skills'
  | 'team'
  | 'analytics'
  | 'memory'
  | 'commands'
  | 'mcp'
  | 'hooks'
  | 'edit'
  | 'create'
  | 'duplicate'
  | 'create-skill'
  | 'edit-skill'
  | 'create-command'
  | 'edit-command'
  | 'create-memory'
  | 'edit-memory'
  | 'create-mcp'
  | 'edit-mcp'
  | 'create-hook'
  | 'edit-hook';

export type ListViewDestination = 'subagents' | 'team' | 'skills' | 'commands' | 'memory' | 'mcp' | 'hooks';

export interface UseNavigationResult {
  currentView: View;
  selectedAgent: Agent | null;
  selectedSkill: Skill | null;
  selectedCommand: SlashCommand | null;
  selectedMemory: ClaudeMemory | null;
  selectedMCPServer: MCPServer | null;
  selectedHook: Hook | null;
  returnDestination: ListViewDestination;
  navigateHome: () => void;
  navigateToEdit: (agent: Agent, from: 'subagents' | 'team') => void;
  navigateToCreate: (from: 'subagents' | 'team') => void;
  navigateToDuplicate: (agent: Agent, from: 'subagents' | 'team') => void;
  navigateToSkillEdit: (skill: Skill) => void;
  navigateToSkillCreate: () => void;
  navigateToCommandEdit: (command: SlashCommand) => void;
  navigateToCommandCreate: () => void;
  navigateToMemoryEdit: (memory: ClaudeMemory) => void;
  navigateToMemoryCreate: () => void;
  navigateToMCPEdit: (server: MCPServer) => void;
  navigateToMCPCreate: () => void;
  navigateToHookEdit: (hook: Hook) => void;
  navigateToHookCreate: () => void;
  navigateToView: (view: 'subagents' | 'skills' | 'team' | 'analytics' | 'memory' | 'commands' | 'mcp' | 'hooks') => void;
  cancelEditing: () => void;
  createAgentTemplate: () => Agent;
  createSkillTemplate: () => Skill;
  createCommandTemplate: () => SlashCommand;
  createMemoryTemplate: () => ClaudeMemory;
  createHookTemplate: () => Hook;
}

export function useNavigation(options?: { agents?: Agent[]; initialView?: View }): UseNavigationResult {
  const agents = options?.agents ?? [];
  const [currentView, setCurrentView] = useState<View>(options?.initialView ?? 'subagents');
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [selectedCommand, setSelectedCommand] = useState<SlashCommand | null>(null);
  const [selectedMemory, setSelectedMemory] = useState<ClaudeMemory | null>(null);
  const [selectedMCPServer, setSelectedMCPServer] = useState<MCPServer | null>(null);
  const [selectedHook, setSelectedHook] = useState<Hook | null>(null);
  const [returnDestination, setReturnDestination] = useState<ListViewDestination>('subagents');

  const createAgentTemplate = useCallback(
    (): Agent => ({
      id: '',
      name: '',
      scope: AgentScope.Global,
      path: '',
      frontmatter: {
        name: '',
        description: '',
      },
      body: '',
    }),
    []
  );

  const createSkillTemplate = useCallback(
    (): Skill => ({
      id: '',
      name: '',
      scope: AgentScope.Global,
      directoryPath: '',
      path: '',
      frontmatter: {
        name: '',
        description: '',
      },
      body: '',
      hasAssets: false,
    }),
    []
  );

  const createCommandTemplate = useCallback(
    (): SlashCommand => ({
      id: '',
      name: '',
      scope: AgentScope.Global,
      path: '',
      description: '',
      body: '',
    }),
    []
  );

  const createMemoryTemplate = useCallback(
    (): ClaudeMemory => ({
      id: '',
      scope: AgentScope.Global,
      path: '',
      content: '',
      exists: false,
    }),
    []
  );

  const createHookTemplate = useCallback(
    (): Hook => ({
      id: '',
      name: '',
      type: 'PreToolUse',
      command: '',
      scope: 'user',
      sourcePath: '',
      enabled: true,
    }),
    []
  );

  const navigateHome = useCallback(() => {
    setCurrentView('subagents');
    setReturnDestination('subagents');
    setSelectedAgent(null);
    setSelectedSkill(null);
    setSelectedCommand(null);
    setSelectedMemory(null);
    setSelectedMCPServer(null);
    setSelectedHook(null);
  }, []);

  const navigateToEdit = useCallback((agent: Agent, from: 'subagents' | 'team') => {
    setSelectedAgent(agent);
    setReturnDestination(from);
    setCurrentView('edit');
  }, []);

  const navigateToCreate = useCallback(
    (from: 'subagents' | 'team') => {
      setSelectedAgent(createAgentTemplate());
      setReturnDestination(from);
      setCurrentView('create');
    },
    [createAgentTemplate]
  );

  const navigateToDuplicate = useCallback(
    (agent: Agent, from: 'subagents' | 'team') => {
      const duplicatedAgent: Agent = JSON.parse(JSON.stringify(agent));
      let newName = `${agent.name}-copy`;
      let i = 1;
      while (agents.some(existing => existing.name === newName)) {
        i += 1;
        newName = `${agent.name}-copy-${i}`;
      }

      duplicatedAgent.name = newName;
      duplicatedAgent.frontmatter.name = newName;
      duplicatedAgent.id = '';
      duplicatedAgent.path = '';

      setSelectedAgent(duplicatedAgent);
      setReturnDestination(from);
      setCurrentView('duplicate');
    },
    [agents]
  );

  const navigateToSkillEdit = useCallback((skill: Skill) => {
    setSelectedSkill(skill);
    setReturnDestination('skills');
    setCurrentView('edit-skill');
  }, []);

  const navigateToSkillCreate = useCallback(() => {
    setSelectedSkill(createSkillTemplate());
    setReturnDestination('skills');
    setCurrentView('create-skill');
  }, [createSkillTemplate]);

  const navigateToCommandEdit = useCallback((command: SlashCommand) => {
    setSelectedCommand(command);
    setReturnDestination('commands');
    setCurrentView('edit-command');
  }, []);

  const navigateToCommandCreate = useCallback(() => {
    setSelectedCommand(createCommandTemplate());
    setReturnDestination('commands');
    setCurrentView('create-command');
  }, [createCommandTemplate]);

  const navigateToMemoryEdit = useCallback((memory: ClaudeMemory) => {
    setSelectedMemory(memory);
    setReturnDestination('memory');
    setCurrentView('edit-memory');
  }, []);

  const navigateToMemoryCreate = useCallback(() => {
    setSelectedMemory(createMemoryTemplate());
    setReturnDestination('memory');
    setCurrentView('create-memory');
  }, [createMemoryTemplate]);

  const navigateToMCPEdit = useCallback((server: MCPServer) => {
    setSelectedMCPServer(server);
    setReturnDestination('mcp');
    setCurrentView('edit-mcp');
  }, []);

  const navigateToMCPCreate = useCallback(() => {
    setSelectedMCPServer(null);
    setReturnDestination('mcp');
    setCurrentView('create-mcp');
  }, []);

  const navigateToHookEdit = useCallback((hook: Hook) => {
    setSelectedHook(hook);
    setReturnDestination('hooks');
    setCurrentView('edit-hook');
  }, []);

  const navigateToHookCreate = useCallback(() => {
    setSelectedHook(createHookTemplate());
    setReturnDestination('hooks');
    setCurrentView('create-hook');
  }, [createHookTemplate]);

  const navigateToView = useCallback(
    (view: 'subagents' | 'skills' | 'team' | 'analytics' | 'memory' | 'commands' | 'mcp' | 'hooks') => {
      setCurrentView(view);
      if (view === 'subagents' || view === 'team' || view === 'skills' || view === 'commands' || view === 'memory' || view === 'mcp' || view === 'hooks') {
        setReturnDestination(view);
      }
    },
    []
  );

  const cancelEditing = useCallback(() => {
    setCurrentView(returnDestination);
    setSelectedAgent(null);
    setSelectedSkill(null);
    setSelectedCommand(null);
    setSelectedMemory(null);
    setSelectedMCPServer(null);
    setSelectedHook(null);
  }, [returnDestination]);

  return {
    currentView,
    selectedAgent,
    selectedSkill,
    selectedCommand,
    selectedMemory,
    selectedMCPServer,
    selectedHook,
    returnDestination,
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
    createAgentTemplate,
    createSkillTemplate,
    createCommandTemplate,
    createMemoryTemplate,
    createHookTemplate,
  };
}
