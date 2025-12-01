/**
 * Pre-built undo/redo commands for workspace operations
 * Makes it easy to add undo support to agent and skill operations
 */

import { Agent, Skill } from '../types';
import { Command, CommandFactory } from '../hooks/useHistory';

/**
 * Command builders for Agent operations
 */
export const AgentCommands = {
  /**
   * Delete agent command
   */
  delete: (
    agent: Agent,
    onDelete: (agent: Agent) => Promise<void>,
    onRestore: (agent: Agent) => Promise<void>
  ): Command =>
    CommandFactory.delete(
      agent,
      `Delete agent "${agent.name}"`,
      onDelete,
      onRestore
    ),

  /**
   * Bulk delete agents command
   */
  bulkDelete: (
    agents: Agent[],
    onDelete: (agents: Agent[]) => Promise<void>,
    onRestore: (agents: Agent[]) => Promise<void>
  ): Command =>
    CommandFactory.bulkDelete(
      agents,
      `Delete ${agents.length} agent${agents.length > 1 ? 's' : ''}`,
      onDelete,
      onRestore
    ),

  /**
   * Update agent command (for edits)
   */
  update: (
    oldAgent: Agent,
    newAgent: Agent,
    onUpdate: (agent: Agent) => Promise<void>
  ): Command =>
    CommandFactory.update(
      oldAgent,
      newAgent,
      `Edit agent "${newAgent.name}"`,
      onUpdate
    ),

  /**
   * Toggle favorite command
   */
  toggleFavorite: (
    agent: Agent,
    onToggle: () => Promise<void>
  ): Command =>
    CommandFactory.toggle(
      `${agent.isFavorite ? 'Unfavorite' : 'Favorite'} agent "${agent.name}"`,
      onToggle
    ),

  /**
   * Duplicate agent command (no undo needed - just delete the duplicate)
   */
  duplicate: (
    originalAgent: Agent,
    duplicatedAgent: Agent,
    onDelete: (agent: Agent) => Promise<void>
  ): Command => ({
    description: `Duplicate agent "${originalAgent.name}"`,
    execute: async () => {
      // Execute already happened, this is just for history
    },
    undo: async () => {
      // Undo duplicate by deleting the duplicate
      await onDelete(duplicatedAgent);
    },
  }),
};

/**
 * Command builders for Skill operations
 */
export const SkillCommands = {
  /**
   * Delete skill command
   */
  delete: (
    skill: Skill,
    onDelete: (skill: Skill) => Promise<void>,
    onRestore: (skill: Skill) => Promise<void>
  ): Command =>
    CommandFactory.delete(
      skill,
      `Delete skill "${skill.name}"`,
      onDelete,
      onRestore
    ),

  /**
   * Bulk delete skills command
   */
  bulkDelete: (
    skills: Skill[],
    onDelete: (skills: Skill[]) => Promise<void>,
    onRestore: (skills: Skill[]) => Promise<void>
  ): Command =>
    CommandFactory.bulkDelete(
      skills,
      `Delete ${skills.length} skill${skills.length > 1 ? 's' : ''}`,
      onDelete,
      onRestore
    ),

  /**
   * Update skill command (for edits)
   */
  update: (
    oldSkill: Skill,
    newSkill: Skill,
    onUpdate: (skill: Skill) => Promise<void>
  ): Command =>
    CommandFactory.update(
      oldSkill,
      newSkill,
      `Edit skill "${newSkill.name}"`,
      onUpdate
    ),

  /**
   * Toggle favorite command
   */
  toggleFavorite: (
    skill: Skill,
    onToggle: () => Promise<void>
  ): Command =>
    CommandFactory.toggle(
      `${skill.isFavorite ? 'Unfavorite' : 'Favorite'} skill "${skill.name}"`,
      onToggle
    ),

  /**
   * Duplicate skill command (no undo needed - just delete the duplicate)
   */
  duplicate: (
    originalSkill: Skill,
    duplicatedSkill: Skill,
    onDelete: (skill: Skill) => Promise<void>
  ): Command => ({
    description: `Duplicate skill "${originalSkill.name}"`,
    execute: async () => {
      // Execute already happened, this is just for history
    },
    undo: async () => {
      // Undo duplicate by deleting the duplicate
      await onDelete(duplicatedSkill);
    },
  }),
};

/**
 * Helper to create a command with toast notification on undo
 */
export function createCommandWithToast(
  command: Command,
  showToast: (type: 'success' | 'error' | 'info', message: string) => void
): Command {
  return {
    ...command,
    undo: async () => {
      await command.undo();
      showToast('success', `Undone: ${command.description}`);
    },
  };
}
