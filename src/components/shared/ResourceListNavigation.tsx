import React from 'react';
import { LayersIcon } from '../icons/LayersIcon';
import { FolderIcon } from '../icons/FolderIcon';
import { DocumentIcon } from '../icons/DocumentIcon';
import { TerminalIcon } from '../icons/TerminalIcon';

export type ViewType = 'subagents' | 'skills' | 'team' | 'analytics' | 'memory' | 'commands';

export interface ResourceListNavigationProps {
  activeView: ViewType;
  onShowSubagents: () => void;
  onShowSkills: () => void;
  onShowMemory: () => void;
  onShowCommands: () => void;
}

/**
 * Shared navigation tabs component for resource list screens
 * Provides consistent navigation between Subagents, Skills, Memory, and Commands views
 */
export const ResourceListNavigation: React.FC<ResourceListNavigationProps> = ({
  activeView,
  onShowSubagents,
  onShowSkills,
  onShowMemory,
  onShowCommands,
}) => {
  const tabs = [
    {
      id: 'subagents' as const,
      label: 'Subagents',
      icon: LayersIcon,
      onClick: onShowSubagents,
    },
    {
      id: 'skills' as const,
      label: 'Skills',
      icon: FolderIcon,
      onClick: onShowSkills,
    },
    {
      id: 'memory' as const,
      label: 'Memory',
      icon: DocumentIcon,
      onClick: onShowMemory,
    },
    {
      id: 'commands' as const,
      label: 'Commands',
      icon: TerminalIcon,
      onClick: onShowCommands,
    },
  ];

  return (
    <div className="flex gap-1 bg-v-light-surface-2 dark:bg-v-surface-2 p-1 rounded-lg border border-v-light-border dark:border-v-border">
      {tabs.map(tab => {
        const Icon = tab.icon;
        const isActive = activeView === tab.id;

        return (
          <button
            key={tab.id}
            onClick={tab.onClick}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md
              transition-colors duration-150
              ${isActive
                ? 'bg-v-light-bg dark:bg-v-dark text-v-light-accent-text dark:text-v-accent shadow-sm'
                : 'text-v-light-text-secondary dark:text-v-text-secondary hover:text-v-light-text-primary dark:hover:text-v-text-primary hover:bg-v-light-surface-1/50 dark:hover:bg-v-surface-1/50'
              }
            `}
          >
            <Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
};

export default ResourceListNavigation;
