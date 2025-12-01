/**
 * Shared resource operations for Agents and Skills
 * Provides unified CRUD operations using ResourceConfig
 */

import { Agent, Skill, AgentScope } from '../types';
import { Resource, ResourceConfig, ResourceType } from '../types/resource';
import { getStorageItem, setStorageItem } from './storage';

/**
 * Storage keys for favorites
 */
const FAVORITES_STORAGE_KEY = {
  [ResourceType.Agent]: 'favorite-agents',
  [ResourceType.Skill]: 'favorite-skills',
};

/**
 * Get favorites from storage
 */
export async function getFavorites(type: ResourceType): Promise<string[]> {
  const key = FAVORITES_STORAGE_KEY[type];
  const favorites = await getStorageItem<string[]>(key);
  return favorites || [];
}

/**
 * Save favorites to storage
 */
export async function saveFavorites(type: ResourceType, favorites: string[]): Promise<void> {
  const key = FAVORITES_STORAGE_KEY[type];
  await setStorageItem(key, favorites);
}

/**
 * Toggle favorite status for a resource
 */
export async function toggleFavorite<T extends Agent | Skill>(
  item: T,
  type: ResourceType
): Promise<T> {
  const favorites = await getFavorites(type);
  const isFavorite = favorites.includes(item.id);

  let updatedFavorites: string[];
  if (isFavorite) {
    updatedFavorites = favorites.filter(id => id !== item.id);
  } else {
    updatedFavorites = [...favorites, item.id];
  }

  await saveFavorites(type, updatedFavorites);

  return {
    ...item,
    isFavorite: !isFavorite,
  };
}

/**
 * Mark resources with favorite status
 */
export async function markFavorites<T extends Agent | Skill>(
  items: T[],
  type: ResourceType
): Promise<T[]> {
  const favorites = await getFavorites(type);
  const favoriteSet = new Set(favorites);

  return items.map(item => ({
    ...item,
    isFavorite: favoriteSet.has(item.id),
  }));
}

/**
 * Generate unique name for duplicated resource
 */
export function generateUniqueName<T extends Agent | Skill>(
  baseName: string,
  existingItems: T[]
): string {
  const existingNames = new Set(existingItems.map(item => item.name));

  // If base name is unique, use it
  if (!existingNames.has(baseName)) {
    return baseName;
  }

  // Try "Name (Copy)" first
  const copyName = `${baseName} (Copy)`;
  if (!existingNames.has(copyName)) {
    return copyName;
  }

  // Try "Name (Copy 2)", "Name (Copy 3)", etc.
  let counter = 2;
  while (true) {
    const numberedName = `${baseName} (Copy ${counter})`;
    if (!existingNames.has(numberedName)) {
      return numberedName;
    }
    counter++;
  }
}

/**
 * Create a duplicate of a resource with a unique name
 */
export function duplicateResource<T extends Agent | Skill>(
  item: T,
  existingItems: T[],
  config: ResourceConfig
): T {
  const uniqueName = generateUniqueName(item.name, existingItems);
  const scope = item.scope;
  const basePath = scope === AgentScope.Global ? config.globalPath : config.projectPath;

  // Create new path based on resource type
  let newPath: string;
  if (config.isDirectory) {
    // For skills (directories)
    newPath = `${basePath}/${uniqueName}`;
  } else {
    // For agents (files)
    newPath = `${basePath}/${uniqueName}${config.fileExtension || ''}`;
  }

  const duplicated: T = {
    ...item,
    id: newPath,
    name: uniqueName,
    path: newPath,
    frontmatter: {
      ...item.frontmatter,
      name: uniqueName,
    },
    isFavorite: false, // Duplicates start as non-favorites
  };

  // Handle skill-specific fields
  if ('directoryPath' in item) {
    (duplicated as any).directoryPath = newPath;
  }

  return duplicated;
}

/**
 * Filter resources by search query
 */
export function filterResources<T extends Agent | Skill>(
  items: T[],
  searchQuery: string
): T[] {
  if (!searchQuery.trim()) {
    return items;
  }

  const query = searchQuery.toLowerCase();

  return items.filter(item => {
    const nameMatch = item.name.toLowerCase().includes(query);
    const descMatch = item.frontmatter.description?.toLowerCase().includes(query);
    return nameMatch || descMatch;
  });
}

/**
 * Sort resources by a given field
 */
export type SortField = 'name' | 'scope' | 'model';
export type SortDirection = 'asc' | 'desc';

export function sortResources<T extends Agent | Skill>(
  items: T[],
  field: SortField,
  direction: SortDirection = 'asc'
): T[] {
  const sorted = [...items].sort((a, b) => {
    let aValue: string;
    let bValue: string;

    switch (field) {
      case 'name':
        aValue = a.name.toLowerCase();
        bValue = b.name.toLowerCase();
        break;
      case 'scope':
        aValue = a.scope;
        bValue = b.scope;
        break;
      case 'model':
        aValue = (a.frontmatter as any).model || '';
        bValue = (b.frontmatter as any).model || '';
        break;
      default:
        return 0;
    }

    if (aValue < bValue) return direction === 'asc' ? -1 : 1;
    if (aValue > bValue) return direction === 'asc' ? 1 : -1;
    return 0;
  });

  return sorted;
}

/**
 * Group resources by scope
 */
export function groupByScope<T extends Agent | Skill>(items: T[]): {
  global: T[];
  project: T[];
} {
  return {
    global: items.filter(item => item.scope === AgentScope.Global),
    project: items.filter(item => item.scope === AgentScope.Project),
  };
}

/**
 * Validate resource has all required fields
 */
export function validateResource<T extends Agent | Skill>(
  item: T,
  config: ResourceConfig
): boolean {
  return config.isValid(item);
}

/**
 * Export resources to markdown format
 */
export function resourcesToMarkdown<T extends Agent | Skill>(
  items: T[],
  config: ResourceConfig
): Map<string, string> {
  const markdownMap = new Map<string, string>();

  items.forEach(item => {
    const filename = config.isDirectory
      ? `${item.name}/skill.md`
      : `${item.name}${config.fileExtension || '.md'}`;

    const markdown = config.toMarkdown(item);
    markdownMap.set(filename, markdown);
  });

  return markdownMap;
}

/**
 * Get resource file/directory name from item
 */
export function getResourceFilename(item: Agent | Skill, config: ResourceConfig): string {
  if (config.isDirectory) {
    return item.name;
  }
  return `${item.name}${config.fileExtension || '.md'}`;
}
