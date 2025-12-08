import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { WorkspaceProvider, useWorkspaceContext } from '../WorkspaceContext';
import { ToastProvider } from '../ToastContext';
import { LicenseProvider } from '../LicenseContext';
import { Agent, AgentScope, Skill, ScanSettings } from '../../types';
import * as storage from '../../utils/storage';
import * as tauriCommands from '../../utils/tauriCommands';
import * as agentImport from '../../utils/agentImport';
import * as agentExport from '../../utils/agentExport';
import * as skillParser from '../../utils/skillParser';
import * as scanSettings from '../../utils/scanSettings';
import * as homeDiscovery from '../../utils/homeDiscovery';
import * as lemonLicensingClient from '../../utils/lemonLicensingClient';

// Mock all external dependencies
jest.mock('../../utils/storage', () => ({
  getStorageItem: jest.fn(),
  setStorageItem: jest.fn(),
  removeStorageItem: jest.fn(),
}));

jest.mock('../../utils/tauriCommands', () => ({
  // Agents
  listAgents: jest.fn(),
  listAgentsFromDirectory: jest.fn(),
  writeAgent: jest.fn(),
  deleteAgent: jest.fn(),
  // Skills
  listSkills: jest.fn(),
  listSkillsFromDirectory: jest.fn(),
  writeSkill: jest.fn(),
  deleteSkill: jest.fn(),
  migrateSkill: jest.fn(),
  // Slash Commands
  listSlashCommands: jest.fn(),
  listSlashCommandsFromDirectory: jest.fn(),
  writeSlashCommand: jest.fn(),
  deleteSlashCommand: jest.fn(),
  // MCP Servers
  listMCPServers: jest.fn(),
  addMCPServer: jest.fn(),
  removeMCPServer: jest.fn(),
  // Hooks
  listHooks: jest.fn(),
  addHook: jest.fn(),
  removeHook: jest.fn(),
  // Memory
  readClaudeMemory: jest.fn(),
  writeClaudeMemory: jest.fn(),
  checkClaudeMemoryExists: jest.fn(),
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

jest.mock('../../utils/scanSettings', () => ({
  getScanSettings: jest.fn(),
  saveScanSettings: jest.fn(),
  DEFAULT_SCAN_SETTINGS: {
    autoScanGlobalOnStartup: false,
    autoScanHomeDirectoryOnStartup: false,
    fullDiskAccessEnabled: false,
    watchedDirectories: [],
  },
}));

jest.mock('../../utils/homeDiscovery', () => ({
  discoverHomeDirectories: jest.fn(),
  DEFAULT_HOME_DISCOVERY_DEPTH: 2,
}));

jest.mock('../../utils/lemonLicensingClient', () => ({
  validateLicenseWithLemon: jest.fn(),
  activateLicenseWithLemon: jest.fn(),
  deactivateLicenseWithLemon: jest.fn(),
}));

// Mock navigator
Object.defineProperty(navigator, 'onLine', { value: true, writable: true });

const defaultScanSettings: ScanSettings = {
  autoScanGlobalOnStartup: false,
  autoScanWatchedOnStartup: false,
  autoScanHomeDirectoryOnStartup: false,
  fullDiskAccessEnabled: false,
  watchedDirectories: [],
};

const mockAgent: Agent = {
  id: 'agent-1',
  name: 'Test Agent',
  scope: AgentScope.Global,
  path: '/home/user/.claude/agents/test.md',
  frontmatter: { name: 'Test Agent', description: 'A test agent' },
  body: 'Agent body content',
};

const mockSkill: Skill = {
  id: 'skill-1',
  name: 'Test Skill',
  scope: AgentScope.Global,
  directoryPath: '/home/user/.claude/skills/test',
  path: '/home/user/.claude/skills/test/skill.md',
  frontmatter: { name: 'Test Skill', description: 'A test skill' },
  body: 'Skill body content',
  hasAssets: false,
};

function createWrapper() {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <ToastProvider>
        <LicenseProvider>
          <WorkspaceProvider>{children}</WorkspaceProvider>
        </LicenseProvider>
      </ToastProvider>
    );
  };
}

describe('WorkspaceContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mock returns
    (storage.getStorageItem as jest.Mock).mockImplementation((key: string, defaultValue?: unknown) => {
      if (key === 'license-data') {
        return Promise.resolve({
          key: 'test-license-key',
          instanceId: 'test-instance',
          activatedAt: Date.now(),
          isValid: true,
        });
      }
      if (key === 'onboarding-complete') {
        return Promise.resolve(true);
      }
      return Promise.resolve(defaultValue ?? null);
    });

    (scanSettings.getScanSettings as jest.Mock).mockResolvedValue(defaultScanSettings);
    (homeDiscovery.discoverHomeDirectories as jest.Mock).mockResolvedValue([]);

    // Agent/skill loading mocks
    (tauriCommands.listAgents as jest.Mock).mockResolvedValue([]);
    (tauriCommands.listSkills as jest.Mock).mockResolvedValue([]);
    (tauriCommands.listAgentsFromDirectory as jest.Mock).mockResolvedValue([]);
    (tauriCommands.listSkillsFromDirectory as jest.Mock).mockResolvedValue([]);
    (agentImport.markdownToAgent as jest.Mock).mockReturnValue(mockAgent);
    (skillParser.skillFileToSkill as jest.Mock).mockReturnValue(mockSkill);
    (agentExport.agentToMarkdown as jest.Mock).mockReturnValue('---\nname: Test\n---\nBody');
    (skillParser.skillToMarkdown as jest.Mock).mockReturnValue('skill markdown');

    // Write/delete mocks
    (tauriCommands.writeAgent as jest.Mock).mockResolvedValue('/path/to/agent.md');
    (tauriCommands.deleteAgent as jest.Mock).mockResolvedValue(undefined);
    (tauriCommands.writeSkill as jest.Mock).mockResolvedValue('/path/to/skill.md');
    (tauriCommands.deleteSkill as jest.Mock).mockResolvedValue(undefined);
    (tauriCommands.migrateSkill as jest.Mock).mockResolvedValue('/path/to/skill.md');

    // Slash commands mocks
    (tauriCommands.listSlashCommands as jest.Mock).mockResolvedValue([]);
    (tauriCommands.listSlashCommandsFromDirectory as jest.Mock).mockResolvedValue([]);
    (tauriCommands.writeSlashCommand as jest.Mock).mockResolvedValue('/path/to/command.md');
    (tauriCommands.deleteSlashCommand as jest.Mock).mockResolvedValue(undefined);

    // MCP mocks
    (tauriCommands.listMCPServers as jest.Mock).mockResolvedValue([]);
    (tauriCommands.addMCPServer as jest.Mock).mockResolvedValue(undefined);
    (tauriCommands.removeMCPServer as jest.Mock).mockResolvedValue(undefined);

    // Hooks mocks
    (tauriCommands.listHooks as jest.Mock).mockResolvedValue([]);
    (tauriCommands.addHook as jest.Mock).mockResolvedValue(undefined);
    (tauriCommands.removeHook as jest.Mock).mockResolvedValue(undefined);

    // Memory mocks
    (tauriCommands.readClaudeMemory as jest.Mock).mockResolvedValue({ exists: false, path: '', content: '' });
    (tauriCommands.writeClaudeMemory as jest.Mock).mockResolvedValue(undefined);
    (tauriCommands.checkClaudeMemoryExists as jest.Mock).mockResolvedValue(false);

    // License mocks
    (lemonLicensingClient.validateLicenseWithLemon as jest.Mock).mockResolvedValue({
      valid: true,
      error: null,
    });
  });

  describe('useWorkspaceContext hook', () => {
    it('throws error when used outside provider', () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useWorkspaceContext());
      }).toThrow('useWorkspaceContext must be used within a WorkspaceProvider');

      consoleError.mockRestore();
    });

    it('provides context when used within provider', async () => {
      const { result } = renderHook(() => useWorkspaceContext(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current).toBeDefined();
        expect(result.current.agents).toBeDefined();
        expect(result.current.skills).toBeDefined();
        expect(result.current.commands).toBeDefined();
      });
    });
  });

  describe('handleFullScan', () => {
    it('loads agents and returns scan results', async () => {
      (tauriCommands.listAgents as jest.Mock).mockResolvedValue([
        { content: '---\nname: Agent One\n---\nBody', name: 'Agent One', path: '/path/agent1.md' },
        { content: '---\nname: Agent Two\n---\nBody', name: 'Agent Two', path: '/path/agent2.md' },
      ]);

      const { result } = renderHook(() => useWorkspaceContext(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.handleFullScan).toBeDefined();
      });

      let scanResult: { total: number; newCount: number } | undefined;
      await act(async () => {
        scanResult = await result.current.handleFullScan({ includeGlobal: true });
      });

      expect(scanResult).toBeDefined();
      expect(tauriCommands.listAgents).toHaveBeenCalled();
    });

    it('uses Promise.allSettled for parallel loading', async () => {
      // Make one loader fail
      (tauriCommands.listSlashCommands as jest.Mock).mockRejectedValue(new Error('Commands failed'));

      const { result } = renderHook(() => useWorkspaceContext(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.handleFullScan).toBeDefined();
      });

      // Should not throw even when one loader fails
      await act(async () => {
        await result.current.handleFullScan({ includeGlobal: true });
      });

      // Other loaders should still be called
      expect(tauriCommands.listAgents).toHaveBeenCalled();
    });

    it('passes project paths from options', async () => {
      const { result } = renderHook(() => useWorkspaceContext(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.handleFullScan).toBeDefined();
      });

      await act(async () => {
        await result.current.handleFullScan({
          includeGlobal: true,
          additionalDirectories: ['/project/one', '/project/two'],
        });
      });

      // Verify agents were scanned from additional directories
      expect(tauriCommands.listAgentsFromDirectory).toHaveBeenCalled();
    });
  });

  describe('Agent CRUD operations', () => {
    it('saves agent via saveAgent', async () => {
      const { result } = renderHook(() => useWorkspaceContext(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.saveAgent).toBeDefined();
      });

      await act(async () => {
        await result.current.saveAgent(mockAgent);
      });

      expect(tauriCommands.writeAgent).toHaveBeenCalled();
    });

    it('deletes agent and shows undo toast', async () => {
      // Pre-populate with an agent
      (tauriCommands.listAgents as jest.Mock).mockResolvedValue([
        { content: '---\nname: Test Agent\n---\nBody', name: 'Test Agent', path: mockAgent.path },
      ]);

      const { result } = renderHook(() => useWorkspaceContext(), {
        wrapper: createWrapper(),
      });

      // Wait for initial load and then trigger a scan to load agents
      await waitFor(() => {
        expect(result.current.handleFullScan).toBeDefined();
      });

      await act(async () => {
        await result.current.handleFullScan({ includeGlobal: true });
      });

      await waitFor(() => {
        expect(result.current.agents.length).toBeGreaterThan(0);
      });

      const agentToDelete = result.current.agents[0];
      if (agentToDelete) {
        await act(async () => {
          await result.current.deleteAgent(agentToDelete.id);
        });

        expect(tauriCommands.deleteAgent).toHaveBeenCalled();
      }
    });

    it('toggles agent favorite status', async () => {
      (tauriCommands.listAgents as jest.Mock).mockResolvedValue([
        { content: '---\nname: Test Agent\n---\nBody', name: 'Test Agent', path: mockAgent.path },
      ]);

      const { result } = renderHook(() => useWorkspaceContext(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.handleFullScan).toBeDefined();
      });

      await act(async () => {
        await result.current.handleFullScan({ includeGlobal: true });
      });

      await waitFor(() => {
        expect(result.current.agents.length).toBeGreaterThan(0);
      });

      const agent = result.current.agents[0];
      if (agent) {
        const initialFavorite = agent.isFavorite ?? false;

        await act(async () => {
          await result.current.toggleAgentFavorite(agent);
        });

        expect(result.current.agents[0]?.isFavorite).toBe(!initialFavorite);
      }
    });
  });

  describe('Skill operations', () => {
    it('saves skill via saveSkill', async () => {
      const { result } = renderHook(() => useWorkspaceContext(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.saveSkill).toBeDefined();
      });

      await act(async () => {
        await result.current.saveSkill(mockSkill);
      });

      // Existing skills with directoryPath use migrateSkill
      expect(tauriCommands.migrateSkill).toHaveBeenCalled();
    });
  });

  describe('Memory operations', () => {
    it('provides memory state', async () => {
      const { result } = renderHook(() => useWorkspaceContext(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.memories).toBeDefined();
        expect(result.current.isMemoryLoading).toBeDefined();
        expect(result.current.memoryActiveScope).toBeDefined();
      });
    });

    it('saves memory via saveMemory', async () => {
      const { result } = renderHook(() => useWorkspaceContext(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.saveMemory).toBeDefined();
      });

      await act(async () => {
        await result.current.saveMemory(AgentScope.Global, 'New memory content');
      });

      expect(tauriCommands.writeClaudeMemory).toHaveBeenCalled();
    });
  });

  describe('History (Undo/Redo)', () => {
    it('provides undo/redo state', async () => {
      const { result } = renderHook(() => useWorkspaceContext(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.canUndo).toBeDefined();
        expect(result.current.canRedo).toBeDefined();
        expect(result.current.undo).toBeDefined();
        expect(result.current.redo).toBeDefined();
      });

      // Initially should not be able to undo or redo
      expect(result.current.canUndo).toBe(false);
      expect(result.current.canRedo).toBe(false);
    });
  });

  describe('Scan settings', () => {
    it('provides scan settings', async () => {
      const { result } = renderHook(() => useWorkspaceContext(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.scanSettings).toBeDefined();
        expect(result.current.applyScanSettings).toBeDefined();
      });
    });

    it('applies scan settings', async () => {
      const { result } = renderHook(() => useWorkspaceContext(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.applyScanSettings).toBeDefined();
      });

      const newSettings: ScanSettings = {
        autoScanGlobalOnStartup: true,
        autoScanWatchedOnStartup: true,
        autoScanHomeDirectoryOnStartup: true,
        fullDiskAccessEnabled: true,
        watchedDirectories: ['/watched/dir'],
      };

      act(() => {
        result.current.applyScanSettings(newSettings);
      });

      expect(result.current.scanSettings.autoScanGlobalOnStartup).toBe(true);
    });
  });
});
