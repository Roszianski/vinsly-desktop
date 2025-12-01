import { skillFileToSkill, skillToMarkdown } from '../skillParser';
import { AgentScope, Skill } from '../../types';
import { SkillFile } from '../tauriCommands';
import { createMockMarkdown, createMockSkill } from '../../test/helpers';

describe('skillParser', () => {
  describe('skillFileToSkill', () => {
    it('should parse valid skill file', () => {
      const skillFile: SkillFile = {
        name: 'Python Expert',
        directory: '~/.claude/skills/python-expert',
        path: '~/.claude/skills/python-expert/skill.md',
        scope: 'global',
        has_assets: false,
        content: createMockMarkdown({
          name: 'Python Expert',
          description: 'Expert knowledge of Python',
          allowed_tools: ['read', 'write'],
        }),
      };

      const skill = skillFileToSkill(skillFile);

      expect(skill).not.toBeNull();
      expect(skill?.name).toBe('Python Expert');
      expect(skill?.frontmatter.description).toBe('Expert knowledge of Python');
      expect(skill?.scope).toBe(AgentScope.Global);
      expect(skill?.directoryPath).toBe('~/.claude/skills/python-expert');
      expect(skill?.path).toBe('~/.claude/skills/python-expert/skill.md');
      expect(skill?.hasAssets).toBe(false);
    });

    it('should use file name as fallback when frontmatter name is missing', () => {
      const skillFile: SkillFile = {
        name: 'Fallback Name',
        directory: '/path/to/skill',
        path: '/path/to/skill/skill.md',
        scope: 'global',
        has_assets: false,
        content: createMockMarkdown({
          description: 'Description only, no name',
        }),
      };

      const skill = skillFileToSkill(skillFile);

      expect(skill).not.toBeNull();
      expect(skill?.name).toBe('Fallback Name');
    });

    it('should handle project scope', () => {
      const skillFile: SkillFile = {
        name: 'Project Skill',
        directory: '.claude/skills/project-skill',
        path: '.claude/skills/project-skill/skill.md',
        scope: 'project',
        has_assets: true,
        content: createMockMarkdown({
          name: 'Project Skill',
          description: 'A project-scoped skill',
        }),
      };

      const skill = skillFileToSkill(skillFile);

      expect(skill).not.toBeNull();
      expect(skill?.scope).toBe(AgentScope.Project);
      expect(skill?.hasAssets).toBe(true);
    });

    it('should return null for skill without description', () => {
      const skillFile: SkillFile = {
        name: 'No Description',
        directory: '/path/to/skill',
        path: '/path/to/skill/skill.md',
        scope: 'global',
        has_assets: false,
        content: createMockMarkdown({
          name: 'No Description',
        }),
      };

      const skill = skillFileToSkill(skillFile);

      expect(skill).toBeNull();
    });

    it('should return null for skill with empty description', () => {
      const skillFile: SkillFile = {
        name: 'Empty Description',
        directory: '/path/to/skill',
        path: '/path/to/skill/skill.md',
        scope: 'global',
        has_assets: false,
        content: createMockMarkdown({
          name: 'Empty Description',
          description: '   ',
        }),
      };

      const skill = skillFileToSkill(skillFile);

      expect(skill).toBeNull();
    });

    it('should return null for skill without valid frontmatter', () => {
      const skillFile: SkillFile = {
        name: 'Invalid',
        directory: '/path/to/skill',
        path: '/path/to/skill/skill.md',
        scope: 'global',
        has_assets: false,
        content: 'Just regular markdown without frontmatter',
      };

      const skill = skillFileToSkill(skillFile);

      expect(skill).toBeNull();
    });

    it('should return null for malformed YAML frontmatter', () => {
      const skillFile: SkillFile = {
        name: 'Malformed',
        directory: '/path/to/skill',
        path: '/path/to/skill/skill.md',
        scope: 'global',
        has_assets: false,
        content: `---
name: "Test Skill"
description: [this is not valid yaml syntax
---

Body content`,
      };

      const skill = skillFileToSkill(skillFile);

      expect(skill).toBeNull();
    });

    it('should preserve allowed_tools array', () => {
      const skillFile: SkillFile = {
        name: 'Tool Skill',
        directory: '/path/to/skill',
        path: '/path/to/skill/skill.md',
        scope: 'global',
        has_assets: false,
        content: createMockMarkdown({
          name: 'Tool Skill',
          description: 'Uses specific tools',
          allowed_tools: ['read', 'write', 'bash', 'grep'],
        }),
      };

      const skill = skillFileToSkill(skillFile);

      expect(skill).not.toBeNull();
      expect(skill?.frontmatter.allowed_tools).toEqual(['read', 'write', 'bash', 'grep']);
    });

    it('should preserve custom frontmatter fields', () => {
      const skillFile: SkillFile = {
        name: 'Custom Fields',
        directory: '/path/to/skill',
        path: '/path/to/skill/skill.md',
        scope: 'global',
        has_assets: false,
        content: createMockMarkdown({
          name: 'Custom Fields',
          description: 'Has custom fields',
          version: '1.0.0',
          author: 'Test Author',
          tags: ['python', 'testing'],
        }),
      };

      const skill = skillFileToSkill(skillFile);

      expect(skill).not.toBeNull();
      expect(skill?.frontmatter.version).toBe('1.0.0');
      expect(skill?.frontmatter.author).toBe('Test Author');
      expect(skill?.frontmatter.tags).toEqual(['python', 'testing']);
    });

    it('should trim whitespace from name and description', () => {
      const skillFile: SkillFile = {
        name: 'Whitespace Test',
        directory: '/path/to/skill',
        path: '/path/to/skill/skill.md',
        scope: 'global',
        has_assets: false,
        content: createMockMarkdown({
          name: '  Trimmed Name  ',
          description: '  Trimmed Description  ',
        }),
      };

      const skill = skillFileToSkill(skillFile);

      expect(skill).not.toBeNull();
      expect(skill?.name).toBe('Trimmed Name');
      expect(skill?.frontmatter.description).toBe('Trimmed Description');
    });

    it('should handle skills with multiline body content', () => {
      const skillFile: SkillFile = {
        name: 'Multiline Skill',
        directory: '/path/to/skill',
        path: '/path/to/skill/skill.md',
        scope: 'global',
        has_assets: false,
        content: `---
name: "Multiline Skill"
description: "Has multiline body"
---

This is line 1.
This is line 2.
This is line 3.`,
      };

      const skill = skillFileToSkill(skillFile);

      expect(skill).not.toBeNull();
      expect(skill?.body).toContain('line 1');
      expect(skill?.body).toContain('line 2');
      expect(skill?.body).toContain('line 3');
    });

    it('should handle empty body content', () => {
      const skillFile: SkillFile = {
        name: 'Empty Body',
        directory: '/path/to/skill',
        path: '/path/to/skill/skill.md',
        scope: 'global',
        has_assets: false,
        content: `---
name: "Empty Body"
description: "No body content"
---

`,
      };

      const skill = skillFileToSkill(skillFile);

      expect(skill).not.toBeNull();
      expect(skill?.body).toBe('');
    });

    it('should default to global scope for unknown scope values', () => {
      const skillFile: SkillFile = {
        name: 'Unknown Scope',
        directory: '/path/to/skill',
        path: '/path/to/skill/skill.md',
        scope: 'unknown-scope',
        has_assets: false,
        content: createMockMarkdown({
          name: 'Unknown Scope',
          description: 'Has unknown scope value',
        }),
      };

      const skill = skillFileToSkill(skillFile);

      expect(skill).not.toBeNull();
      expect(skill?.scope).toBe(AgentScope.Global);
    });
  });

  describe('skillToMarkdown', () => {
    it('should convert skill to markdown with frontmatter', () => {
      const skill = createMockSkill({
        name: 'Test Skill',
        frontmatter: {
          name: 'Test Skill',
          description: 'A test skill',
          allowed_tools: ['read', 'write'],
        },
        body: 'This is the skill body.',
      });

      const markdown = skillToMarkdown(skill);

      expect(markdown).toContain('---');
      expect(markdown).toContain('name: Test Skill');
      expect(markdown).toContain('description: A test skill');
      expect(markdown).toContain('allowed_tools:');
      expect(markdown).toContain('- read');
      expect(markdown).toContain('- write');
      expect(markdown).toContain('This is the skill body.');
    });

    it('should handle skill with empty body', () => {
      const skill = createMockSkill({
        body: '',
      });

      const markdown = skillToMarkdown(skill);

      expect(markdown).toContain('---');
      expect(markdown).toMatch(/---\n\n$/); // Should end with frontmatter delimiter and empty body
    });

    it('should handle skill with undefined body', () => {
      const skill = createMockSkill({
        body: undefined as any,
      });

      const markdown = skillToMarkdown(skill);

      expect(markdown).toContain('---');
      expect(markdown).not.toContain('undefined');
    });

    it('should filter out undefined values from frontmatter', () => {
      const skill = createMockSkill({
        frontmatter: {
          name: 'Test Skill',
          description: 'Test',
          optional_field: undefined,
        },
      });

      const markdown = skillToMarkdown(skill);

      expect(markdown).not.toContain('optional_field');
      expect(markdown).not.toContain('undefined');
    });

    it('should preserve complex frontmatter structures', () => {
      const skill = createMockSkill({
        frontmatter: {
          name: 'Complex Skill',
          description: 'Complex frontmatter',
          allowed_tools: ['read', 'write'],
          metadata: {
            version: '2.0.0',
            tags: ['advanced', 'testing'],
          },
        },
      });

      const markdown = skillToMarkdown(skill);

      expect(markdown).toContain('allowed_tools:');
      expect(markdown).toContain('metadata:');
      expect(markdown).toContain('version: 2.0.0');
    });

    it('should maintain YAML structure', () => {
      const skill = createMockSkill();
      const markdown = skillToMarkdown(skill);

      // Extract frontmatter
      const match = markdown.match(/^---\n([\s\S]*?)\n---/);
      expect(match).not.toBeNull();

      // Verify it's valid YAML by checking structure
      const yamlContent = match![1];
      expect(yamlContent).toMatch(/^name:/m);
      expect(yamlContent).toMatch(/^description:/m);
    });

    it('should round-trip skill data correctly', () => {
      const originalSkill = createMockSkill({
        name: 'Round Trip',
        frontmatter: {
          name: 'Round Trip',
          description: 'Testing round trip',
          allowed_tools: ['read'],
        },
        body: 'Original body content',
      });

      const markdown = skillToMarkdown(originalSkill);

      // Parse it back
      const skillFile: SkillFile = {
        name: 'Round Trip',
        directory: '/test',
        path: '/test/skill.md',
        scope: 'global',
        has_assets: false,
        content: markdown,
      };

      const parsedSkill = skillFileToSkill(skillFile);

      expect(parsedSkill).not.toBeNull();
      expect(parsedSkill?.name).toBe(originalSkill.name);
      expect(parsedSkill?.frontmatter.description).toBe(originalSkill.frontmatter.description);
      expect(parsedSkill?.body).toBe(originalSkill.body);
    });
  });
});
