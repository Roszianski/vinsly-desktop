/**
 * Integration tests for agent import/export workflows
 * Tests the complete flow: Agent -> Export -> ZIP -> Import -> Agent
 */

import JSZip from 'jszip';
import { importAgentsFromZip, markdownToAgent, hasSubagentDefinition } from '../../utils/agentImport';
import { agentToMarkdown, exportAgentsAsZip } from '../../utils/agentExport';
import { Agent, AgentScope } from '../../types';
import { createMockAgent } from '../../test/helpers';

// Mock Tauri plugins for integration tests
jest.mock('@tauri-apps/plugin-dialog', () => ({
  save: jest.fn(),
  open: jest.fn(),
}));

jest.mock('../../utils/tauriCommands', () => ({
  exportTextFile: jest.fn(),
  exportBinaryFile: jest.fn(),
  importTextFile: jest.fn(),
  importBinaryFile: jest.fn(),
}));

describe('Import/Export Integration Tests', () => {
  describe('Single Agent Round-Trip', () => {
    it('should preserve agent data through export and import', async () => {
      const originalAgent = createMockAgent({
        name: 'Integration Test Agent',
        scope: AgentScope.Global,
        frontmatter: {
          name: 'Integration Test Agent',
          description: 'Testing full round-trip',
          model: 'claude-sonnet-4',
          color: 'blue',
          tools: ['read', 'write', 'bash'],
        },
        body: 'This is the agent prompt.\nIt has multiple lines.\nAnd special characters: "quotes" and \'apostrophes\'.',
      });

      // Export to markdown
      const markdown = agentToMarkdown(originalAgent);

      // Verify it has valid frontmatter
      expect(hasSubagentDefinition(markdown)).toBe(true);

      // Import back from markdown
      const importedAgent = markdownToAgent(
        markdown,
        'test-agent.md',
        AgentScope.Global,
        originalAgent.path
      );

      // Verify data integrity
      expect(importedAgent).not.toBeNull();
      expect(importedAgent?.name).toBe(originalAgent.name);
      expect(importedAgent?.frontmatter.description).toBe(originalAgent.frontmatter.description);
      expect(importedAgent?.frontmatter.model).toBe(originalAgent.frontmatter.model);
      expect(importedAgent?.frontmatter.color).toBe(originalAgent.frontmatter.color);
      expect(importedAgent?.frontmatter.tools).toEqual(originalAgent.frontmatter.tools);
      expect(importedAgent?.body).toBe(originalAgent.body);
      expect(importedAgent?.scope).toBe(originalAgent.scope);
    });

    it('should handle agents with complex frontmatter', async () => {
      const originalAgent = createMockAgent({
        name: 'Complex Agent',
        frontmatter: {
          name: 'Complex Agent',
          description: 'Has complex metadata',
          model: 'claude-opus-4',
          tools: ['read', 'write', 'grep', 'glob', 'bash'],
          custom_metadata: {
            version: '2.0.0',
            author: 'Test Team',
            tags: ['advanced', 'testing', 'integration'],
          },
          features: ['feature1', 'feature2', 'feature3'],
        },
        body: '# Complex Agent\n\nThis agent has complex metadata and formatting.',
      });

      const markdown = agentToMarkdown(originalAgent);
      const importedAgent = markdownToAgent(markdown, 'complex.md', AgentScope.Global);

      expect(importedAgent).not.toBeNull();
      expect(importedAgent?.frontmatter.custom_metadata).toEqual(originalAgent.frontmatter.custom_metadata);
      expect(importedAgent?.frontmatter.features).toEqual(originalAgent.frontmatter.features);
    });
  });

  describe('Multiple Agents ZIP Round-Trip', () => {
    it('should export and import multiple agents via ZIP', async () => {
      const originalAgents = [
        createMockAgent({ name: 'Agent One', frontmatter: { name: 'Agent One', description: 'First' } }),
        createMockAgent({ name: 'Agent Two', frontmatter: { name: 'Agent Two', description: 'Second' } }),
        createMockAgent({ name: 'Agent Three', frontmatter: { name: 'Agent Three', description: 'Third' } }),
      ];

      // Create ZIP manually (simulating export)
      const zip = new JSZip();
      originalAgents.forEach(agent => {
        const markdown = agentToMarkdown(agent);
        zip.file(`${agent.name}.md`, markdown);
      });

      // Generate ZIP blob
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const zipFile = new File([zipBlob], 'agents.zip', { type: 'application/zip' });

      // Import from ZIP
      const result = await importAgentsFromZip(zipFile, AgentScope.Global);

      // Verify results
      expect(result.agents).toHaveLength(3);
      expect(result.errors).toHaveLength(0);

      // Verify each agent
      expect(result.agents[0].name).toBe('Agent One');
      expect(result.agents[1].name).toBe('Agent Two');
      expect(result.agents[2].name).toBe('Agent Three');
    });

    it('should handle mixed valid and invalid agents in ZIP', async () => {
      const validAgent = createMockAgent({
        name: 'Valid Agent',
        frontmatter: {
          name: 'Valid Agent',
          description: 'This is valid',
        },
      });

      const zip = new JSZip();

      // Add valid agent
      zip.file('valid.md', agentToMarkdown(validAgent));

      // Add invalid agent (missing description)
      zip.file('invalid.md', `---
name: "Invalid Agent"
---

Missing description field`);

      // Add non-agent file
      zip.file('readme.txt', 'This is just a text file');

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const zipFile = new File([zipBlob], 'mixed.zip', { type: 'application/zip' });

      const result = await importAgentsFromZip(zipFile);

      expect(result.agents).toHaveLength(1);
      expect(result.agents[0].name).toBe('Valid Agent');
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('invalid.md');
    });
  });

  describe('Data Integrity Tests', () => {
    it('should preserve special characters in body', async () => {
      const specialCharsBody = `# Agent with Special Characters

This agent includes:
- "Double quotes"
- 'Single quotes'
- Backslashes: \\
- Newlines and tabs
- Unicode: 你好 世界
- Emoji: 🚀 ✨ 🎉`;

      const agent = createMockAgent({
        name: 'Special Chars',
        frontmatter: {
          name: 'Special Chars',
          description: 'Tests special characters',
        },
        body: specialCharsBody,
      });

      const markdown = agentToMarkdown(agent);
      const imported = markdownToAgent(markdown, 'special.md');

      expect(imported).not.toBeNull();
      expect(imported?.body).toBe(specialCharsBody);
    });

    it('should handle very long agent bodies', async () => {
      const longBody = 'A'.repeat(10000) + '\n' + 'B'.repeat(10000);

      const agent = createMockAgent({
        name: 'Long Body',
        frontmatter: {
          name: 'Long Body',
          description: 'Has very long body',
        },
        body: longBody,
      });

      const markdown = agentToMarkdown(agent);
      const imported = markdownToAgent(markdown, 'long.md');

      expect(imported).not.toBeNull();
      expect(imported?.body).toBe(longBody);
      expect(imported?.body.length).toBe(20001); // 20000 chars + 1 newline
    });

    it('should handle agents with no body', async () => {
      const agent = createMockAgent({
        name: 'No Body',
        frontmatter: {
          name: 'No Body',
          description: 'Agent without body content',
        },
        body: '',
      });

      const markdown = agentToMarkdown(agent);
      const imported = markdownToAgent(markdown, 'nobody.md');

      expect(imported).not.toBeNull();
      expect(imported?.body).toBe('');
    });

    it('should preserve array order in frontmatter', async () => {
      const orderedTools = ['bash', 'read', 'write', 'grep', 'glob', 'edit'];

      const agent = createMockAgent({
        name: 'Ordered Tools',
        frontmatter: {
          name: 'Ordered Tools',
          description: 'Tools in specific order',
          tools: orderedTools,
        },
      });

      const markdown = agentToMarkdown(agent);
      const imported = markdownToAgent(markdown, 'ordered.md');

      expect(imported).not.toBeNull();
      expect(imported?.frontmatter.tools).toEqual(orderedTools);
    });

    it('should handle nested objects in frontmatter', async () => {
      const nestedMetadata = {
        config: {
          timeout: 30,
          retries: 3,
          options: {
            verbose: true,
            debug: false,
          },
        },
        features: ['a', 'b', 'c'],
      };

      const agent = createMockAgent({
        name: 'Nested Data',
        frontmatter: {
          name: 'Nested Data',
          description: 'Has nested metadata',
          metadata: nestedMetadata,
        },
      });

      const markdown = agentToMarkdown(agent);
      const imported = markdownToAgent(markdown, 'nested.md');

      expect(imported).not.toBeNull();
      expect(imported?.frontmatter.metadata).toEqual(nestedMetadata);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle agent names with special filesystem characters', async () => {
      const specialName = 'Agent: Test/Name [v2]';

      const agent = createMockAgent({
        name: specialName,
        frontmatter: {
          name: specialName,
          description: 'Name with special chars',
        },
      });

      const markdown = agentToMarkdown(agent);
      const imported = markdownToAgent(markdown, `${specialName}.md`);

      expect(imported).not.toBeNull();
      expect(imported?.name).toBe(specialName);
    });

    it('should reject malformed YAML in import', async () => {
      const malformedMarkdown = `---
name: "Test Agent"
description: [this is not valid yaml
tools:
  - read
  - write: invalid
---

Body content`;

      const imported = markdownToAgent(malformedMarkdown, 'malformed.md');
      expect(imported).toBeNull();
    });

    it('should handle empty ZIP files', async () => {
      const zip = new JSZip();
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const zipFile = new File([zipBlob], 'empty.zip', { type: 'application/zip' });

      const result = await importAgentsFromZip(zipFile);

      expect(result.agents).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle ZIP with only non-markdown files', async () => {
      const zip = new JSZip();
      zip.file('readme.txt', 'README content');
      zip.file('image.png', 'fake image data');
      zip.file('data.json', '{"key": "value"}');

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const zipFile = new File([zipBlob], 'nomarkdown.zip', { type: 'application/zip' });

      const result = await importAgentsFromZip(zipFile);

      expect(result.agents).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should track errors for each invalid file in ZIP', async () => {
      const zip = new JSZip();

      // Multiple invalid files
      zip.file('missing-name.md', `---
description: "No name field"
---
Body`);

      zip.file('missing-description.md', `---
name: "No Description"
---
Body`);

      zip.file('no-frontmatter.md', 'Just plain markdown');

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const zipFile = new File([zipBlob], 'errors.zip', { type: 'application/zip' });

      const result = await importAgentsFromZip(zipFile);

      expect(result.agents).toHaveLength(0);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.includes('missing-name.md'))).toBe(true);
      expect(result.errors.some(e => e.includes('missing-description.md'))).toBe(true);
      expect(result.errors.some(e => e.includes('no-frontmatter.md'))).toBe(true);
    });
  });

  describe('Scope Preservation', () => {
    it('should preserve Global scope through round-trip', async () => {
      const agent = createMockAgent({
        name: 'Global Agent',
        scope: AgentScope.Global,
        frontmatter: {
          name: 'Global Agent',
          description: 'Global scope agent',
        },
      });

      const markdown = agentToMarkdown(agent);
      const imported = markdownToAgent(markdown, 'global.md', AgentScope.Global);

      expect(imported).not.toBeNull();
      expect(imported?.scope).toBe(AgentScope.Global);
    });

    it('should preserve Project scope through round-trip', async () => {
      const agent = createMockAgent({
        name: 'Project Agent',
        scope: AgentScope.Project,
        frontmatter: {
          name: 'Project Agent',
          description: 'Project scope agent',
        },
      });

      const markdown = agentToMarkdown(agent);
      const imported = markdownToAgent(markdown, 'project.md', AgentScope.Project);

      expect(imported).not.toBeNull();
      expect(imported?.scope).toBe(AgentScope.Project);
    });

    it('should allow scope override during import', async () => {
      const globalAgent = createMockAgent({
        scope: AgentScope.Global,
        frontmatter: {
          name: 'Original Global',
          description: 'Started as global',
        },
      });

      const markdown = agentToMarkdown(globalAgent);

      // Import as project scope
      const imported = markdownToAgent(markdown, 'converted.md', AgentScope.Project);

      expect(imported).not.toBeNull();
      expect(imported?.scope).toBe(AgentScope.Project);
    });
  });
});
