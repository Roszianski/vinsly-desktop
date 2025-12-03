/**
 * Mock data fixtures for testing
 */

import { Agent, Skill, AgentScope } from '../types';

export const mockAgents: Agent[] = [
  {
    id: '~/.claude/agents/code-reviewer.md',
    name: 'Code Reviewer',
    scope: AgentScope.Global,
    path: '~/.claude/agents/code-reviewer.md',
    frontmatter: {
      name: 'Code Reviewer',
      description: 'Reviews code for quality and best practices',
      model: 'sonnet',
      color: 'blue',
      tools: ['read', 'grep', 'glob'],
    },
    body: 'You are a code reviewer. Review the code for quality, security, and best practices.',
  },
  {
    id: '.claude/agents/project-helper.md',
    name: 'Project Helper',
    scope: AgentScope.Project,
    path: '.claude/agents/project-helper.md',
    frontmatter: {
      name: 'Project Helper',
      description: 'Helps with project-specific tasks',
      model: 'opus',
      color: 'green',
      tools: ['read', 'write', 'bash'],
    },
    body: 'You are a project helper. Help with tasks specific to this project.',
  },
  {
    id: '~/.claude/agents/test-writer.md',
    name: 'Test Writer',
    scope: AgentScope.Global,
    path: '~/.claude/agents/test-writer.md',
    frontmatter: {
      name: 'Test Writer',
      description: 'Writes comprehensive unit tests',
      model: 'sonnet',
      color: 'purple',
      tools: ['read', 'write'],
    },
    body: 'You are a test writer. Write comprehensive, well-documented unit tests.',
  },
];

export const mockSkills: Skill[] = [
  {
    id: '~/.claude/skills/python-expert',
    name: 'Python Expert',
    scope: AgentScope.Global,
    path: '~/.claude/skills/python-expert/skill.md',
    directoryPath: '~/.claude/skills/python-expert',
    hasAssets: true,
    frontmatter: {
      name: 'Python Expert',
      description: 'Expert knowledge of Python programming',
      allowed_tools: ['read', 'write', 'bash'],
    },
    body: 'This skill provides expert Python knowledge including best practices, design patterns, and common libraries.',
  },
  {
    id: '.claude/skills/api-design',
    name: 'API Design',
    scope: AgentScope.Project,
    path: '.claude/skills/api-design/skill.md',
    directoryPath: '.claude/skills/api-design',
    hasAssets: false,
    frontmatter: {
      name: 'API Design',
      description: 'REST API design patterns and best practices',
      allowed_tools: ['read'],
    },
    body: 'This skill covers RESTful API design, GraphQL, and API documentation.',
  },
];

export const mockMarkdownWithFrontmatter = `---
name: "Sample Agent"
description: "A sample agent for testing"
model: "sonnet"
color: "blue"
tools:
  - read
  - write
  - bash
---

This is the agent's prompt body.
It can contain multiple lines.`;

export const mockMarkdownWithoutFrontmatter = `# Sample Document

This is just a regular markdown file without frontmatter.`;

export const mockMarkdownWithInvalidFrontmatter = `---
name: "Sample Agent"
description: [this is not valid yaml
---

Body content`;

export const mockMarkdownWithMissingFields = `---
name: "Sample Agent"
---

Body content but missing required description field`;

/**
 * Mock ZIP file data (agents bundle)
 */
export const mockZipAgents = {
  'agent1.md': mockMarkdownWithFrontmatter,
  'agent2.md': `---
name: "Another Agent"
description: "Another test agent"
model: "opus"
---

Another agent body.`,
  'invalid.md': mockMarkdownWithMissingFields,
  'not-an-agent.txt': 'This is not a markdown file',
};
