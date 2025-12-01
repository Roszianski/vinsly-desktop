/**
 * Generic Resource List Item Component
 * Works with both Agents and Skills - demonstrates code consolidation
 */

import React, { useState } from 'react';
import { Agent, Skill } from '../types';
import { ResourceConfig } from '../types/resource';
import { StarIcon } from './icons/StarIcon';
import { DeleteIcon } from './icons/DeleteIcon';

interface ResourceListItemProps<T extends Agent | Skill> {
  item: T;
  config: ResourceConfig;
  onSelect: (item: T) => void;
  onToggleFavorite: (item: T) => void;
  onDuplicate: (item: T) => void;
  onDelete: (item: T) => void;
  onRevealInFolder?: (item: T) => void;
  isSelected?: boolean;
}

/**
 * Generic list item that works for both Agents and Skills
 * This single component replaces AgentListItem and SkillListItem
 */
export function ResourceListItem<T extends Agent | Skill>({
  item,
  config,
  onSelect,
  onToggleFavorite,
  onDuplicate,
  onDelete,
  onRevealInFolder,
  isSelected = false,
}: ResourceListItemProps<T>) {
  const [showActions, setShowActions] = useState(false);

  const getScopeLabel = () => {
    return item.scope === 'Global' ? 'Global' : 'Project';
  };

  const getScopeBadgeClass = () => {
    return item.scope === 'Global'
      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
      : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300';
  };

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleFavorite(item);
  };

  const handleActionClick = (e: React.MouseEvent, action: () => void) => {
    e.stopPropagation();
    action();
    setShowActions(false);
  };

  return (
    <div
      className={`
        group relative flex items-center gap-3 px-4 py-3 rounded-lg
        cursor-pointer transition-all duration-200
        ${isSelected
          ? 'bg-v-accent/10 ring-2 ring-v-accent'
          : 'hover:bg-v-light-hover dark:hover:bg-v-light-dark'
        }
      `}
      onClick={() => onSelect(item)}
    >
      {/* Favorite Star */}
      <button
        onClick={handleFavoriteClick}
        className="flex-shrink-0 text-gray-400 hover:text-yellow-500 transition-colors"
        aria-label={item.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
      >
        <StarIcon
          className={`w-5 h-5 ${
            item.isFavorite
              ? 'text-yellow-500 fill-yellow-500'
              : 'hover:fill-yellow-100 dark:hover:fill-yellow-900/30'
          }`}
        />
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-sm font-medium text-v-light-text-primary dark:text-v-text-primary truncate">
            {item.name}
          </h3>
          <span
            className={`
              px-2 py-0.5 text-xs font-medium rounded-full whitespace-nowrap
              ${getScopeBadgeClass()}
            `}
          >
            {getScopeLabel()}
          </span>
        </div>
        <p className="text-xs text-v-light-text-secondary dark:text-v-text-secondary line-clamp-1">
          {item.frontmatter.description}
        </p>
      </div>

      {/* Actions Menu */}
      <div className="relative flex-shrink-0">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowActions(!showActions);
          }}
          className="p-2 rounded-lg hover:bg-v-light-hover dark:hover:bg-v-light-dark transition-colors opacity-0 group-hover:opacity-100"
          aria-label="Actions"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
          </svg>
        </button>

        {/* Actions Dropdown */}
        {showActions && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-10"
              onClick={(e) => {
                e.stopPropagation();
                setShowActions(false);
              }}
            />

            {/* Menu */}
            <div className="absolute right-0 top-full mt-1 w-48 bg-v-light-surface dark:bg-v-mid-dark border border-v-light-border dark:border-v-border rounded-lg shadow-lg z-20 py-1">
              <button
                onClick={(e) => handleActionClick(e, () => onSelect(item))}
                className="w-full px-4 py-2 text-left text-sm hover:bg-v-light-hover dark:hover:bg-v-light-dark transition-colors"
              >
                Edit {config.displayName}
              </button>

              <button
                onClick={(e) => handleActionClick(e, () => onDuplicate(item))}
                className="w-full px-4 py-2 text-left text-sm hover:bg-v-light-hover dark:hover:bg-v-light-dark transition-colors"
              >
                Duplicate
              </button>

              {onRevealInFolder && (
                <button
                  onClick={(e) => handleActionClick(e, () => onRevealInFolder(item))}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-v-light-hover dark:hover:bg-v-light-dark transition-colors"
                >
                  Reveal in Folder
                </button>
              )}

              <hr className="my-1 border-v-light-border dark:border-v-border" />

              <button
                onClick={(e) => handleActionClick(e, () => onDelete(item))}
                className="w-full px-4 py-2 text-left text-sm text-v-danger hover:bg-v-danger/10 transition-colors flex items-center gap-2"
              >
                <DeleteIcon className="w-4 h-4" />
                Delete {config.displayName}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Example usage:
 *
 * // For Agents
 * <ResourceListItem
 *   item={agent}
 *   config={AGENT_CONFIG}
 *   onSelect={handleSelectAgent}
 *   onToggleFavorite={handleToggleFavoriteAgent}
 *   onDuplicate={handleDuplicateAgent}
 *   onDelete={handleDeleteAgent}
 * />
 *
 * // For Skills - same component!
 * <ResourceListItem
 *   item={skill}
 *   config={SKILL_CONFIG}
 *   onSelect={handleSelectSkill}
 *   onToggleFavorite={handleToggleFavoriteSkill}
 *   onDuplicate={handleDuplicateSkill}
 *   onDelete={handleDeleteSkill}
 * />
 */
