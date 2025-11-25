import { useCallback, useState } from 'react';
import { Agent, AgentScope, Skill } from '../types';

export type View =
  | 'subagents'
  | 'skills'
  | 'team'
  | 'analytics'
  | 'edit'
  | 'create'
  | 'duplicate'
  | 'create-skill'
  | 'edit-skill';

export interface UseNavigationResult {
  currentView: View;
  selectedAgent: Agent | null;
  selectedSkill: Skill | null;
  returnDestination: 'subagents' | 'team' | 'skills';
  navigateHome: () => void;
  navigateToEdit: (agent: Agent, from: 'subagents' | 'team') => void;
  navigateToCreate: (from: 'subagents' | 'team') => void;
  navigateToDuplicate: (agent: Agent, from: 'subagents' | 'team') => void;
  navigateToSkillEdit: (skill: Skill) => void;
  navigateToSkillCreate: () => void;
  navigateToView: (view: 'subagents' | 'skills' | 'team' | 'analytics') => void;
  cancelEditing: () => void;
  createAgentTemplate: () => Agent;
  createSkillTemplate: () => Skill;
}

export function useNavigation(options?: { agents?: Agent[]; initialView?: View }): UseNavigationResult {
  const agents = options?.agents ?? [];
  const [currentView, setCurrentView] = useState<View>(options?.initialView ?? 'subagents');
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [returnDestination, setReturnDestination] = useState<'subagents' | 'team' | 'skills'>('subagents');

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

  const navigateHome = useCallback(() => {
    setCurrentView('subagents');
    setReturnDestination('subagents');
    setSelectedAgent(null);
    setSelectedSkill(null);
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

  const navigateToView = useCallback(
    (view: 'subagents' | 'skills' | 'team' | 'analytics') => {
      setCurrentView(view);
      if (view === 'subagents' || view === 'team' || view === 'skills') {
        setReturnDestination(view);
      }
    },
    []
  );

  const cancelEditing = useCallback(() => {
    setCurrentView(returnDestination);
    setSelectedAgent(null);
    setSelectedSkill(null);
  }, [returnDestination]);

  return {
    currentView,
    selectedAgent,
    selectedSkill,
    returnDestination,
    navigateHome,
    navigateToEdit,
    navigateToCreate,
    navigateToDuplicate,
    navigateToSkillEdit,
    navigateToSkillCreate,
    navigateToView,
    cancelEditing,
    createAgentTemplate,
    createSkillTemplate,
  };
}
