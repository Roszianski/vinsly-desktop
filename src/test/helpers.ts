/**
 * Shared test utilities and helper functions
 */

import { Agent, Skill, AgentScope } from '../types';

/**
 * Create a mock Agent for testing
 */
export function createMockAgent(overrides?: Partial<Agent>): Agent {
  return {
    id: '~/.claude/agents/test-agent.md',
    name: 'Test Agent',
    scope: AgentScope.Global,
    path: '~/.claude/agents/test-agent.md',
    frontmatter: {
      name: 'Test Agent',
      description: 'A test agent for unit tests',
      model: 'sonnet',
      color: 'blue',
      ...overrides?.frontmatter,
    },
    body: 'This is a test agent body.',
    ...overrides,
  };
}

/**
 * Create a mock Skill for testing
 */
export function createMockSkill(overrides?: Partial<Skill>): Skill {
  return {
    id: '~/.claude/skills/test-skill',
    name: 'Test Skill',
    scope: AgentScope.Global,
    path: '~/.claude/skills/test-skill/skill.md',
    directoryPath: '~/.claude/skills/test-skill',
    hasAssets: false,
    frontmatter: {
      name: 'Test Skill',
      description: 'A test skill for unit tests',
      allowed_tools: ['read', 'write'],
      ...overrides?.frontmatter,
    },
    body: 'This is a test skill body.',
    ...overrides,
  };
}

/**
 * Create mock storage functions for testing
 */
export function createMockStorage() {
  const storage = new Map<string, unknown>();

  return {
    getStorageItem: jest.fn(async (key: string) => storage.get(key) ?? null),
    setStorageItem: jest.fn(async (key: string, value: unknown) => {
      storage.set(key, value);
    }),
    removeStorageItem: jest.fn(async (key: string) => {
      storage.delete(key);
    }),
    clear: () => storage.clear(),
    getAll: () => Object.fromEntries(storage),
  };
}

/**
 * Create a mock File object for testing
 * Adds .text() method for compatibility with test environment
 */
export function createMockFile(
  content: string,
  filename: string,
  mimeType: string = 'text/markdown'
): File {
  const blob = new Blob([content], { type: mimeType });
  const file = new File([blob], filename, { type: mimeType });

  // Add .text() method if not present (jsdom compatibility)
  if (!file.text) {
    (file as any).text = async () => content;
  }

  return file;
}

/**
 * Create mock markdown content with frontmatter
 */
export function createMockMarkdown(
  frontmatter: Record<string, unknown>,
  body: string = 'Test body content'
): string {
  const yaml = Object.entries(frontmatter)
    .map(([key, value]) => {
      if (typeof value === 'string') {
        return `${key}: "${value}"`;
      }
      if (Array.isArray(value)) {
        return `${key}:\n${value.map(v => `  - ${v}`).join('\n')}`;
      }
      return `${key}: ${value}`;
    })
    .join('\n');

  return `---\n${yaml}\n---\n\n${body}`;
}

/**
 * Wait for async operations to complete
 */
export function flushPromises(): Promise<void> {
  return new Promise(resolve => setImmediate(resolve));
}

/**
 * Create a promise that resolves after a delay
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a promise that rejects with a timeout
 */
export function timeout(ms: number, message: string = 'Operation timed out'): Promise<never> {
  return new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms));
}
