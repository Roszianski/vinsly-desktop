/**
 * Resource configurations for Agent and Skill types
 * Defines how each resource type is handled in the application
 */

import { Agent, Skill, AgentScope } from '../types';
import {
  ResourceType,
  ResourceConfig,
  AgentResource,
  SkillResource,
  agentToResource,
  skillToResource,
  resourceToAgent,
  resourceToSkill,
} from '../types/resource';
import { agentToMarkdown } from '../utils/agentExport';
import { markdownToAgent } from '../utils/agentImport';
import { skillToMarkdown, skillFileToSkill } from '../utils/skillParser';
import { SkillFile } from '../utils/tauriCommands';

/**
 * Agent resource configuration
 */
export const AGENT_CONFIG: ResourceConfig<AgentResource> = {
  type: ResourceType.Agent,
  displayName: 'Agent',
  displayNamePlural: 'Agents',

  globalPath: '~/.claude/agents',
  projectPath: '.claude/agents',

  fileExtension: '.md',
  isDirectory: false,

  toResource: (item: Agent | Skill) => agentToResource(item as Agent),
  fromResource: (resource: AgentResource) => resourceToAgent(resource),

  toMarkdown: (item: Agent | Skill) => agentToMarkdown(item as Agent),
  fromMarkdown: (content: string, filename: string, scope: AgentScope, actualPath?: string) => {
    return markdownToAgent(content, filename, scope, actualPath);
  },

  isValid: (item: Agent | Skill) => {
    const agent = item as Agent;
    return !!(
      agent.name &&
      agent.frontmatter?.name &&
      agent.frontmatter?.description
    );
  },
};

/**
 * Skill resource configuration
 */
export const SKILL_CONFIG: ResourceConfig<SkillResource> = {
  type: ResourceType.Skill,
  displayName: 'Skill',
  displayNamePlural: 'Skills',

  globalPath: '~/.claude/skills',
  projectPath: '.claude/skills',

  fileExtension: undefined, // Skills are directories
  isDirectory: true,

  toResource: (item: Agent | Skill) => skillToResource(item as Skill),
  fromResource: (resource: SkillResource) => resourceToSkill(resource),

  toMarkdown: (item: Agent | Skill) => skillToMarkdown(item as Skill),
  fromMarkdown: (content: string, filename: string, scope: AgentScope, actualPath?: string) => {
    // Skills need special handling since they're loaded from SkillFile
    const skillFile: SkillFile = {
      name: filename.replace(/\.md$/, ''),
      directory: actualPath || '',
      path: actualPath || '',
      content,
      scope: scope === AgentScope.Global ? 'global' : 'project',
      has_assets: false,
    };
    return skillFileToSkill(skillFile);
  },

  isValid: (item: Agent | Skill) => {
    const skill = item as Skill;
    return !!(
      skill.name &&
      skill.frontmatter?.name &&
      skill.frontmatter?.description &&
      skill.directoryPath
    );
  },
};

/**
 * Get configuration for a resource type
 */
export function getResourceConfig(type: ResourceType): ResourceConfig {
  return type === ResourceType.Agent ? AGENT_CONFIG : SKILL_CONFIG;
}

/**
 * Get all resource configurations
 */
export function getAllResourceConfigs(): ResourceConfig[] {
  return [AGENT_CONFIG, SKILL_CONFIG];
}
