import React, { useState, useEffect, useCallback, useRef } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { AgentScope, ClaudeMemory } from '../../types';
import { GlobeIcon } from '../icons/GlobeIcon';
import { FolderIcon } from '../icons/FolderIcon';
import { SpinnerIcon } from '../icons/SpinnerIcon';
import { DocumentIcon } from '../icons/DocumentIcon';
import { devLog } from '../../utils/devLogger';

interface MemoryScreenProps {
  globalMemory: ClaudeMemory | null;
  projectMemory: ClaudeMemory | null;
  isLoading: boolean;
  activeScope: AgentScope;
  onScopeChange: (scope: AgentScope) => void;
  onSave: (scope: AgentScope, content: string, projectPath?: string) => Promise<void>;
  onCancel: () => void;
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
  onCancel,
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

  const handleProjectFolderPick = async (event?: React.MouseEvent) => {
    event?.stopPropagation();
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
      devLog.error('Failed to select project folder:', error);
    } finally {
      setIsPickingProjectFolder(false);
    }
  };

  const handleScopeSelect = (scope: AgentScope) => {
    if (scope === AgentScope.Project && !projectFolderPath) {
      handleProjectFolderPick();
    } else {
      onScopeChange(scope);
    }
  };

  const wordCount = editContent.trim().split(/\s+/).filter(Boolean).length;
  const charCount = editContent.length;

  return (
    <div className="space-y-4">
      {/* Header with back button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onCancel}
            className="p-2 rounded-lg hover:bg-v-light-hover dark:hover:bg-v-light-dark text-v-light-text-secondary dark:text-v-text-secondary hover:text-v-light-text-primary dark:hover:text-v-text-primary transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
            </svg>
          </button>
          <div className="flex items-center gap-3">
            <DocumentIcon className="w-5 h-5 text-v-accent" />
            <h1 className="text-lg font-semibold text-v-light-text-primary dark:text-v-text-primary">
              CLAUDE.md
            </h1>
          </div>
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

      {/* Scope Selection */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => handleScopeSelect(AgentScope.Global)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeScope === AgentScope.Global
              ? 'bg-v-accent/10 text-v-accent border border-v-accent/30'
              : 'bg-v-light-surface dark:bg-v-mid-dark border border-v-light-border dark:border-v-border text-v-light-text-secondary dark:text-v-text-secondary hover:border-v-accent/50'
          }`}
        >
          <GlobeIcon className="w-4 h-4" />
          Global
        </button>
        <button
          onClick={() => handleScopeSelect(AgentScope.Project)}
          disabled={isPickingProjectFolder}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeScope === AgentScope.Project
              ? 'bg-v-accent/10 text-v-accent border border-v-accent/30'
              : 'bg-v-light-surface dark:bg-v-mid-dark border border-v-light-border dark:border-v-border text-v-light-text-secondary dark:text-v-text-secondary hover:border-v-accent/50'
          }`}
        >
          {isPickingProjectFolder ? (
            <SpinnerIcon className="w-4 h-4 animate-spin" />
          ) : (
            <FolderIcon className="w-4 h-4" />
          )}
          {projectFolderPath ? projectFolderPath.replace(/\\/g, '/').split('/').slice(-2).join('/') : 'Choose Project...'}
        </button>
        {activeScope === AgentScope.Project && projectFolderPath && (
          <button
            onClick={handleProjectFolderPick}
            disabled={isPickingProjectFolder}
            className="p-2 rounded-lg hover:bg-v-light-hover dark:hover:bg-v-light-dark text-v-light-text-secondary dark:text-v-text-secondary"
            title="Change project folder"
          >
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H3.989a.75.75 0 00-.75.75v4.242a.75.75 0 001.5 0v-2.43l.31.31a7 7 0 0011.712-3.138.75.75 0 00-1.449-.39zm1.23-3.723a.75.75 0 00.219-.53V2.929a.75.75 0 00-1.5 0V5.36l-.31-.31A7 7 0 003.239 8.188a.75.75 0 101.448.389A5.5 5.5 0 0113.89 6.11l.311.31h-2.432a.75.75 0 000 1.5h4.243a.75.75 0 00.53-.219z" />
            </svg>
          </button>
        )}
      </div>

      {/* Editor and Preview */}
      <div className="bg-v-light-surface dark:bg-v-mid-dark border border-v-light-border dark:border-v-border rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <SpinnerIcon className="w-8 h-8 animate-spin text-v-accent" />
          </div>
        ) : (
          <div className="flex min-h-[450px]">
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
