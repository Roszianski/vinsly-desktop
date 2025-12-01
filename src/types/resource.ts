/**
 * Generic Resource types for consolidating Agent and Skill management
 * This allows us to handle both types with unified code
 */

import { Agent, Skill, AgentScope } from '../types';

/**
 * Resource type discriminator
 */
export enum ResourceType {
  Agent = 'agent',
  Skill = 'skill',
}

/**
 * Base interface for common resource properties
 */
export interface BaseResource {
  id: string;
  name: string;
  scope: AgentScope;
  path: string;
  frontmatter: {
    name: string;
    description: string;
    [key: string]: unknown;
  };
  body: string;
  isFavorite?: boolean;
}

/**
 * Agent-specific properties
 */
export interface AgentResource extends BaseResource {
  type: ResourceType.Agent;
  frontmatter: Agent['frontmatter'];
}

/**
 * Skill-specific properties
 */
export interface SkillResource extends BaseResource {
  type: ResourceType.Skill;
  directoryPath: string;
  hasAssets?: boolean;
  frontmatter: Skill['frontmatter'];
}

/**
 * Union type for all resources
 */
export type Resource = AgentResource | SkillResource;

/**
 * Type guard for Agent resources
 */
export function isAgentResource(resource: Resource): resource is AgentResource {
  return resource.type === ResourceType.Agent;
}

/**
 * Type guard for Skill resources
 */
export function isSkillResource(resource: Resource): resource is SkillResource {
  return resource.type === ResourceType.Skill;
}

/**
 * Convert Agent to Resource
 */
export function agentToResource(agent: Agent): AgentResource {
  return {
    ...agent,
    type: ResourceType.Agent,
  };
}

/**
 * Convert Skill to Resource
 */
export function skillToResource(skill: Skill): SkillResource {
  return {
    ...skill,
    type: ResourceType.Skill,
  };
}

/**
 * Convert Resource back to Agent
 */
export function resourceToAgent(resource: AgentResource): Agent {
  const { type, ...agent } = resource;
  return agent as Agent;
}

/**
 * Convert Resource back to Skill
 */
export function resourceToSkill(resource: SkillResource): Skill {
  const { type, ...skill } = resource;
  return skill as Skill;
}

/**
 * Configuration for resource operations
 * Allows customization of behavior per resource type
 */
export interface ResourceConfig<T extends Resource = Resource> {
  type: ResourceType;
  displayName: string;
  displayNamePlural: string;

  // Paths
  globalPath: string; // e.g., "~/.claude/agents" or "~/.claude/skills"
  projectPath: string; // e.g., ".claude/agents" or ".claude/skills"

  // File operations
  fileExtension?: string; // e.g., ".md" for agents, null for skills
  isDirectory: boolean; // true for skills, false for agents

  // Conversion functions
  toResource: (item: Agent | Skill) => T;
  fromResource: (resource: T) => Agent | Skill;

  // Markdown operations
  toMarkdown: (item: Agent | Skill) => string;
  fromMarkdown: (content: string, filename: string, scope: AgentScope, actualPath?: string) => Agent | Skill | null;

  // Validation
  isValid: (item: Agent | Skill) => boolean;
}

/**
 * Get the appropriate path based on scope
 */
export function getResourcePath(config: ResourceConfig, scope: AgentScope): string {
  return scope === AgentScope.Global ? config.globalPath : config.projectPath;
}

/**
 * Get display name (singular or plural)
 */
export function getDisplayName(config: ResourceConfig, plural: boolean = false): string {
  return plural ? config.displayNamePlural : config.displayName;
}
