import React, { useState, useEffect } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { SlashCommand, AgentScope } from '../../types';
import { GlobeIcon } from '../icons/GlobeIcon';
import { FolderIcon } from '../icons/FolderIcon';
import { ArrowLeftIcon } from '../icons/ArrowLeftIcon';
import { TerminalIcon } from '../icons/TerminalIcon';
import { SpinnerIcon } from '../icons/SpinnerIcon';

interface SlashCommandEditorScreenProps {
  command: SlashCommand;
  onSave: (command: SlashCommand, options?: { projectPath?: string }) => Promise<void>;
  onCancel: () => void;
  mode: 'create' | 'edit';
  existingNames: string[];
}

export const SlashCommandEditorScreen: React.FC<SlashCommandEditorScreenProps> = ({
  command,
  onSave,
  onCancel,
  mode,
  existingNames,
}) => {
  const [name, setName] = useState(command.name);
  const [scope, setScope] = useState(command.scope);
  const [body, setBody] = useState(command.body);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; body?: string }>({});
  const [projectFolderPath, setProjectFolderPath] = useState('');
  const [projectFolderError, setProjectFolderError] = useState('');
  const [isPickingProjectFolder, setIsPickingProjectFolder] = useState(false);

  // Reset form when command changes
  useEffect(() => {
    setName(command.name);
    setScope(command.scope);
    setBody(command.body);
    setErrors({});
  }, [command]);

  const validateName = (value: string): string | undefined => {
    if (!value.trim()) {
      return 'Command name is required';
    }
    if (!/^[a-z0-9-]+$/.test(value)) {
      return 'Use lowercase letters, numbers, and hyphens only';
    }
    if (mode === 'create' && existingNames.includes(value)) {
      return 'A command with this name already exists';
    }
    if (mode === 'edit' && value !== command.name && existingNames.includes(value)) {
      return 'A command with this name already exists';
    }
    return undefined;
  };

  const validateBody = (value: string): string | undefined => {
    if (!value.trim()) {
      return 'Command body is required';
    }
    return undefined;
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setName(value);
    setErrors(prev => ({ ...prev, name: undefined }));
  };

  const handleBodyChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setBody(e.target.value);
    setErrors(prev => ({ ...prev, body: undefined }));
  };

  const handleProjectFolderPick = async (event: React.MouseEvent) => {
    event.stopPropagation();
    if (isPickingProjectFolder) return;

    setIsPickingProjectFolder(true);
    try {
      const selectedPath = await open({
        directory: true,
        multiple: false,
        title: 'Select Project Directory'
      });

      if (!selectedPath || Array.isArray(selectedPath)) {
        return;
      }

      setProjectFolderPath(selectedPath);
      setProjectFolderError('');
      setScope(AgentScope.Project);
    } catch (error) {
      console.error('Failed to select project folder:', error);
      setProjectFolderError('Unable to open the folder picker. Please try again.');
    } finally {
      setIsPickingProjectFolder(false);
    }
  };

  const handleScopeChange = (newScope: AgentScope) => {
    if (newScope === AgentScope.Project && !projectFolderPath) {
      // Trigger folder picker when switching to Project without a folder
      handleProjectFolderPick({ stopPropagation: () => {} } as React.MouseEvent);
    } else {
      setScope(newScope);
    }
  };

  const handleSave = async () => {
    const nameError = validateName(name);
    const bodyError = validateBody(body);

    // Validate project folder if project scope
    if (scope === AgentScope.Project && !projectFolderPath) {
      setProjectFolderError('Please select a project folder');
      return;
    }

    if (nameError || bodyError) {
      setErrors({ name: nameError, body: bodyError });
      return;
    }

    setIsSaving(true);
    try {
      const updatedCommand: SlashCommand = {
        ...command,
        name,
        scope,
        body,
      };

      await onSave(updatedCommand, {
        projectPath: scope === AgentScope.Project ? projectFolderPath : undefined,
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Get display path for project folder
  const displayProjectPath = projectFolderPath
    ? projectFolderPath.split('/').slice(-2).join('/')
    : 'Choose folder...';

  return (
    <div className="flex flex-col h-full bg-v-light-bg dark:bg-v-dark">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-v-light-border dark:border-v-border">
        <div className="flex items-center gap-4">
          <button
            onClick={onCancel}
            className="p-2 rounded-lg hover:bg-v-light-hover dark:hover:bg-v-light-dark text-v-light-text-secondary dark:text-v-text-secondary hover:text-v-light-text-primary dark:hover:text-v-text-primary transition-colors"
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <TerminalIcon className="w-5 h-5 text-v-accent" />
            <h1 className="text-lg font-semibold text-v-light-text-primary dark:text-v-text-primary">
              {mode === 'create' ? 'New Command' : 'Edit Command'}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-v-light-text-secondary dark:text-v-text-secondary hover:text-v-light-text-primary dark:hover:text-v-text-primary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 bg-v-accent text-white rounded-lg hover:bg-v-accent-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Saving...' : 'Save Command'}
          </button>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto p-6 space-y-6">
          {/* Scope selector */}
          <div>
            <label className="block text-sm font-medium text-v-light-text-primary dark:text-v-text-primary mb-2">
              Location
            </label>
            <div className="grid gap-4 md:grid-cols-2">
              {/* Global option */}
              <button
                type="button"
                onClick={() => handleScopeChange(AgentScope.Global)}
                className={`relative text-left border rounded-lg p-4 transition-colors duration-150 ${
                  scope === AgentScope.Global
                    ? 'border-v-accent bg-v-light-hover dark:bg-v-light-dark'
                    : 'border-v-light-border dark:border-v-border hover:border-v-accent'
                }`}
              >
                <div className="flex items-start gap-3">
                  <GlobeIcon className={`w-5 h-5 mt-0.5 ${scope === AgentScope.Global ? 'text-v-accent' : 'text-v-light-text-secondary dark:text-v-text-secondary'}`} />
                  <div>
                    <div className={`font-medium ${scope === AgentScope.Global ? 'text-v-accent' : 'text-v-light-text-primary dark:text-v-text-primary'}`}>
                      Global
                    </div>
                    <div className="text-xs text-v-light-text-secondary dark:text-v-text-secondary mt-1">
                      Saved in ~/.claude/commands/ and available everywhere
                    </div>
                  </div>
                </div>
              </button>

              {/* Project option */}
              <button
                type="button"
                onClick={() => handleScopeChange(AgentScope.Project)}
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
                    onClick={handleProjectFolderPick}
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
                      <FolderIcon className={`w-4 h-4 ${projectFolderError ? 'text-red-500' : 'text-v-light-text-secondary dark:text-v-text-secondary'}`} />
                    )}
                  </button>
                </div>

                <div className="flex items-start gap-3 pr-8">
                  <FolderIcon className={`w-5 h-5 mt-0.5 ${scope === AgentScope.Project ? 'text-v-accent' : 'text-v-light-text-secondary dark:text-v-text-secondary'}`} />
                  <div>
                    <div className={`font-medium ${scope === AgentScope.Project ? 'text-v-accent' : 'text-v-light-text-primary dark:text-v-text-primary'}`}>
                      Project
                    </div>
                    <div className="text-xs text-v-light-text-secondary dark:text-v-text-secondary mt-1">
                      {projectFolderPath
                        ? `Saved in ${displayProjectPath}/.claude/commands/`
                        : 'Click to choose a project folder'}
                    </div>
                  </div>
                </div>
              </button>
            </div>
            {projectFolderError && (
              <p className="mt-2 text-sm text-red-500">{projectFolderError}</p>
            )}
          </div>

          {/* Name input */}
          <div>
            <label className="block text-sm font-medium text-v-light-text-primary dark:text-v-text-primary mb-2">
              Command Name
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-v-light-text-secondary dark:text-v-text-secondary font-mono">
                /
              </span>
              <input
                type="text"
                value={name}
                onChange={handleNameChange}
                placeholder="my-command"
                className={`w-full pl-7 pr-4 py-3 bg-v-light-surface dark:bg-v-mid-dark border rounded-lg font-mono text-v-light-text-primary dark:text-v-text-primary placeholder:text-v-light-text-secondary/50 dark:placeholder:text-v-text-secondary/50 focus:outline-none focus:border-v-accent focus:ring-2 focus:ring-v-accent/20 ${
                  errors.name
                    ? 'border-red-500'
                    : 'border-v-light-border dark:border-v-border'
                }`}
              />
            </div>
            {errors.name && (
              <p className="mt-1 text-sm text-red-500">{errors.name}</p>
            )}
            <p className="mt-1 text-xs text-v-light-text-secondary dark:text-v-text-secondary">
              Use lowercase letters, numbers, and hyphens. Users will type /{name || 'command-name'} to invoke.
            </p>
          </div>

          {/* Body textarea */}
          <div className="flex-1">
            <label className="block text-sm font-medium text-v-light-text-primary dark:text-v-text-primary mb-2">
              Command Content
            </label>
            <textarea
              value={body}
              onChange={handleBodyChange}
              placeholder="Enter the prompt or instructions for this command...

Example:
Review the code in the current file for:
- Security vulnerabilities
- Performance issues
- Best practice violations

Provide specific suggestions for improvement."
              rows={16}
              className={`w-full px-4 py-3 bg-v-light-surface dark:bg-v-mid-dark border rounded-lg text-v-light-text-primary dark:text-v-text-primary placeholder:text-v-light-text-secondary/50 dark:placeholder:text-v-text-secondary/50 focus:outline-none focus:border-v-accent focus:ring-2 focus:ring-v-accent/20 resize-none font-mono text-sm ${
                errors.body
                  ? 'border-red-500'
                  : 'border-v-light-border dark:border-v-border'
              }`}
            />
            {errors.body && (
              <p className="mt-1 text-sm text-red-500">{errors.body}</p>
            )}
            <p className="mt-1 text-xs text-v-light-text-secondary dark:text-v-text-secondary">
              This content will be used as a prompt when the command is invoked.
            </p>
          </div>

          {/* Preview */}
          <div className="bg-v-light-surface dark:bg-v-mid-dark border border-v-light-border dark:border-v-border rounded-lg p-4">
            <div className="text-xs font-bold text-v-light-text-secondary dark:text-v-text-secondary uppercase tracking-wider mb-2">
              Preview
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-2 bg-v-light-hover dark:bg-v-light-dark rounded-lg">
                <TerminalIcon className="w-4 h-4 text-v-accent" />
                <span className="font-mono text-v-light-text-primary dark:text-v-text-primary">/{name || 'command-name'}</span>
              </div>
              <span className="text-sm text-v-light-text-secondary dark:text-v-text-secondary">
                {scope === AgentScope.Global
                  ? 'Available globally'
                  : projectFolderPath
                    ? `In ${displayProjectPath}`
                    : 'Project-scoped'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
