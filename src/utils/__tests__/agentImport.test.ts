import { hasSubagentDefinition, markdownToAgent, importAgentFromFile, importAgentsFromZip } from '../agentImport';
import { AgentScope } from '../../types';
import { createMockFile, createMockMarkdown } from '../../test/helpers';
import { mockMarkdownWithFrontmatter, mockMarkdownWithoutFrontmatter, mockMarkdownWithMissingFields } from '../../test/fixtures';
import JSZip from 'jszip';

describe('agentImport', () => {
  describe('hasSubagentDefinition', () => {
    it('should return true for valid agent markdown', () => {
      expect(hasSubagentDefinition(mockMarkdownWithFrontmatter)).toBe(true);
    });

    it('should return false for markdown without frontmatter', () => {
      expect(hasSubagentDefinition(mockMarkdownWithoutFrontmatter)).toBe(false);
    });

    it('should return false for markdown with missing required fields', () => {
      expect(hasSubagentDefinition(mockMarkdownWithMissingFields)).toBe(false);
    });

    it('should return false for markdown with empty name', () => {
      const markdown = createMockMarkdown({
        name: '',
        description: 'Test description',
      });
      expect(hasSubagentDefinition(markdown)).toBe(false);
    });

    it('should return false for markdown with empty description', () => {
      const markdown = createMockMarkdown({
        name: 'Test Agent',
        description: '',
      });
      expect(hasSubagentDefinition(markdown)).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(hasSubagentDefinition('')).toBe(false);
    });
  });

  describe('markdownToAgent', () => {
    it('should convert valid markdown to Agent object', () => {
      const agent = markdownToAgent(mockMarkdownWithFrontmatter, 'sample.md', AgentScope.Global);

      expect(agent).not.toBeNull();
      expect(agent?.name).toBe('Sample Agent');
      expect(agent?.frontmatter.description).toBe('A sample agent for testing');
      expect(agent?.frontmatter.model).toBe('sonnet');
      expect(agent?.scope).toBe(AgentScope.Global);
      expect(agent?.body).toContain('This is the agent\'s prompt body');
    });

    it('should return null for invalid markdown', () => {
      const agent = markdownToAgent(mockMarkdownWithoutFrontmatter, 'invalid.md');
      expect(agent).toBeNull();
    });

    it('should return null for markdown with missing required fields', () => {
      const agent = markdownToAgent(mockMarkdownWithMissingFields, 'incomplete.md');
      expect(agent).toBeNull();
    });

    it('should handle Project scope agents', () => {
      const agent = markdownToAgent(mockMarkdownWithFrontmatter, 'project-agent.md', AgentScope.Project);

      expect(agent).not.toBeNull();
      expect(agent?.scope).toBe(AgentScope.Project);
      expect(agent?.path).toContain('.claude/agents/');
    });

    it('should use provided actualPath when available', () => {
      const actualPath = '/absolute/path/to/agent.md';
      const agent = markdownToAgent(mockMarkdownWithFrontmatter, 'agent.md', AgentScope.Global, actualPath);

      expect(agent).not.toBeNull();
      expect(agent?.path).toBe(actualPath);
      expect(agent?.id).toBe(actualPath);
    });

    it('should preserve all frontmatter fields', () => {
      const markdown = createMockMarkdown({
        name: 'Test Agent',
        description: 'Test description',
        model: 'claude-opus-4',
        custom_field: 'custom_value',
        tools: ['read', 'write'],
      });

      const agent = markdownToAgent(markdown, 'test.md');

      expect(agent).not.toBeNull();
      expect(agent?.frontmatter.custom_field).toBe('custom_value');
      expect(agent?.frontmatter.tools).toEqual(['read', 'write']);
    });
  });

  describe('importAgentFromFile', () => {
    it('should import valid agent file', async () => {
      const file = createMockFile(mockMarkdownWithFrontmatter, 'agent.md');
      const agent = await importAgentFromFile(file, AgentScope.Global);

      expect(agent).not.toBeNull();
      expect(agent?.name).toBe('Sample Agent');
    });

    it('should reject file without valid agent definition', async () => {
      const file = createMockFile(mockMarkdownWithoutFrontmatter, 'invalid.md');

      await expect(importAgentFromFile(file, AgentScope.Global)).rejects.toThrow(
        'File does not contain a valid subagent definition'
      );
    });

    it('should reject file exceeding size limit', async () => {
      // Create a file larger than 10MB
      const largeContent = 'x'.repeat(11 * 1024 * 1024);
      const file = createMockFile(largeContent, 'large.md');

      await expect(importAgentFromFile(file, AgentScope.Global)).rejects.toThrow(
        'File size'
      );
    });

    it('should handle timeout for long-running operations', async () => {
      // Create a mock file that delays reading
      const file = {
        text: () => new Promise(resolve => setTimeout(() => resolve(mockMarkdownWithFrontmatter), 35000)),
        name: 'slow.md',
        size: 1000,
      } as File;

      await expect(importAgentFromFile(file, AgentScope.Global)).rejects.toThrow(
        'Operation timed out'
      );
    }, 40000); // Increase Jest timeout for this test
  });

  describe('importAgentsFromZip', () => {
    it('should import multiple agents from ZIP', async () => {
      const zip = new JSZip();
      zip.file('agent1.md', mockMarkdownWithFrontmatter);
      zip.file('agent2.md', createMockMarkdown({
        name: 'Second Agent',
        description: 'Another test agent',
      }));

      const blob = await zip.generateAsync({ type: 'blob' });
      const file = new File([blob], 'agents.zip', { type: 'application/zip' });

      const result = await importAgentsFromZip(file, AgentScope.Global);

      expect(result.agents).toHaveLength(2);
      expect(result.agents[0].name).toBe('Sample Agent');
      expect(result.agents[1].name).toBe('Second Agent');
      expect(result.errors).toHaveLength(0);
    });

    it('should skip non-markdown files in ZIP', async () => {
      const zip = new JSZip();
      zip.file('agent.md', mockMarkdownWithFrontmatter);
      zip.file('readme.txt', 'This is a readme');
      zip.file('image.png', 'fake image data');

      const blob = await zip.generateAsync({ type: 'blob' });
      const file = new File([blob], 'agents.zip', { type: 'application/zip' });

      const result = await importAgentsFromZip(file);

      expect(result.agents).toHaveLength(1);
      expect(result.agents[0].name).toBe('Sample Agent');
    });

    it('should collect errors for invalid agents', async () => {
      const zip = new JSZip();
      zip.file('valid.md', mockMarkdownWithFrontmatter);
      zip.file('invalid.md', mockMarkdownWithMissingFields);
      zip.file('no-frontmatter.md', mockMarkdownWithoutFrontmatter);

      const blob = await zip.generateAsync({ type: 'blob' });
      const file = new File([blob], 'agents.zip', { type: 'application/zip' });

      const result = await importAgentsFromZip(file);

      expect(result.agents).toHaveLength(1);
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0]).toContain('invalid.md');
      expect(result.errors[1]).toContain('no-frontmatter.md');
    });

    it('should skip directories in ZIP', async () => {
      const zip = new JSZip();
      zip.file('agents/agent1.md', mockMarkdownWithFrontmatter);
      zip.folder('empty-folder');

      const blob = await zip.generateAsync({ type: 'blob' });
      const file = new File([blob], 'agents.zip', { type: 'application/zip' });

      const result = await importAgentsFromZip(file);

      expect(result.agents).toHaveLength(1);
    });

    it('should reject ZIP file exceeding size limit', async () => {
      // Create a large ZIP content
      const largeContent = 'x'.repeat(51 * 1024 * 1024);
      const file = createMockFile(largeContent, 'large.zip', 'application/zip');

      await expect(importAgentsFromZip(file)).rejects.toThrow(
        'File size'
      );
    });

    it('should handle corrupted ZIP files', async () => {
      const file = createMockFile('this is not a valid zip', 'corrupted.zip', 'application/zip');

      await expect(importAgentsFromZip(file)).rejects.toThrow(
        'Failed to read zip file'
      );
    });
  });
});
