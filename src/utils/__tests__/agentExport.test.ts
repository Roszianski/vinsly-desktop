import { agentToMarkdown, exportAgent, exportAgentsAsZip } from '../agentExport';
import { Agent, AgentScope } from '../../types';
import { createMockAgent } from '../../test/helpers';
import * as dialog from '@tauri-apps/plugin-dialog';
import * as tauriCommands from '../tauriCommands';
import JSZip from 'jszip';

jest.mock('@tauri-apps/plugin-dialog', () => ({
  save: jest.fn(),
}));

jest.mock('../tauriCommands', () => ({
  exportTextFile: jest.fn(),
  exportBinaryFile: jest.fn(),
}));

describe('agentExport', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('agentToMarkdown', () => {
    it('should convert agent to markdown with frontmatter', () => {
      const agent = createMockAgent({
        name: 'Test Agent',
        frontmatter: {
          name: 'Test Agent',
          description: 'A test agent',
          model: 'sonnet',
          color: 'blue',
        },
        body: 'This is the agent prompt.',
      });

      const markdown = agentToMarkdown(agent);

      expect(markdown).toContain('---');
      expect(markdown).toContain('name: Test Agent');
      expect(markdown).toContain('description: A test agent');
      expect(markdown).toContain('model: sonnet');
      expect(markdown).toContain('color: blue');
      expect(markdown).toContain('This is the agent prompt.');
    });

    it('should handle agent with empty body', () => {
      const agent = createMockAgent({
        body: '',
      });

      const markdown = agentToMarkdown(agent);

      expect(markdown).toContain('---');
      expect(markdown).toMatch(/---\n\n$/); // Should end with frontmatter delimiter and empty body
    });

    it('should handle agent with undefined body', () => {
      const agent = createMockAgent({
        body: undefined as any,
      });

      const markdown = agentToMarkdown(agent);

      expect(markdown).toContain('---');
      expect(markdown).not.toContain('undefined');
    });

    it('should preserve arrays in frontmatter', () => {
      const agent = createMockAgent({
        frontmatter: {
          name: 'Test Agent',
          description: 'Test',
          tools: ['read', 'write', 'bash'],
        },
      });

      const markdown = agentToMarkdown(agent);

      expect(markdown).toContain('tools:');
      expect(markdown).toContain('- read');
      expect(markdown).toContain('- write');
      expect(markdown).toContain('- bash');
    });

    it('should handle special characters in body', () => {
      const agent = createMockAgent({
        body: 'Body with "quotes" and \'apostrophes\' and\nmultiple\nlines',
      });

      const markdown = agentToMarkdown(agent);

      expect(markdown).toContain('Body with "quotes"');
      expect(markdown).toContain('multiple\nlines');
    });

    it('should filter out undefined values from frontmatter', () => {
      const agent = createMockAgent({
        frontmatter: {
          name: 'Test Agent',
          description: 'Test',
          optional_field: undefined,
        },
      });

      const markdown = agentToMarkdown(agent);

      expect(markdown).not.toContain('optional_field');
      expect(markdown).not.toContain('undefined');
    });

    it('should maintain proper YAML structure', () => {
      const agent = createMockAgent();
      const markdown = agentToMarkdown(agent);

      // Extract frontmatter
      const match = markdown.match(/^---\n([\s\S]*?)\n---/);
      expect(match).not.toBeNull();

      // Verify it's valid YAML by checking structure
      const yamlContent = match![1];
      expect(yamlContent).toMatch(/^name:/m);
      expect(yamlContent).toMatch(/^description:/m);
    });
  });

  describe('exportAgent', () => {
    it('should export agent successfully when user selects path', async () => {
      const agent = createMockAgent({
        name: 'Export Test',
        frontmatter: {
          name: 'Export Test',
          description: 'A test agent for unit tests',
          model: 'sonnet',
          color: 'blue',
        },
      });
      const mockPath = '/path/to/Export Test.md';

      (dialog.save as jest.Mock).mockResolvedValue(mockPath);
      (tauriCommands.exportTextFile as jest.Mock).mockResolvedValue(undefined);

      const result = await exportAgent(agent);

      expect(result).toBe(true);
      expect(dialog.save).toHaveBeenCalledWith({
        defaultPath: 'Export Test.md',
        filters: [{ name: 'Markdown', extensions: ['md'] }],
      });
      expect(tauriCommands.exportTextFile).toHaveBeenCalledWith(
        mockPath,
        expect.stringContaining('name: Export Test')
      );
    });

    it('should return false when user cancels export', async () => {
      const agent = createMockAgent();

      (dialog.save as jest.Mock).mockResolvedValue(null);

      const result = await exportAgent(agent);

      expect(result).toBe(false);
      expect(tauriCommands.exportTextFile).not.toHaveBeenCalled();
    });

    it('should throw error when file write fails', async () => {
      const agent = createMockAgent();
      const mockPath = '/path/to/agent.md';
      const mockError = new Error('Write permission denied');

      (dialog.save as jest.Mock).mockResolvedValue(mockPath);
      (tauriCommands.exportTextFile as jest.Mock).mockRejectedValue(mockError);

      await expect(exportAgent(agent)).rejects.toThrow('Write permission denied');
    });

    it('should handle agent with special characters in name', async () => {
      const agent = createMockAgent({ name: 'Agent: Test/Name' });
      const mockPath = '/path/to/export.md';

      (dialog.save as jest.Mock).mockResolvedValue(mockPath);
      (tauriCommands.exportTextFile as jest.Mock).mockResolvedValue(undefined);

      const result = await exportAgent(agent);

      expect(result).toBe(true);
      expect(dialog.save).toHaveBeenCalledWith({
        defaultPath: 'Agent: Test/Name.md',
        filters: [{ name: 'Markdown', extensions: ['md'] }],
      });
    });
  });

  describe('exportAgentsAsZip', () => {
    it('should export multiple agents as ZIP successfully', async () => {
      const agents = [
        createMockAgent({ name: 'Agent One' }),
        createMockAgent({ name: 'Agent Two' }),
        createMockAgent({ name: 'Agent Three' }),
      ];
      const mockPath = '/path/to/agents.zip';

      (dialog.save as jest.Mock).mockResolvedValue(mockPath);
      (tauriCommands.exportBinaryFile as jest.Mock).mockResolvedValue(undefined);

      const result = await exportAgentsAsZip(agents);

      expect(result).toBe(true);
      expect(dialog.save).toHaveBeenCalledWith({
        defaultPath: 'agents.zip',
        filters: [{ name: 'ZIP Archive', extensions: ['zip'] }],
      });
      expect(tauriCommands.exportBinaryFile).toHaveBeenCalledWith(
        mockPath,
        expect.any(Uint8Array)
      );
    });

    it('should use custom zip name when provided', async () => {
      const agents = [createMockAgent()];
      const mockPath = '/path/to/custom-name.zip';

      (dialog.save as jest.Mock).mockResolvedValue(mockPath);
      (tauriCommands.exportBinaryFile as jest.Mock).mockResolvedValue(undefined);

      await exportAgentsAsZip(agents, 'custom-name');

      expect(dialog.save).toHaveBeenCalledWith({
        defaultPath: 'custom-name.zip',
        filters: [{ name: 'ZIP Archive', extensions: ['zip'] }],
      });
    });

    it('should return false when user cancels export', async () => {
      const agents = [createMockAgent()];

      (dialog.save as jest.Mock).mockResolvedValue(null);

      const result = await exportAgentsAsZip(agents);

      expect(result).toBe(false);
      expect(tauriCommands.exportBinaryFile).not.toHaveBeenCalled();
    });

    it('should handle empty agents array', async () => {
      const mockPath = '/path/to/empty.zip';

      (dialog.save as jest.Mock).mockResolvedValue(mockPath);
      (tauriCommands.exportBinaryFile as jest.Mock).mockResolvedValue(undefined);

      const result = await exportAgentsAsZip([]);

      expect(result).toBe(true);

      // Verify empty ZIP was created
      const writeCall = (tauriCommands.exportBinaryFile as jest.Mock).mock.calls[0];
      const zipData = writeCall[1];

      // Load the ZIP to verify it's valid but empty
      const zip = await JSZip.loadAsync(zipData);
      const files = Object.keys(zip.files);

      expect(files).toHaveLength(0);
    });

    it('should create valid ZIP structure with correct filenames', async () => {
      const agents = [
        createMockAgent({ name: 'First Agent' }),
        createMockAgent({ name: 'Second Agent' }),
      ];
      const mockPath = '/path/to/test.zip';

      (dialog.save as jest.Mock).mockResolvedValue(mockPath);
      (tauriCommands.exportBinaryFile as jest.Mock).mockResolvedValue(undefined);

      await exportAgentsAsZip(agents);

      const writeCall = (tauriCommands.exportBinaryFile as jest.Mock).mock.calls[0];
      const zipData = writeCall[1];

      // Verify ZIP structure
      const zip = await JSZip.loadAsync(zipData);
      const files = Object.keys(zip.files);

      expect(files).toHaveLength(2);
      expect(files).toContain('First Agent.md');
      expect(files).toContain('Second Agent.md');
    });

    it('should preserve agent content in ZIP files', async () => {
      const agents = [
        createMockAgent({
          name: 'Test Agent',
          frontmatter: {
            name: 'Test Agent',
            description: 'Test description',
            model: 'sonnet',
          },
          body: 'Test agent body content',
        }),
      ];
      const mockPath = '/path/to/test.zip';

      (dialog.save as jest.Mock).mockResolvedValue(mockPath);
      (tauriCommands.exportBinaryFile as jest.Mock).mockResolvedValue(undefined);

      await exportAgentsAsZip(agents);

      const writeCall = (tauriCommands.exportBinaryFile as jest.Mock).mock.calls[0];
      const zipData = writeCall[1];

      // Verify file content in ZIP
      const zip = await JSZip.loadAsync(zipData);
      const content = await zip.file('Test Agent.md')!.async('text');

      expect(content).toContain('name: Test Agent');
      expect(content).toContain('description: Test description');
      expect(content).toContain('Test agent body content');
    });

    it('should throw error when ZIP write fails', async () => {
      const agents = [createMockAgent()];
      const mockPath = '/path/to/agents.zip';
      const mockError = new Error('Disk full');

      (dialog.save as jest.Mock).mockResolvedValue(mockPath);
      (tauriCommands.exportBinaryFile as jest.Mock).mockRejectedValue(mockError);

      await expect(exportAgentsAsZip(agents)).rejects.toThrow('Disk full');
    });

    it('should handle agents with duplicate names', async () => {
      const agents = [
        createMockAgent({ name: 'Duplicate' }),
        createMockAgent({ name: 'Duplicate' }),
      ];
      const mockPath = '/path/to/test.zip';

      (dialog.save as jest.Mock).mockResolvedValue(mockPath);
      (tauriCommands.exportBinaryFile as jest.Mock).mockResolvedValue(undefined);

      await exportAgentsAsZip(agents);

      const writeCall = (tauriCommands.exportBinaryFile as jest.Mock).mock.calls[0];
      const zipData = writeCall[1];

      const zip = await JSZip.loadAsync(zipData);
      const files = Object.keys(zip.files);

      // JSZip will overwrite duplicate names, so only one file should exist
      expect(files).toHaveLength(1);
      expect(files).toContain('Duplicate.md');
    });
  });
});
