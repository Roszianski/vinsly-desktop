/**
 * Test utilities for component and integration testing
 * Provides common mocks, wrappers, and helpers
 */

import React, { ReactElement } from 'react';
import { render, RenderOptions, RenderResult } from '@testing-library/react';
import { ToastProvider } from '../contexts/ToastContext';
import { Agent, AgentScope, Skill } from '../types';

/**
 * Default wrapper that provides common context providers
 */
const AllTheProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <ToastProvider>
      {children}
    </ToastProvider>
  );
};

/**
 * Custom render function that wraps components with providers
 */
export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
): RenderResult {
  return render(ui, { wrapper: AllTheProviders, ...options });
}

/**
 * Create a mock agent for testing
 */
export function createMockAgent(overrides?: Partial<Agent>): Agent {
  const id = overrides?.id ?? `agent-${Math.random().toString(36).slice(2)}`;
  return {
    id,
    name: `Test Agent ${id.slice(-4)}`,
    scope: AgentScope.Global,
    path: `~/.claude/agents/${id}.md`,
    frontmatter: {
      name: `Test Agent ${id.slice(-4)}`,
      description: 'A test agent for unit testing',
      model: 'sonnet',
      ...overrides?.frontmatter,
    },
    body: 'Test agent body content',
    isFavorite: false,
    ...overrides,
  };
}

/**
 * Create multiple mock agents
 */
export function createMockAgents(count: number, overrides?: Partial<Agent>): Agent[] {
  return Array.from({ length: count }, (_, i) =>
    createMockAgent({ ...overrides, id: `agent-${i}` })
  );
}

/**
 * Create a mock skill for testing
 */
export function createMockSkill(overrides?: Partial<Skill>): Skill {
  const id = overrides?.id ?? `skill-${Math.random().toString(36).slice(2)}`;
  return {
    id,
    name: `Test Skill ${id.slice(-4)}`,
    scope: AgentScope.Global,
    directoryPath: `~/.claude/skills/${id}`,
    path: `~/.claude/skills/${id}/SKILL.md`,
    frontmatter: {
      name: `Test Skill ${id.slice(-4)}`,
      description: 'A test skill for unit testing',
      ...overrides?.frontmatter,
    },
    body: 'Test skill body content',
    hasAssets: false,
    isFavorite: false,
    ...overrides,
  };
}

/**
 * Create multiple mock skills
 */
export function createMockSkills(count: number, overrides?: Partial<Skill>): Skill[] {
  return Array.from({ length: count }, (_, i) =>
    createMockSkill({ ...overrides, id: `skill-${i}` })
  );
}

/**
 * Mock for Tauri commands
 */
export const mockTauriCommands = {
  listAgents: jest.fn().mockResolvedValue([]),
  writeAgent: jest.fn().mockResolvedValue('/path/to/agent.md'),
  deleteAgent: jest.fn().mockResolvedValue(undefined),
  listSkills: jest.fn().mockResolvedValue([]),
  writeSkill: jest.fn().mockResolvedValue('/path/to/skill/SKILL.md'),
  deleteSkill: jest.fn().mockResolvedValue(undefined),
  discoverProjectDirectories: jest.fn().mockResolvedValue([]),
};

/**
 * Mock storage functions
 */
export const mockStorage = {
  getStorageItem: jest.fn().mockResolvedValue(null),
  setStorageItem: jest.fn().mockResolvedValue(undefined),
  removeStorageItem: jest.fn().mockResolvedValue(undefined),
};

/**
 * Setup Tauri mocks for tests
 */
export function setupTauriMocks(): void {
  // Mock window.__TAURI__
  (window as unknown as { __TAURI__?: unknown }).__TAURI__ = {
    invoke: jest.fn().mockResolvedValue(undefined),
  };
}

/**
 * Clean up Tauri mocks after tests
 */
export function cleanupTauriMocks(): void {
  delete (window as unknown as { __TAURI__?: unknown }).__TAURI__;
}

/**
 * Wait for async operations in tests
 */
export function waitForAsync(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

/**
 * Mock toast hook return value
 */
export const mockToast = {
  showToast: jest.fn(),
  toasts: [],
  removeToast: jest.fn(),
};

// Re-export testing library utilities
export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';
