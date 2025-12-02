/**
 * Shared scope selector component for Global/Project selection
 * Used by AgentEditorScreen, SkillEditorScreen, and SlashCommandEditorScreen
 */

import React from 'react';
import { AgentScope } from '../../types';
import { GlobeIcon } from '../icons/GlobeIcon';
import { FolderIcon } from '../icons/FolderIcon';
import { SpinnerIcon } from '../icons/SpinnerIcon';

export interface ScopeOption {
  scope: AgentScope;
  title: string;
  description: string;
  pathPrefix: string;
}

export interface ScopeSelectorProps {
  /** Current selected scope */
  scope: AgentScope;
  /** Selected project folder path */
  projectFolderPath: string;
  /** Error message for project folder */
  projectFolderError?: string;
  /** Whether folder picker is in progress */
  isPickingProjectFolder?: boolean;
  /** Callback when scope selection changes */
  onScopeChange: (scope: AgentScope) => void;
  /** Callback when folder picker button is clicked */
  onPickProjectFolder: (event: React.MouseEvent) => void;
  /** Custom scope options (optional) */
  scopeOptions?: {
    global?: Partial<ScopeOption>;
    project?: Partial<ScopeOption>;
  };
  /** Display mode: cards (default) or compact */
  variant?: 'cards' | 'compact';
  /** Custom class name */
  className?: string;
}

const DEFAULT_SCOPE_OPTIONS: Record<AgentScope, ScopeOption> = {
  [AgentScope.Global]: {
    scope: AgentScope.Global,
    title: 'Global',
    description: 'Saved in ~/.claude/ and available everywhere',
    pathPrefix: '~/.claude/',
  },
  [AgentScope.Project]: {
    scope: AgentScope.Project,
    title: 'Project',
    description: 'Saved in the project folder',
    pathPrefix: '.claude/',
  },
};

export const ScopeSelector: React.FC<ScopeSelectorProps> = ({
  scope,
  projectFolderPath,
  projectFolderError,
  isPickingProjectFolder = false,
  onScopeChange,
  onPickProjectFolder,
  scopeOptions,
  variant = 'cards',
  className = '',
}) => {
  const globalOption = {
    ...DEFAULT_SCOPE_OPTIONS[AgentScope.Global],
    ...scopeOptions?.global,
  };

  const projectOption = {
    ...DEFAULT_SCOPE_OPTIONS[AgentScope.Project],
    ...scopeOptions?.project,
  };

  // Get display path (last 2 segments)
  const displayProjectPath = projectFolderPath
    ? projectFolderPath.split('/').slice(-2).join('/')
    : 'Choose folder...';

  const projectDescription = projectFolderPath
    ? `Saved in ${displayProjectPath}/${projectOption.pathPrefix}`
    : 'Click to choose a project folder';

  if (variant === 'compact') {
    return (
      <div className={`flex gap-2 ${className}`}>
        <button
          type="button"
          onClick={() => onScopeChange(AgentScope.Global)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
            scope === AgentScope.Global
              ? 'border-v-accent bg-v-light-hover dark:bg-v-light-dark text-v-accent'
              : 'border-v-light-border dark:border-v-border hover:border-v-accent text-v-light-text-primary dark:text-v-text-primary'
          }`}
        >
          <GlobeIcon className="w-4 h-4" />
          <span className="text-sm font-medium">{globalOption.title}</span>
        </button>

        <button
          type="button"
          onClick={() => onScopeChange(AgentScope.Project)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
            scope === AgentScope.Project
              ? projectFolderError
                ? 'border-red-500 dark:border-red-400 bg-red-50 dark:bg-red-900/10 text-red-600'
                : 'border-v-accent bg-v-light-hover dark:bg-v-light-dark text-v-accent'
              : 'border-v-light-border dark:border-v-border hover:border-v-accent text-v-light-text-primary dark:text-v-text-primary'
          }`}
        >
          <FolderIcon className="w-4 h-4" />
          <span className="text-sm font-medium">{projectOption.title}</span>
          {scope === AgentScope.Project && (
            <button
              type="button"
              onClick={onPickProjectFolder}
              disabled={isPickingProjectFolder}
              className="ml-1 p-1 rounded hover:bg-v-light-border dark:hover:bg-v-border"
            >
              {isPickingProjectFolder ? (
                <SpinnerIcon className="w-3 h-3 animate-spin" />
              ) : (
                <FolderIcon className="w-3 h-3" />
              )}
            </button>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="grid gap-4 md:grid-cols-2">
        {/* Global option */}
        <button
          type="button"
          onClick={() => onScopeChange(AgentScope.Global)}
          className={`relative text-left border rounded-lg p-4 transition-colors duration-150 ${
            scope === AgentScope.Global
              ? 'border-v-accent bg-v-light-hover dark:bg-v-light-dark'
              : 'border-v-light-border dark:border-v-border hover:border-v-accent'
          }`}
        >
          <div className="flex items-start gap-3">
            <GlobeIcon
              className={`w-5 h-5 mt-0.5 ${
                scope === AgentScope.Global
                  ? 'text-v-accent'
                  : 'text-v-light-text-secondary dark:text-v-text-secondary'
              }`}
            />
            <div>
              <div
                className={`font-medium ${
                  scope === AgentScope.Global
                    ? 'text-v-accent'
                    : 'text-v-light-text-primary dark:text-v-text-primary'
                }`}
              >
                {globalOption.title}
              </div>
              <div className="text-xs text-v-light-text-secondary dark:text-v-text-secondary mt-1">
                {globalOption.description}
              </div>
            </div>
          </div>
        </button>

        {/* Project option */}
        <button
          type="button"
          onClick={() => onScopeChange(AgentScope.Project)}
          className={`relative text-left border rounded-lg p-4 transition-colors duration-150 ${
            scope === AgentScope.Project
              ? projectFolderError
                ? 'border-red-500 dark:border-red-400 bg-red-50 dark:bg-red-900/10'
                : 'border-v-accent bg-v-light-hover dark:bg-v-light-dark'
              : 'border-v-light-border dark:border-v-border hover:border-v-accent'
          }`}
        >
          {/* Folder picker button */}
          <div className="absolute top-3 right-3">
            <button
              type="button"
              onClick={onPickProjectFolder}
              disabled={isPickingProjectFolder}
              className={`p-1.5 rounded-md transition-colors ${
                projectFolderError
                  ? 'bg-red-100 dark:bg-red-900/20 hover:bg-red-200 dark:hover:bg-red-900/30'
                  : 'hover:bg-v-light-border dark:hover:bg-v-border'
              } ${isPickingProjectFolder ? 'cursor-wait opacity-80' : ''}`}
              aria-label="Choose project folder"
              title={projectFolderPath || 'Choose project folder'}
            >
              {isPickingProjectFolder ? (
                <SpinnerIcon className="w-4 h-4 animate-spin text-v-accent" />
              ) : (
                <FolderIcon
                  className={`w-4 h-4 ${
                    projectFolderError
                      ? 'text-red-500'
                      : 'text-v-light-text-secondary dark:text-v-text-secondary'
                  }`}
                />
              )}
            </button>
          </div>

          <div className="flex items-start gap-3 pr-8">
            <FolderIcon
              className={`w-5 h-5 mt-0.5 ${
                scope === AgentScope.Project
                  ? 'text-v-accent'
                  : 'text-v-light-text-secondary dark:text-v-text-secondary'
              }`}
            />
            <div>
              <div
                className={`font-medium ${
                  scope === AgentScope.Project
                    ? 'text-v-accent'
                    : 'text-v-light-text-primary dark:text-v-text-primary'
                }`}
              >
                {projectOption.title}
              </div>
              <div className="text-xs text-v-light-text-secondary dark:text-v-text-secondary mt-1">
                {projectDescription}
              </div>
            </div>
          </div>
        </button>
      </div>

      {projectFolderError && (
        <p className="mt-2 text-sm text-red-500">{projectFolderError}</p>
      )}
    </div>
  );
};

export default ScopeSelector;
