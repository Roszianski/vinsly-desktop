import { renderHook, act, waitFor } from '@testing-library/react';
import { useWorkspace } from '../useWorkspace';
import { Agent, AgentScope, ScanSettings, Skill } from '../../types';
import * as storage from '../../utils/storage';
import * as tauriCommands from '../../utils/tauriCommands';
import * as agentImport from '../../utils/agentImport';
import * as agentExport from '../../utils/agentExport';
import * as skillParser from '../../utils/skillParser';
import { ToastType } from '../../components/Toast';

jest.mock('../../utils/storage', () => ({
  getStorageItem: jest.fn(),
  setStorageItem: jest.fn(),
  removeStorageItem: jest.fn(),
}));

jest.mock('../../utils/tauriCommands', () => ({
  listAgents: jest.fn(),
  listSkills: jest.fn(),
  listAgentsFromDirectory: jest.fn(),
  listSkillsFromDirectory: jest.fn(),
  writeAgent: jest.fn(),
  deleteAgent: jest.fn(),
  writeSkill: jest.fn(),
  deleteSkill: jest.fn(),
  migrateSkill: jest.fn(),
}));

jest.mock('../../utils/agentImport', () => ({
  markdownToAgent: jest.fn(),
}));

jest.mock('../../utils/agentExport', () => ({
  agentToMarkdown: jest.fn(),
}));

jest.mock('../../utils/skillParser', () => ({
  skillFileToSkill: jest.fn(),
  skillToMarkdown: jest.fn(),
}));

const mockShowToast = jest.fn<void, [ToastType, string]>();

const scanSettingsRef = { current: { autoScanGlobalOnStartup: false, autoScanWatchedOnStartup: false, autoScanHomeDirectoryOnStartup: false, fullDiskAccessEnabled: false, watchedDirectories: [] } as ScanSettings };

describe('useWorkspace', () => {
  const agent: Agent = {
    id: 'a1',
    name: 'Agent One',
    scope: AgentScope.Global,
    path: '/tmp/agent.md',
    frontmatter: { name: 'Agent One', description: '' },
    body: '',
  };

  const skill: Skill = {
    id: 's1',
    name: 'Skill One',
    scope: AgentScope.Global,
    directoryPath: '/tmp/skill',
    path: '/tmp/skill/skill.md',
    frontmatter: { name: 'Skill One', description: '' },
    body: '',
    hasAssets: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (storage.getStorageItem as jest.Mock).mockResolvedValue(null);
    (tauriCommands.listAgents as jest.Mock).mockResolvedValue([{ content: '---\nname: Agent One\n---', name: 'Agent One', path: agent.path }]);
    (tauriCommands.listSkills as jest.Mock).mockResolvedValue([{ content: '---\nname: Skill One\n---', name: 'Skill One', directory: skill.directoryPath, path: skill.path, scope: 'global', has_assets: false }]);
    (tauriCommands.listAgentsFromDirectory as jest.Mock).mockResolvedValue([]);
    (tauriCommands.listSkillsFromDirectory as jest.Mock).mockResolvedValue([]);
    (agentImport.markdownToAgent as jest.Mock).mockReturnValue(agent);
    (skillParser.skillFileToSkill as jest.Mock).mockReturnValue(skill);
    (agentExport.agentToMarkdown as jest.Mock).mockReturnValue('markdown');
    (skillParser.skillToMarkdown as jest.Mock).mockReturnValue('skill-md');
    (tauriCommands.writeAgent as jest.Mock).mockResolvedValue('/tmp/agent.md');
    (tauriCommands.writeSkill as jest.Mock).mockResolvedValue('/tmp/skill/skill.md');
    (tauriCommands.migrateSkill as jest.Mock).mockResolvedValue('/tmp/skill/skill.md');
    (tauriCommands.deleteAgent as jest.Mock).mockResolvedValue(undefined);
    (tauriCommands.deleteSkill as jest.Mock).mockResolvedValue(undefined);
  });

  test('loadAgents hydrates agents and skills', async () => {
    const { result } = renderHook(() =>
      useWorkspace({ showToast: mockShowToast, scanSettingsRef, isOnboardingComplete: true })
    );

    await act(async () => {
      await result.current.loadAgents({ includeGlobal: true });
    });

    await waitFor(() => {
      expect(result.current.agents).toHaveLength(1);
      expect(result.current.skills).toHaveLength(1);
    });
  });

  test('toggleAgentFavorite flips flag', async () => {
    const { result } = renderHook(() =>
      useWorkspace({ showToast: mockShowToast, scanSettingsRef, isOnboardingComplete: true })
    );

    await act(async () => {
      await result.current.saveAgent(agent);
    });
    const savedAgent = result.current.agents[0]!;
    act(() => {
      result.current.toggleAgentFavorite(savedAgent);
    });
    expect(result.current.agents[0]?.isFavorite).toBe(true);
    // Get the updated agent after first toggle for the second toggle
    const updatedAgent = result.current.agents[0]!;
    act(() => {
      result.current.toggleAgentFavorite(updatedAgent);
    });
    expect(result.current.agents[0]?.isFavorite).toBe(false);
  });

  test('saveAgent persists via writeAgent', async () => {
    const { result } = renderHook(() =>
      useWorkspace({ showToast: mockShowToast, scanSettingsRef, isOnboardingComplete: true })
    );
    await act(async () => {
      await result.current.saveAgent(agent);
    });
    expect(tauriCommands.writeAgent).toHaveBeenCalled();
    expect(result.current.agents.find(a => a.name === agent.name)).toBeTruthy();
  });

  test('saveSkill persists via migrateSkill for existing skills', async () => {
    const { result } = renderHook(() =>
      useWorkspace({ showToast: mockShowToast, scanSettingsRef, isOnboardingComplete: true })
    );
    await act(async () => {
      await result.current.saveSkill(skill);
    });
    // Existing skills with directoryPath use migrateSkill
    expect(tauriCommands.migrateSkill).toHaveBeenCalled();
    expect(result.current.skills.find(s => s.name === skill.name)).toBeTruthy();
  });
});
