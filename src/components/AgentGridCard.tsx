import React, { useState } from 'react';
import { Agent, AgentScope } from '../types';
import { EditIcon } from './icons/EditIcon';
import { DuplicateIcon } from './icons/DuplicateIcon';
import { DeleteIcon } from './icons/DeleteIcon';
import { StarIcon } from './icons/StarIcon';
import { GlobeIcon } from './icons/GlobeIcon';
import { FolderIcon } from './icons/FolderIcon';
import { ConfirmDialog } from './ConfirmDialog';
import { useToast } from '../contexts/ToastContext';
import { revealItemInDir } from '@tauri-apps/plugin-opener';
import { resolveAgentPath } from '../utils/pathHelpers';
import { SpinnerIcon } from './icons/SpinnerIcon';
import { getToolsState } from '../utils/toolHelpers';

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

interface AgentGridCardProps {
  agent: Agent;
  onEdit: (agent: Agent) => void;
  onDuplicate: (agent: Agent) => void;
  onDelete: (agentId: string) => void;
  onSelect: (agentId: string, isSelected: boolean) => void;
  onToggleFavorite: (agent: Agent) => void;
  isSelected: boolean;
  highlightTerm?: string;
}

const colorMap: { [key: string]: string } = {
  red: 'bg-red-500',
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  yellow: 'bg-yellow-500',
  purple: 'bg-purple-500',
  orange: 'bg-orange-500',
  pink: 'bg-pink-500',
  cyan: 'bg-cyan-500',
};

export const AgentGridCard: React.FC<AgentGridCardProps> = ({
  agent,
  onEdit,
  onDuplicate,
  onDelete,
  onSelect,
  onToggleFavorite,
  isSelected,
  highlightTerm
}) => {
  const { showToast } = useToast();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isRevealing, setIsRevealing] = useState(false);
  const isFavorite = Boolean(agent.isFavorite);
  const toolsState = getToolsState(agent.frontmatter.tools);
  const parsedTools = toolsState.inheritsAll ? [] : toolsState.list;
  const toolsSummary = toolsState.inheritsAll
    ? 'All session tools'
    : toolsState.explicitNone
      ? 'No tools'
      : `${parsedTools.length} tool${parsedTools.length === 1 ? '' : 's'}`;

  const colorIndicatorClass = agent.frontmatter.color
    ? colorMap[agent.frontmatter.color] || 'bg-v-accent'
    : 'bg-black dark:bg-white border border-v-light-border dark:border-v-border';

  const highlightText = (text: string) => {
    if (!highlightTerm?.trim()) return text;
    const escaped = escapeRegExp(highlightTerm.trim());
    if (!escaped) return text;
    const regex = new RegExp(`(${escaped})`, 'gi');
    const parts = text.split(regex);
    if (parts.length <= 1) return text;
    return parts.map((part, index) =>
      index % 2 === 1 ? (
        <mark
          key={`${part}-${index}`}
          className="bg-yellow-200 dark:bg-yellow-700 text-v-dark dark:text-white rounded px-0.5"
        >
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  const handleDelete = () => {
    if (!agent.id) return;
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    if (agent.id) {
      onDelete(agent.id);
    }
    setShowDeleteConfirm(false);
  };

  const handleSelectChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (agent.id) {
      onSelect(agent.id, e.target.checked);
    }
  };

  const handleReveal = async () => {
    if (isRevealing) return;
    setIsRevealing(true);
    try {
      const resolvedPath = await resolveAgentPath(agent.path);
      if (!resolvedPath) {
        showToast('error', 'Unable to locate this agent on disk yet.');
        return;
      }
      await revealItemInDir(resolvedPath);
    } catch (error) {
      console.error('Error revealing file:', error);
      showToast('error', 'Failed to reveal the agent in your file manager.');
    } finally {
      setIsRevealing(false);
    }
  };

  const ScopeIcon = agent.scope === AgentScope.Global ? GlobeIcon : FolderIcon;

  return (
    <div
      className={`relative rounded-2xl border border-v-light-border/80 dark:border-v-border/70 bg-v-light-surface dark:bg-v-mid-dark/90 p-4 shadow-[0_6px_20px_rgba(15,23,42,0.08)] dark:shadow-[0_8px_24px_rgba(0,0,0,0.35)] hover:border-v-accent/60 transition-all duration-200 ${
        isSelected ? 'ring-2 ring-v-accent' : ''
      }`}
     
    >
      <div className="flex items-start justify-between gap-3">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 text-v-accent bg-v-light-surface dark:bg-v-mid-dark border-v-light-border dark:border-v-border rounded focus:ring-v-accent"
            checked={isSelected}
            onChange={handleSelectChange}
            disabled={!agent.id}
            aria-label={`Select agent ${agent.name}`}
          />
          <div>
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${colorIndicatorClass}`} aria-hidden="true"></span>
              <h3 className="text-sm font-semibold text-v-light-text-primary dark:text-v-text-primary break-words">
                {highlightText(agent.frontmatter.name || agent.name)}
              </h3>
            </div>
            <div className="flex items-center gap-2 text-xs text-v-light-text-secondary dark:text-v-text-secondary mt-1">
              <ScopeIcon className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{agent.scope}</span>
              <span className="h-1 w-1 rounded-full bg-v-light-border dark:bg-v-border"></span>
              <span className="font-mono">{agent.frontmatter.model || 'default'}</span>
            </div>
          </div>
        </label>
        <button
          type="button"
          onClick={() => onToggleFavorite(agent)}
          className={`p-2 rounded-full border transition-colors ${
            isFavorite
              ? 'border-v-accent bg-v-accent/10 text-v-accent'
              : 'border-transparent text-v-light-text-secondary dark:text-v-text-secondary hover:text-v-accent hover:border-v-accent/40'
          }`}
          aria-label={isFavorite ? 'Remove from favorites' : 'Mark as favorite'}
        >
          <StarIcon className="h-4 w-4" filled={isFavorite} />
        </button>
      </div>

      <p className="mt-2 text-sm text-v-light-text-secondary dark:text-v-text-secondary leading-relaxed line-clamp-3">
        {highlightText(agent.frontmatter.description || 'No description provided')}
      </p>

      <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] text-v-light-text-secondary dark:text-v-text-secondary">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-v-light-border dark:border-v-border">
          <span className="h-1.5 w-1.5 rounded-full bg-v-accent"></span>
          {toolsSummary}
        </span>
        {parsedTools.slice(0, 3).map(tool => (
          <span key={tool} className="px-2 py-0.5 rounded-full bg-v-light-hover/80 dark:bg-v-light-dark text-v-light-text-primary dark:text-v-text-primary">
            {tool}
          </span>
        ))}
        {parsedTools.length > 3 && (
          <span className="px-2 py-0.5 rounded-full bg-v-light-hover dark:bg-v-light-dark text-v-light-text-secondary dark:text-v-text-secondary">
            +{parsedTools.length - 3} more
          </span>
        )}
      </div>

      <div className="mt-3 text-[11px] text-v-light-text-secondary dark:text-v-text-secondary font-mono truncate" title={agent.path || 'Path pending save'}>
        {agent.path || 'Path pending save'}
      </div>

      <div className="mt-4 pt-3 border-t border-dashed border-v-light-border/80 dark:border-v-border flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-v-light-text-secondary dark:text-v-text-secondary whitespace-nowrap">
          {agent.body.length.toLocaleString()} chars prompt
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 min-w-[220px]">
          <button
            type="button"
            onClick={() => onEdit(agent)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-v-light-border dark:border-v-border text-v-light-text-primary dark:text-v-text-primary hover:border-v-accent whitespace-nowrap"
          >
            <EditIcon className="h-3.5 w-3.5" />
            Edit
          </button>
          <button
            type="button"
            onClick={() => onDuplicate(agent)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-v-light-border dark:border-v-border text-v-light-text-secondary dark:text-v-text-secondary hover:border-v-accent/60 whitespace-nowrap"
          >
            <DuplicateIcon className="h-3.5 w-3.5" />
            Clone
          </button>
          <button
            type="button"
            onClick={handleReveal}
            disabled={isRevealing}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border whitespace-nowrap ${
              isRevealing
                ? 'border-v-light-border dark:border-v-border text-v-light-text-secondary dark:text-v-text-secondary cursor-wait'
                : 'border-v-light-border dark:border-v-border text-v-light-text-secondary dark:text-v-text-secondary hover:border-v-accent/60'
            }`}
          >
            {isRevealing ? (
              <>
                <SpinnerIcon className="h-3.5 w-3.5 text-v-light-text-secondary dark:text-v-text-secondary" />
                Opening…
              </>
            ) : (
              <>
                <FolderIcon className="h-3.5 w-3.5" />
                Reveal
              </>
            )}
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-transparent text-red-500 hover:text-red-600 hover:bg-red-500/10 flex-shrink-0"
            aria-label={`Delete agent ${agent.name}`}
          >
            <DeleteIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Delete Agent"
        message={`Are you sure you want to delete agent "${agent.name}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDelete}
        onCancel={() => setShowDeleteConfirm(false)}
        variant="danger"
      />
    </div>
  );
};
