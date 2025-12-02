import React, { useState, useEffect, useCallback, useRef } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { AgentScope, ClaudeMemory } from '../../types';
import { GlobeIcon } from '../icons/GlobeIcon';
import { FolderIcon } from '../icons/FolderIcon';
import { SpinnerIcon } from '../icons/SpinnerIcon';
import { DocumentIcon } from '../icons/DocumentIcon';
import { ListIcon } from '../icons/ListIcon';
import { LayersIcon } from '../icons/LayersIcon';
import { TerminalIcon } from '../icons/TerminalIcon';
import { ServerIcon } from '../icons/ServerIcon';
import { LightningIcon } from '../icons/LightningIcon';

interface MemoryScreenProps {
  globalMemory: ClaudeMemory | null;
  projectMemory: ClaudeMemory | null;
  isLoading: boolean;
  activeScope: AgentScope;
  onScopeChange: (scope: AgentScope) => void;
  onSave: (scope: AgentScope, content: string, projectPath?: string) => Promise<void>;
  onShowSubagents: () => void;
  onShowSkills: () => void;
  onShowMemory: () => void;
  onShowCommands: () => void;
  onShowMCP: () => void;
  onShowHooks: () => void;
}

// Simple markdown renderer for preview
function renderMarkdownPreview(content: string): React.ReactNode {
  if (!content.trim()) {
    return <span className="text-v-text-muted italic">No content yet...</span>;
  }

  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const key = `line-${i}`;

    // Headers
    if (line.startsWith('### ')) {
      elements.push(
        <h3 key={key} className="text-base font-semibold text-v-dark dark:text-white mt-4 mb-2">
          {line.slice(4)}
        </h3>
      );
    } else if (line.startsWith('## ')) {
      elements.push(
        <h2 key={key} className="text-lg font-semibold text-v-dark dark:text-white mt-4 mb-2">
          {line.slice(3)}
        </h2>
      );
    } else if (line.startsWith('# ')) {
      elements.push(
        <h1 key={key} className="text-xl font-bold text-v-dark dark:text-white mt-4 mb-2">
          {line.slice(2)}
        </h1>
      );
    }
    // Bullet points
    else if (line.match(/^[-*]\s/)) {
      elements.push(
        <li key={key} className="ml-4 text-v-text dark:text-v-text-light">
          {line.slice(2)}
        </li>
      );
    }
    // Code blocks (inline)
    else if (line.startsWith('```')) {
      // Find the end of the code block
      let codeContent = '';
      let j = i + 1;
      while (j < lines.length && !lines[j].startsWith('```')) {
        codeContent += lines[j] + '\n';
        j++;
      }
      elements.push(
        <pre key={key} className="bg-v-bg-light dark:bg-v-bg-dark p-3 rounded-lg my-2 overflow-x-auto text-sm font-mono">
          <code>{codeContent.trimEnd()}</code>
        </pre>
      );
      i = j; // Skip to end of code block
    }
    // Empty lines
    else if (!line.trim()) {
      elements.push(<div key={key} className="h-2" />);
    }
    // Regular paragraphs
    else {
      elements.push(
        <p key={key} className="text-v-text dark:text-v-text-light leading-relaxed">
          {line}
        </p>
      );
    }
  }

  return elements;
}

export const MemoryScreen: React.FC<MemoryScreenProps> = ({
  globalMemory,
  projectMemory,
  isLoading,
  activeScope,
  onScopeChange,
  onSave,
  onShowSubagents,
  onShowSkills,
  onShowMemory,
  onShowCommands,
  onShowMCP,
  onShowHooks,
}) => {
  const currentMemory = activeScope === AgentScope.Global ? globalMemory : projectMemory;
  const [editContent, setEditContent] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [projectFolderPath, setProjectFolderPath] = useState('');
  const [isPickingProjectFolder, setIsPickingProjectFolder] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedRef = useRef<string>('');

  // Sync content when memory changes
  useEffect(() => {
    if (currentMemory) {
      setEditContent(currentMemory.content);
      lastSavedRef.current = currentMemory.content;
      setIsDirty(false);
    } else {
      setEditContent('');
      lastSavedRef.current = '';
      setIsDirty(false);
    }
  }, [currentMemory]);

  // Auto-save with debounce
  const debouncedSave = useCallback(
    (content: string) => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(async () => {
        if (content !== lastSavedRef.current) {
          setIsSaving(true);
          try {
            const projectPath = activeScope === AgentScope.Project ? projectFolderPath : undefined;
            await onSave(activeScope, content, projectPath);
            lastSavedRef.current = content;
            setIsDirty(false);
          } finally {
            setIsSaving(false);
          }
        }
      }, 1000);
    },
    [activeScope, onSave, projectFolderPath]
  );

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setEditContent(newContent);
    setIsDirty(newContent !== lastSavedRef.current);
    debouncedSave(newContent);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  const handleProjectFolderPick = async () => {
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
      onScopeChange(AgentScope.Project);
    } catch (error) {
      console.error('Failed to select project folder:', error);
    } finally {
      setIsPickingProjectFolder(false);
    }
  };

  const handleScopeToggle = (newScope: AgentScope) => {
    if (newScope === AgentScope.Project && !projectFolderPath) {
      // Trigger folder picker when switching to Project without a folder
      handleProjectFolderPick();
    } else {
      onScopeChange(newScope);
    }
  };

  // Get display path for project folder
  const displayProjectPath = projectFolderPath
    ? projectFolderPath.split('/').slice(-2).join('/')
    : '';

  const canShowProject = !!projectFolderPath;

  const wordCount = editContent.trim().split(/\s+/).filter(Boolean).length;
  const charCount = editContent.length;

  const viewSwitcherItems = [
    { key: 'subagents', label: 'Subagents', icon: <ListIcon className="h-4 w-4" />, action: onShowSubagents },
    { key: 'skills', label: 'Skills', icon: <LayersIcon className="h-4 w-4" />, action: onShowSkills },
    { key: 'memory', label: 'Memory', icon: <DocumentIcon className="h-4 w-4" />, action: onShowMemory },
    { key: 'commands', label: 'Commands', icon: <TerminalIcon className="h-4 w-4" />, action: onShowCommands },
    { key: 'mcp', label: 'MCP', icon: <ServerIcon className="h-4 w-4" />, action: onShowMCP },
    { key: 'hooks', label: 'Hooks', icon: <LightningIcon className="h-4 w-4" />, action: onShowHooks },
  ];

  return (
    <div className="space-y-6">
      {/* View Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-stretch border border-v-light-border dark:border-v-border rounded-lg overflow-hidden bg-v-light-bg dark:bg-v-dark">
          {viewSwitcherItems.map((item, index, array) => (
            <React.Fragment key={item.key}>
              <button
                onClick={item.action}
                className={`px-3 py-2 text-sm font-medium transition-colors duration-200 flex items-center gap-1.5 ${
                  item.key === 'memory'
                    ? 'bg-v-accent/10 text-v-accent'
                    : 'text-v-light-text-secondary dark:text-v-text-secondary hover:text-v-light-text-primary dark:hover:text-v-text-primary hover:bg-v-accent/10 dark:hover:bg-v-light-dark'
                }`}
              >
                {item.icon}
                <span className="hidden sm:inline">{item.label}</span>
              </button>
              {index < array.length - 1 && (
                <div className="w-px bg-v-light-border dark:bg-v-border opacity-50" />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Scope Toggle */}
        <div className="flex items-center gap-2 bg-v-light-bg dark:bg-v-dark rounded-lg p-1 border border-v-light-border dark:border-v-border">
          <button
            onClick={() => handleScopeToggle(AgentScope.Global)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeScope === AgentScope.Global
                ? 'bg-v-light-surface dark:bg-v-mid-dark text-v-light-text-primary dark:text-v-text-primary shadow-sm'
                : 'text-v-light-text-secondary dark:text-v-text-secondary hover:text-v-light-text-primary dark:hover:text-v-text-primary'
            }`}
          >
            <GlobeIcon className="w-4 h-4" />
            Global
          </button>
          <button
            onClick={() => handleScopeToggle(AgentScope.Project)}
            disabled={isPickingProjectFolder}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeScope === AgentScope.Project
                ? 'bg-v-light-surface dark:bg-v-mid-dark text-v-light-text-primary dark:text-v-text-primary shadow-sm'
                : 'text-v-light-text-secondary dark:text-v-text-secondary hover:text-v-light-text-primary dark:hover:text-v-text-primary'
            }`}
            title={projectFolderPath || 'Click to choose a project folder'}
          >
            {isPickingProjectFolder ? (
              <SpinnerIcon className="w-4 h-4 animate-spin" />
            ) : (
              <FolderIcon className="w-4 h-4" />
            )}
            {canShowProject ? displayProjectPath : 'Choose Project...'}
          </button>
        </div>
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <DocumentIcon className="w-5 h-5 text-v-accent" />
          <h1 className="text-lg font-semibold text-v-light-text-primary dark:text-v-text-primary">CLAUDE.md</h1>
          <span className="text-sm text-v-light-text-secondary dark:text-v-text-secondary">
            {activeScope === AgentScope.Global ? 'Global memory' : 'Project memory'}
          </span>
        </div>

        <div className="flex items-center gap-3 text-sm">
          {isSaving && (
            <span className="flex items-center gap-1.5 text-v-light-text-secondary dark:text-v-text-secondary">
              <SpinnerIcon className="w-4 h-4 animate-spin" />
              Saving...
            </span>
          )}
          {isDirty && !isSaving && (
            <span className="text-v-accent">Unsaved changes</span>
          )}
          {!isDirty && !isSaving && currentMemory?.exists && (
            <span className="text-green-600 dark:text-green-400">Saved</span>
          )}
        </div>
      </div>

      {/* Main content area */}
      <div className="bg-v-light-surface dark:bg-v-mid-dark border border-v-light-border dark:border-v-border rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <SpinnerIcon className="w-8 h-8 animate-spin text-v-accent" />
          </div>
        ) : (
          <div className="flex min-h-[500px]">
            {/* Editor panel */}
            <div className="flex-1 flex flex-col border-r border-v-light-border dark:border-v-border">
              <div className="px-4 py-2 bg-v-light-hover dark:bg-v-light-dark border-b border-v-light-border dark:border-v-border">
                <span className="text-xs font-bold text-v-light-text-secondary dark:text-v-text-secondary uppercase tracking-wider">
                  Editor
                </span>
              </div>
              <textarea
                value={editContent}
                onChange={handleContentChange}
                placeholder={`# ${activeScope === AgentScope.Global ? 'Global' : 'Project'} Memory

Add persistent context for Claude Code here...

## Conventions
- Your coding conventions

## Architecture
- Project structure notes

## Warnings
- Things Claude should be careful about`}
                className="flex-1 w-full p-4 bg-v-light-surface dark:bg-v-mid-dark resize-none focus:outline-none text-v-light-text-primary dark:text-v-text-primary font-mono text-sm leading-relaxed"
                spellCheck={false}
              />
              <div className="px-4 py-2 bg-v-light-hover dark:bg-v-light-dark border-t border-v-light-border dark:border-v-border flex items-center justify-between text-xs text-v-light-text-secondary dark:text-v-text-secondary">
                <span>{wordCount} words, {charCount} characters</span>
                <span className="font-mono truncate max-w-xs">{currentMemory?.path || 'Not saved yet'}</span>
              </div>
            </div>

            {/* Preview panel */}
            <div className="flex-1 flex flex-col">
              <div className="px-4 py-2 bg-v-light-hover dark:bg-v-light-dark border-b border-v-light-border dark:border-v-border">
                <span className="text-xs font-bold text-v-light-text-secondary dark:text-v-text-secondary uppercase tracking-wider">
                  Preview
                </span>
              </div>
              <div className="flex-1 p-4 overflow-y-auto bg-v-light-surface dark:bg-v-mid-dark">
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  {renderMarkdownPreview(editContent)}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
