/**
 * Unit tests for slash commands parsing and handling
 */

import { AgentScope } from '../../types';

describe('Slash Commands Parsing', () => {
  describe('extractDescription', () => {
    const extractDescription = (content: string): string => {
      const lines = content.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('---')) {
          return trimmed.length > 100 ? trimmed.slice(0, 100) + '...' : trimmed;
        }
      }
      return '';
    };

    it('should extract first non-empty, non-header line', () => {
      const content = `# Title
This is the description.
More content here.`;

      expect(extractDescription(content)).toBe('This is the description.');
    });

    it('should skip empty lines', () => {
      const content = `

# Header

First real content line.`;

      expect(extractDescription(content)).toBe('First real content line.');
    });

    it('should skip frontmatter delimiters', () => {
      const content = `---
name: test
---
Actual description after frontmatter.`;

      expect(extractDescription(content)).toBe('name: test');
    });

    it('should truncate long descriptions to 100 chars', () => {
      const longLine = 'A'.repeat(150);
      const content = longLine;

      const result = extractDescription(content);
      expect(result).toBe('A'.repeat(100) + '...');
      expect(result.length).toBe(103); // 100 + '...'
    });

    it('should return empty string for content with only headers', () => {
      const content = `# Header 1
## Header 2
### Header 3`;

      expect(extractDescription(content)).toBe('');
    });

    it('should return empty string for empty content', () => {
      expect(extractDescription('')).toBe('');
    });

    it('should return empty string for whitespace-only content', () => {
      expect(extractDescription('   \n\n   \n')).toBe('');
    });
  });

  describe('parseSlashCommand', () => {
    interface SlashCommandFile {
      name: string;
      path: string;
      content: string;
      scope: string;
    }

    const parseSlashCommand = (file: SlashCommandFile) => {
      const extractDescription = (content: string): string => {
        const lines = content.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('---')) {
            return trimmed.length > 100 ? trimmed.slice(0, 100) + '...' : trimmed;
          }
        }
        return '';
      };

      return {
        id: file.path,
        name: file.name,
        scope: file.scope === 'global' ? AgentScope.Global : AgentScope.Project,
        path: file.path,
        description: extractDescription(file.content),
        body: file.content,
        isFavorite: false,
      };
    };

    it('should parse global command correctly', () => {
      const file: SlashCommandFile = {
        name: 'test-command',
        path: '/Users/test/.claude/commands/test-command.md',
        content: 'Run the tests\n\nMore details here.',
        scope: 'global',
      };

      const result = parseSlashCommand(file);

      expect(result.id).toBe(file.path);
      expect(result.name).toBe('test-command');
      expect(result.scope).toBe(AgentScope.Global);
      expect(result.path).toBe(file.path);
      expect(result.description).toBe('Run the tests');
      expect(result.body).toBe(file.content);
      expect(result.isFavorite).toBe(false);
    });

    it('should parse project command correctly', () => {
      const file: SlashCommandFile = {
        name: 'build',
        path: '/projects/myapp/.claude/commands/build.md',
        content: 'Build the project',
        scope: 'project',
      };

      const result = parseSlashCommand(file);

      expect(result.scope).toBe(AgentScope.Project);
    });

    it('should default to project scope for unknown scope values', () => {
      const file: SlashCommandFile = {
        name: 'unknown',
        path: '/path/to/command.md',
        content: 'Content',
        scope: 'unknown',
      };

      const result = parseSlashCommand(file);

      expect(result.scope).toBe(AgentScope.Project);
    });
  });

  describe('makeCommandKey', () => {
    const makeCommandKey = (cmd: { scope: AgentScope; path?: string; name: string }) => {
      const scopePrefix = cmd.scope === AgentScope.Project ? 'project' : 'global';
      return `${scopePrefix}:${cmd.path || cmd.name}`;
    };

    it('should create key with path when available', () => {
      const cmd = {
        scope: AgentScope.Global,
        path: '/path/to/command.md',
        name: 'test-cmd',
      };

      expect(makeCommandKey(cmd)).toBe('global:/path/to/command.md');
    });

    it('should fallback to name when path is missing', () => {
      const cmd = {
        scope: AgentScope.Project,
        path: '',
        name: 'test-cmd',
      };

      expect(makeCommandKey(cmd)).toBe('project:test-cmd');
    });

    it('should differentiate between global and project scope', () => {
      const globalCmd = {
        scope: AgentScope.Global,
        path: '/same/path.md',
        name: 'cmd',
      };
      const projectCmd = {
        scope: AgentScope.Project,
        path: '/same/path.md',
        name: 'cmd',
      };

      expect(makeCommandKey(globalCmd)).not.toBe(makeCommandKey(projectCmd));
    });
  });

  describe('Command Name Validation', () => {
    it('should accept valid command names', () => {
      const validNames = ['test', 'build', 'run-tests', 'my_command', 'command123'];
      const isValidName = (name: string) => /^[a-zA-Z0-9_-]+$/.test(name);

      validNames.forEach(name => {
        expect(isValidName(name)).toBe(true);
      });
    });

    it('should reject names with special characters', () => {
      const invalidNames = ['test command', 'test/command', 'test.command', 'test@command'];
      const isValidName = (name: string) => /^[a-zA-Z0-9_-]+$/.test(name);

      invalidNames.forEach(name => {
        expect(isValidName(name)).toBe(false);
      });
    });

    it('should reject empty names', () => {
      const isValidName = (name: string) => name.length > 0 && /^[a-zA-Z0-9_-]+$/.test(name);

      expect(isValidName('')).toBe(false);
    });
  });

  describe('Favorite Preservation', () => {
    it('should preserve favorites when reloading commands', () => {
      const previousCommands = [
        { id: 'cmd1', name: 'cmd1', isFavorite: true, scope: AgentScope.Global, path: '/cmd1.md', body: '', description: '' },
        { id: 'cmd2', name: 'cmd2', isFavorite: false, scope: AgentScope.Global, path: '/cmd2.md', body: '', description: '' },
        { id: 'cmd3', name: 'cmd3', isFavorite: true, scope: AgentScope.Global, path: '/cmd3.md', body: '', description: '' },
      ];

      const makeKey = (cmd: typeof previousCommands[0]) => `global:${cmd.path}`;
      const previousFavorites = new Set(
        previousCommands.filter(c => c.isFavorite).map(makeKey)
      );

      const newCommands = [
        { id: 'cmd1', name: 'cmd1', isFavorite: false, scope: AgentScope.Global, path: '/cmd1.md', body: '', description: '' },
        { id: 'cmd2', name: 'cmd2', isFavorite: false, scope: AgentScope.Global, path: '/cmd2.md', body: '', description: '' },
        { id: 'cmd4', name: 'cmd4', isFavorite: false, scope: AgentScope.Global, path: '/cmd4.md', body: '', description: '' },
      ];

      const mergedCommands = newCommands.map(cmd => ({
        ...cmd,
        isFavorite: previousFavorites.has(makeKey(cmd)),
      }));

      expect(mergedCommands.find(c => c.id === 'cmd1')?.isFavorite).toBe(true);
      expect(mergedCommands.find(c => c.id === 'cmd2')?.isFavorite).toBe(false);
      expect(mergedCommands.find(c => c.id === 'cmd4')?.isFavorite).toBe(false);
    });
  });
});
