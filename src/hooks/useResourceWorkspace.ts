/**
 * Resource-based workspace utilities
 * Wraps useWorkspace to provide generic resource operations
 */

import { useCallback } from 'react';
import { Agent, Skill, AgentScope } from '../types';
import { Resource, ResourceType, agentToResource, skillToResource } from '../types/resource';
import { ResourceConfig } from '../types/resource';
import { AGENT_CONFIG, SKILL_CONFIG } from '../config/resourceConfig';
import {
  duplicateResource,
  filterResources,
  sortResources,
  SortField,
  SortDirection,
} from '../utils/resourceOperations';
import { UseWorkspaceResult } from './useWorkspace';

/**
 * Hook that adds resource-generic operations to useWorkspace
 * This demonstrates how to use the resource system without rewriting useWorkspace
 */
export function useResourceWorkspace(workspace: UseWorkspaceResult) {
  /**
   * Get resources of a specific type
   */
  const getResources = useCallback(<T extends Resource>(
    type: ResourceType
  ): (Agent | Skill)[] => {
    return type === ResourceType.Agent ? workspace.agents : workspace.skills;
  }, [workspace.agents, workspace.skills]);

  /**
   * Get configuration for a resource type
   */
  const getConfig = useCallback((type: ResourceType): ResourceConfig => {
    return type === ResourceType.Agent ? AGENT_CONFIG : SKILL_CONFIG;
  }, []);

  /**
   * Generic duplicate function
   */
  const duplicate = useCallback(<T extends Agent | Skill>(
    item: T,
    type: ResourceType
  ): T => {
    const config = getConfig(type);
    const existing = getResources(type) as T[];
    return duplicateResource(item, existing, config);
  }, [getConfig, getResources]);

  /**
   * Generic filter function
   */
  const filter = useCallback(<T extends Agent | Skill>(
    items: T[],
    query: string
  ): T[] => {
    return filterResources(items, query);
  }, []);

  /**
   * Generic sort function
   */
  const sort = useCallback(<T extends Agent | Skill>(
    items: T[],
    field: SortField,
    direction: SortDirection = 'asc'
  ): T[] => {
    return sortResources(items, field, direction);
  }, []);

  /**
   * Generic toggle favorite function
   */
  const toggleFavorite = useCallback((
    item: Agent | Skill,
    type: ResourceType
  ): void => {
    if (type === ResourceType.Agent) {
      workspace.toggleAgentFavorite(item as Agent);
    } else {
      workspace.toggleSkillFavorite(item as Skill);
    }
  }, [workspace]);

  /**
   * Generic delete function
   */
  const deleteResource = useCallback(async (
    id: string,
    type: ResourceType
  ): Promise<void> => {
    if (type === ResourceType.Agent) {
      await workspace.deleteAgent(id);
    } else {
      await workspace.deleteSkill(id);
    }
  }, [workspace]);

  /**
   * Generic bulk delete function
   */
  const bulkDelete = useCallback(async (
    ids: string[],
    type: ResourceType
  ): Promise<void> => {
    if (type === ResourceType.Agent) {
      await workspace.bulkDeleteAgents(ids);
    } else {
      // Note: useWorkspace doesn't have bulkDeleteSkills yet
      await Promise.all(ids.map(id => workspace.deleteSkill(id)));
    }
  }, [workspace]);

  /**
   * Get display name for resource type
   */
  const getDisplayName = useCallback((
    type: ResourceType,
    plural: boolean = false
  ): string => {
    const config = getConfig(type);
    return plural ? config.displayNamePlural : config.displayName;
  }, [getConfig]);

  return {
    // Generic operations
    getResources,
    getConfig,
    duplicate,
    filter,
    sort,
    toggleFavorite,
    deleteResource,
    bulkDelete,
    getDisplayName,

    // Pass through original workspace
    ...workspace,
  };
}

/**
 * Simpler hook API that works with a specific resource type
 */
export function useTypedResources<T extends Agent | Skill>(
  workspace: UseWorkspaceResult,
  type: ResourceType
) {
  const items = (type === ResourceType.Agent ? workspace.agents : workspace.skills) as T[];
  const config = type === ResourceType.Agent ? AGENT_CONFIG : SKILL_CONFIG;

  const duplicateItem = useCallback((item: T): T => {
    return duplicateResource(item, items, config);
  }, [items, config]);

  const filterItems = useCallback((query: string): T[] => {
    return filterResources(items, query);
  }, [items]);

  const sortItems = useCallback((
    field: SortField,
    direction: SortDirection = 'asc'
  ): T[] => {
    return sortResources(items, field, direction);
  }, [items]);

  const toggleFavorite = useCallback((item: T) => {
    if (type === ResourceType.Agent) {
      workspace.toggleAgentFavorite(item as Agent);
    } else {
      workspace.toggleSkillFavorite(item as Skill);
    }
  }, [type, workspace]);

  const deleteItem = useCallback(async (id: string) => {
    if (type === ResourceType.Agent) {
      await workspace.deleteAgent(id);
    } else {
      await workspace.deleteSkill(id);
    }
  }, [type, workspace]);

  return {
    items,
    config,
    duplicate: duplicateItem,
    filter: filterItems,
    sort: sortItems,
    toggleFavorite,
    delete: deleteItem,
  };
}
