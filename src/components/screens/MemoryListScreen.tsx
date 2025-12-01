import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { ClaudeMemory, AgentScope } from '../../types';
import { PlusIcon } from '../icons/PlusIcon';
import { SearchIcon } from '../icons/SearchIcon';
import { GlobeIcon } from '../icons/GlobeIcon';
import { FolderIcon } from '../icons/FolderIcon';
import { EditIcon } from '../icons/EditIcon';
import { StarIcon } from '../icons/StarIcon';
import { DocumentIcon } from '../icons/DocumentIcon';
import { ListIcon } from '../icons/ListIcon';
import { GridIcon } from '../icons/GridIcon';
import { LayersIcon } from '../icons/LayersIcon';
import { TerminalIcon } from '../icons/TerminalIcon';
import { SpinnerIcon } from '../icons/SpinnerIcon';
import { DeleteIcon } from '../icons/DeleteIcon';
import { DuplicateIcon } from '../icons/DuplicateIcon';
import { fuzzyMatch } from '../../utils/fuzzyMatch';
import { ConfirmDialog } from '../ConfirmDialog';
import { revealItemInDir } from '@tauri-apps/plugin-opener';
import { getStorageItem, setStorageItem } from '../../utils/storage';

type LayoutMode = 'table' | 'grid';
type Filter = 'All' | AgentScope;
type SortCriteria = 'name-asc' | 'name-desc' | 'scope';

const LAYOUT_STORAGE_KEY = 'vinsly-memory-list-layout';

// Action menu component for each row
interface ActionMenuProps {
  memory: ClaudeMemory;
  onEdit: (memory: ClaudeMemory) => void;
  onDelete: (memory: ClaudeMemory) => void;
  onClone?: (memory: ClaudeMemory) => void;
}

const ActionMenu: React.FC<ActionMenuProps> = ({ memory, onEdit, onDelete, onClone }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isRevealing, setIsRevealing] = useState(false);
  const [menuCoords, setMenuCoords] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setIsOpen(false);
      setMenuCoords(null);
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const menuHeight = 140;
    const menuWidth = 180;
    const spaceBelow = window.innerHeight - rect.bottom;
    const top = spaceBelow >= menuHeight ? rect.bottom + 4 : rect.top - menuHeight - 4;
    let left = rect.right - menuWidth;
    if (left < 8) left = 8;
    setMenuCoords({ top, left });
  }, [isOpen]);

  const handleAction = (action: () => void) => {
    action();
    setIsOpen(false);
  };

  const handleReveal = async () => {
    if (!memory.path || isRevealing) return;
    setIsRevealing(true);
    try {
      await revealItemInDir(memory.path);
    } catch (error) {
      console.error('Error revealing file:', error);
    } finally {
      setIsRevealing(false);
      setIsOpen(false);
    }
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-v-light-border dark:border-v-border text-v-light-text-secondary dark:text-v-text-secondary hover:bg-v-light-hover dark:hover:bg-v-light-dark transition-colors"
        aria-label="More actions"
      >
        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="5" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="12" cy="19" r="2" />
        </svg>
      </button>
      {isOpen && menuCoords && createPortal(
        <motion.div
          ref={menuRef}
          initial={{ opacity: 0, y: -10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.15 }}
          style={{ position: 'fixed', top: menuCoords.top, left: menuCoords.left, zIndex: 1000 }}
          className="w-48 bg-v-light-surface dark:bg-v-mid-dark border border-v-light-border dark:border-v-border rounded-lg shadow-lg overflow-hidden"
        >
          <button
            onClick={() => handleAction(() => onEdit(memory))}
            className="w-full px-4 py-2.5 text-left text-sm text-v-light-text-primary dark:text-v-text-primary hover:bg-v-light-hover dark:hover:bg-v-light-dark transition-colors flex items-center gap-3"
          >
            <EditIcon className="h-4 w-4" />
            <span>Edit</span>
          </button>
          {onClone && memory.scope === AgentScope.Project && (
            <button
              onClick={() => handleAction(() => onClone(memory))}
              className="w-full px-4 py-2.5 text-left text-sm text-v-light-text-primary dark:text-v-text-primary hover:bg-v-light-hover dark:hover:bg-v-light-dark transition-colors flex items-center gap-3"
            >
              <DuplicateIcon className="h-4 w-4" />
              <span>Clone to Project</span>
            </button>
          )}
          <button
            onClick={handleReveal}
            disabled={isRevealing}
            className="w-full px-4 py-2.5 text-left text-sm text-v-light-text-primary dark:text-v-text-primary hover:bg-v-light-hover dark:hover:bg-v-light-dark transition-colors flex items-center gap-3 disabled:opacity-60"
          >
            {isRevealing ? (
              <>
                <SpinnerIcon className="h-4 w-4" />
                <span>Opening…</span>
              </>
            ) : (
              <>
                <FolderIcon className="h-4 w-4" />
                <span>Reveal in Folder</span>
              </>
            )}
          </button>
          <div className="border-t border-v-light-border dark:border-v-border" />
          <button
            onClick={() => handleAction(() => onDelete(memory))}
            className="w-full px-4 py-2.5 text-left text-sm text-v-danger hover:bg-v-danger/10 transition-colors flex items-center gap-3"
          >
            <DeleteIcon className="h-4 w-4" />
            <span>Delete</span>
          </button>
        </motion.div>,
        document.body
      )}
    </div>
  );
};

// Extract display name from path (project folder name or "Global")
const getDisplayName = (memory: ClaudeMemory): string => {
  if (memory.scope === AgentScope.Global) {
    return 'Global Memory';
  }
  // Extract project folder name from path
  const parts = memory.path.split('/');
  const claudeIndex = parts.findIndex(p => p === '.claude' || p === 'CLAUDE.md');
  if (claudeIndex > 0) {
    return parts[claudeIndex - 1];
  }
  // Fallback: use the parent directory name
  return parts[parts.length - 2] || 'Project Memory';
};

interface MemoryListScreenProps {
  memories: ClaudeMemory[];
  isLoading: boolean;
  onEdit: (memory: ClaudeMemory) => void;
  onCreate: () => void;
  onDelete?: (memoryPath: string) => void;
  onBulkDelete?: (memoryPaths: string[]) => void;
  onClone?: (memory: ClaudeMemory) => void;
  onToggleFavorite: (memory: ClaudeMemory) => void;
  onImport?: () => void;
  onExport?: (memories: ClaudeMemory[]) => void;
  onShowSubagents: () => void;
  onShowSkills: () => void;
  onShowMemory: () => void;
  onShowCommands: () => void;
  activeView: 'subagents' | 'skills' | 'memory' | 'commands';
}

export const MemoryListScreen: React.FC<MemoryListScreenProps> = ({
  memories,
  isLoading,
  onEdit,
  onCreate,
  onDelete,
  onBulkDelete,
  onClone,
  onToggleFavorite,
  onImport,
  onExport,
  onShowSubagents,
  onShowSkills,
  onShowMemory,
  onShowCommands,
  activeView,
}) => {
  const [filter, setFilter] = useState<Filter>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortCriteria, setSortCriteria] = useState<SortCriteria>('name-asc');
  const [selectedMemoryPaths, setSelectedMemoryPaths] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<'single' | 'bulk'>('single');
  const [memoryToDelete, setMemoryToDelete] = useState<ClaudeMemory | null>(null);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('table');
  const [layoutLoaded, setLayoutLoaded] = useState(false);
  const selectAllRef = useRef<HTMLInputElement>(null);

  // Load layout preference from storage
  useEffect(() => {
    const loadLayout = async () => {
      const stored = await getStorageItem<LayoutMode>(LAYOUT_STORAGE_KEY);
      if (stored === 'grid' || stored === 'table') {
        setLayoutMode(stored);
      }
      setLayoutLoaded(true);
    };
    loadLayout();
  }, []);

  // Save layout preference to storage
  useEffect(() => {
    if (!layoutLoaded) return;
    setStorageItem(LAYOUT_STORAGE_KEY, layoutMode);
  }, [layoutMode, layoutLoaded]);

  // Clear selection when filter/search/layout changes
  useEffect(() => {
    setSelectedMemoryPaths(new Set());
  }, [searchQuery, filter, layoutMode]);

  const filteredMemories = useMemo(() => {
    let result = memories;

    // Filter by scope
    if (filter !== 'All') {
      result = result.filter(memory => memory.scope === filter);
    }

    // Filter by search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(memory => {
        const displayName = getDisplayName(memory);
        const searchText = `${displayName} ${memory.path} ${memory.content}`.toLowerCase();
        return fuzzyMatch(searchText, query);
      });
    }

    // Sort
    result = [...result].sort((a, b) => {
      const nameA = getDisplayName(a);
      const nameB = getDisplayName(b);
      switch (sortCriteria) {
        case 'name-asc':
          return nameA.localeCompare(nameB);
        case 'name-desc':
          return nameB.localeCompare(nameA);
        case 'scope':
          return a.scope.localeCompare(b.scope) || nameA.localeCompare(nameB);
        default:
          return 0;
      }
    });

    // Favorites first
    result = [...result].sort((a, b) => {
      if (a.isFavorite && !b.isFavorite) return -1;
      if (!a.isFavorite && b.isFavorite) return 1;
      return 0;
    });

    return result;
  }, [memories, filter, searchQuery, sortCriteria]);

  // Selection state
  const allFilteredSelected = filteredMemories.length > 0 && filteredMemories.every(m => selectedMemoryPaths.has(m.path));
  const someFilteredSelected = filteredMemories.some(m => selectedMemoryPaths.has(m.path));

  // Update indeterminate state of select-all checkbox
  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someFilteredSelected && !allFilteredSelected;
    }
  }, [someFilteredSelected, allFilteredSelected]);


  const handleSelectAll = () => {
    if (allFilteredSelected) {
      // Deselect all filtered
      const newSelection = new Set(selectedMemoryPaths);
      filteredMemories.forEach(m => newSelection.delete(m.path));
      setSelectedMemoryPaths(newSelection);
    } else {
      // Select all filtered
      const newSelection = new Set(selectedMemoryPaths);
      filteredMemories.forEach(m => newSelection.add(m.path));
      setSelectedMemoryPaths(newSelection);
    }
  };

  const handleSelectOne = (memoryPath: string) => {
    const newSelection = new Set(selectedMemoryPaths);
    if (newSelection.has(memoryPath)) {
      newSelection.delete(memoryPath);
    } else {
      newSelection.add(memoryPath);
    }
    setSelectedMemoryPaths(newSelection);
  };

  const handleDeleteClick = (memory: ClaudeMemory) => {
    setMemoryToDelete(memory);
    setDeleteTarget('single');
    setShowDeleteConfirm(true);
  };

  const handleBulkDeleteClick = () => {
    setDeleteTarget('bulk');
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = () => {
    if (deleteTarget === 'single' && memoryToDelete && onDelete) {
      onDelete(memoryToDelete.path);
    } else if (deleteTarget === 'bulk' && onBulkDelete) {
      onBulkDelete(Array.from(selectedMemoryPaths));
      setSelectedMemoryPaths(new Set());
    }
    setShowDeleteConfirm(false);
    setMemoryToDelete(null);
  };

  const viewSwitcherItems = [
    { key: 'subagents', label: 'Subagents', icon: <ListIcon className="h-4 w-4" />, action: onShowSubagents },
    { key: 'skills', label: 'Skills', icon: <LayersIcon className="h-4 w-4" />, action: onShowSkills },
    { key: 'memory', label: 'Memory', icon: <DocumentIcon className="h-4 w-4" />, action: onShowMemory },
    { key: 'commands', label: 'Commands', icon: <TerminalIcon className="h-4 w-4" />, action: onShowCommands },
  ];

  // Get content preview (first non-empty line that's not a heading)
  const getContentPreview = (content: string): string => {
    const lines = content.split('\n').filter(line => line.trim());
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('#') && trimmed.length > 0) {
        return trimmed.length > 80 ? trimmed.slice(0, 80) + '...' : trimmed;
      }
    }
    return 'Empty memory file';
  };

  // Get word count
  const getWordCount = (content: string): number => {
    return content.trim().split(/\s+/).filter(Boolean).length;
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Total memories', value: memories.length, icon: DocumentIcon },
          { label: 'Global memories', value: memories.filter(m => m.scope === AgentScope.Global).length, icon: GlobeIcon },
          { label: 'Project memories', value: memories.filter(m => m.scope === AgentScope.Project).length, icon: FolderIcon },
        ].map(stat => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="rounded-xl bg-v-light-surface dark:bg-v-mid-dark border border-v-light-border dark:border-v-border px-4 py-3.5 shadow-sm hover:shadow-md transition-all duration-200 flex items-center gap-3 group hover:border-v-accent/30 transform hover:-translate-y-0.5"
            >
              <div className="flex-shrink-0 p-2 rounded-lg bg-v-accent/10 group-hover:bg-v-accent/20 transition-colors">
                <Icon className="h-5 w-5 text-v-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-[0.2em] text-v-light-text-secondary dark:text-v-text-secondary font-medium">
                  {stat.label}
                </p>
                <p className="text-3xl font-bold text-v-light-text-primary dark:text-v-text-primary mt-0.5 tabular-nums">
                  {stat.value}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* View Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-stretch border border-v-light-border dark:border-v-border rounded-lg overflow-hidden bg-v-light-bg dark:bg-v-dark">
          {viewSwitcherItems.map((item, index, array) => (
            <React.Fragment key={item.key}>
              <button
                onClick={item.action}
                className={`px-3 py-2 text-sm font-medium transition-colors duration-200 flex items-center gap-1.5 ${
                  activeView === item.key
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
        <div className="flex items-center gap-1 border border-v-light-border dark:border-v-border rounded-lg overflow-hidden bg-v-light-bg dark:bg-v-dark text-sm font-medium">
          <button
            type="button"
            onClick={() => setLayoutMode('table')}
            className={`px-3 py-1.5 flex items-center gap-1 transition-colors ${
              layoutMode === 'table'
                ? 'bg-v-accent/10 text-v-accent'
                : 'text-v-light-text-secondary dark:text-v-text-secondary hover:text-v-light-text-primary dark:hover:text-v-text-primary'
            }`}
            aria-pressed={layoutMode === 'table'}
            title="Row layout"
          >
            <ListIcon className="h-4 w-4" />
            <span>Rows</span>
          </button>
          <button
            type="button"
            onClick={() => setLayoutMode('grid')}
            className={`px-3 py-1.5 flex items-center gap-1 transition-colors ${
              layoutMode === 'grid'
                ? 'bg-v-accent/10 text-v-accent'
                : 'text-v-light-text-secondary dark:text-v-text-secondary hover:text-v-light-text-primary dark:hover:text-v-text-primary'
            }`}
            aria-pressed={layoutMode === 'grid'}
            title="Card layout"
          >
            <GridIcon className="h-4 w-4" />
            <span>Cards</span>
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex-grow flex items-center gap-4">
          {/* Search */}
          <div className="relative flex-grow max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <SearchIcon className="h-4 w-4 text-v-light-text-secondary dark:text-v-text-secondary" />
            </div>
            <input
              type="text"
              placeholder="Search memories..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-v-light-surface dark:bg-v-mid-dark border border-v-light-border dark:border-v-border text-v-light-text-primary dark:text-v-text-primary focus:border-v-accent focus:ring-2 focus:ring-v-accent focus:ring-offset-1 focus:ring-offset-v-light-surface dark:focus:ring-offset-v-mid-dark focus-visible:outline-none text-sm rounded-md"
            />
          </div>

          {/* Scope filter */}
          <div className="flex items-center border border-v-light-border dark:border-v-border rounded-md overflow-hidden">
            {(['All', AgentScope.Global, AgentScope.Project] as const).map(scope => (
              <button
                key={scope}
                onClick={() => setFilter(scope)}
                className={`px-3 py-1.5 text-sm font-medium transition-colors duration-150 ${
                  filter === scope
                    ? 'bg-v-accent text-white'
                    : 'bg-v-light-hover dark:bg-v-light-dark text-v-light-text-secondary dark:text-v-text-secondary hover:bg-v-light-border dark:hover:bg-v-border hover:text-v-light-text-primary dark:hover:text-v-text-primary'
                }`}
              >
                {scope}
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {selectedMemoryPaths.size > 0 ? (
            <>
              <span className="text-sm font-semibold text-v-light-text-primary dark:text-v-text-primary">
                {selectedMemoryPaths.size} selected
              </span>
              {onExport && (
                <button
                  onClick={() => {
                    const selectedMemories = memories.filter(m => selectedMemoryPaths.has(m.path));
                    onExport(selectedMemories);
                  }}
                  className="inline-flex h-10 items-center gap-2 px-3 text-sm font-semibold bg-v-accent hover:bg-v-accent-hover text-white rounded-md shadow-sm hover:shadow-md active:scale-95 transition-transform"
                  title="Export selected"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  <span>Export Selected</span>
                </button>
              )}
              {onBulkDelete && (
                <button
                  onClick={handleBulkDeleteClick}
                  className="inline-flex h-10 items-center gap-2 px-3 text-sm font-semibold bg-v-danger hover:opacity-90 text-white rounded-md shadow-sm hover:shadow-md active:scale-95 transition-transform"
                  title="Delete selected"
                >
                  <DeleteIcon className="h-4 w-4" />
                  <span>Delete Selected</span>
                </button>
              )}
            </>
          ) : (
            <>
              {onImport && (
                <button
                  onClick={onImport}
                  className="inline-flex h-10 items-center gap-2 px-3 text-sm font-semibold text-v-light-text-primary dark:text-v-text-primary border border-v-light-border dark:border-v-border rounded-md hover:border-v-accent transition-colors"
                  title="Import memories"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  <span>Import</span>
                </button>
              )}
              {onExport && (
                <button
                  onClick={() => onExport(filteredMemories)}
                  disabled={filteredMemories.length === 0}
                  className="inline-flex h-10 items-center gap-2 px-3 text-sm font-semibold text-v-light-text-primary dark:text-v-text-primary border border-v-light-border dark:border-v-border rounded-md hover:border-v-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Export all"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  <span>Export All</span>
                </button>
              )}
              <button
               
                onClick={onCreate}
                className="inline-flex h-10 items-center gap-3 px-4 bg-v-accent text-white font-semibold text-sm transition-all duration-200 ease-out flex-shrink-0 rounded-md shadow-sm hover:shadow-lg transform hover:-translate-y-0.5 active:scale-95"
              >
                <PlusIcon className="h-4 w-4" />
                <span>New Memory</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Table/Grid */}
      <div className="bg-v-light-surface dark:bg-v-mid-dark border border-v-light-border dark:border-v-border rounded-lg overflow-hidden">
        {isLoading && memories.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <SpinnerIcon className="w-8 h-8 mb-4 animate-spin text-v-accent" />
            <p className="text-v-light-text-secondary dark:text-v-text-secondary">
              Scanning for memory files...
            </p>
          </div>
        ) : filteredMemories.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-v-light-text-secondary dark:text-v-text-secondary">
            <DocumentIcon className="w-12 h-12 mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2">No memory files found</p>
            <p className="text-sm mb-4">
              {searchQuery
                ? 'Try adjusting your search'
                : 'Create your first CLAUDE.md memory file'}
            </p>
            {!searchQuery && (
              <button
                onClick={onCreate}
                className="flex items-center gap-2 px-4 py-2 bg-v-accent text-white rounded-lg hover:bg-v-accent-dark transition-colors"
              >
                <PlusIcon className="w-4 h-4" />
                New Memory
              </button>
            )}
          </div>
        ) : layoutMode === 'grid' ? (
          /* Grid view */
          <div className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredMemories.map(memory => {
                const displayName = getDisplayName(memory);
                const wordCount = getWordCount(memory.content);
                const preview = getContentPreview(memory.content);
                const isSelected = selectedMemoryPaths.has(memory.path);
                const ScopeIcon = memory.scope === AgentScope.Project ? FolderIcon : GlobeIcon;

                return (
                  <div
                    key={memory.path}
                    className={`rounded-2xl border border-v-light-border/80 dark:border-v-border/70 bg-v-light-surface dark:bg-v-mid-dark/90 p-4 shadow-[0_6px_20px_rgba(15,23,42,0.08)] dark:shadow-[0_8px_24px_rgba(0,0,0,0.35)] hover:border-v-accent/60 transition-all duration-200 flex flex-col gap-3 ${
                      isSelected ? 'ring-2 ring-v-accent/30 bg-v-accent/5' : ''
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleSelectOne(memory.path)}
                        aria-label={`Select ${displayName}`}
                        className="h-4 w-4 bg-v-light-surface dark:bg-v-mid-dark border-v-light-border dark:border-v-border text-v-accent focus:ring-v-accent rounded mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="min-w-0 flex-1">
                            <p className="text-lg font-semibold text-v-light-text-primary dark:text-v-text-primary truncate" title={displayName}>
                              {displayName}
                            </p>
                            <p className="text-xs text-v-light-text-secondary dark:text-v-text-secondary">
                              {wordCount} words
                            </p>
                          </div>
                          <span
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold flex-shrink-0 ${
                              memory.scope === AgentScope.Project
                                ? 'bg-v-light-hover dark:bg-v-light-dark text-v-light-text-primary dark:text-v-text-primary'
                                : 'bg-v-accent/10 text-v-accent'
                            }`}
                          >
                            <ScopeIcon className="h-3.5 w-3.5" />
                            {memory.scope === AgentScope.Project ? 'Project' : 'Global'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-sm text-v-light-text-secondary dark:text-v-text-secondary line-clamp-2">
                      {preview}
                    </div>
                    <div className="flex items-center justify-between gap-3 pt-2 border-t border-dashed border-v-light-border/70 dark:border-v-border/70">
                      <button
                        onClick={() => onEdit(memory)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-v-light-border dark:border-v-border text-v-light-text-primary dark:text-v-text-primary hover:border-v-accent whitespace-nowrap"
                      >
                        <EditIcon className="h-3.5 w-3.5" />
                        Edit
                      </button>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onToggleFavorite(memory)}
                          className={`inline-flex items-center justify-center h-8 w-8 rounded-md border transition-colors ${
                            memory.isFavorite
                              ? 'border-v-accent text-v-accent bg-v-accent/10 hover:bg-v-accent/20'
                              : 'border-v-light-border dark:border-v-border text-v-light-text-secondary dark:text-v-text-secondary hover:border-v-accent hover:text-v-accent'
                          }`}
                          title={memory.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                        >
                          <StarIcon className="h-4 w-4" filled={memory.isFavorite} />
                        </button>
                        <ActionMenu
                          memory={memory}
                          onEdit={onEdit}
                          onClone={onClone}
                          onDelete={handleDeleteClick}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* Table view */
          <div className="divide-y divide-v-light-border dark:divide-v-border">
            {/* Table header */}
            <div
              className="grid gap-4 px-4 py-2 border-b border-v-light-border dark:border-v-border text-v-light-text-secondary dark:text-v-text-secondary text-xs uppercase font-bold tracking-wider items-center"
              style={{ gridTemplateColumns: '40px minmax(0,1.5fr) minmax(0,2fr) minmax(0,0.8fr) minmax(0,2fr) 92px' }}
            >
              <div className="flex items-center justify-center">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  checked={allFilteredSelected}
                  onChange={handleSelectAll}
                  className="h-4 w-4 rounded border-v-light-border dark:border-v-border text-v-accent focus:ring-v-accent focus:ring-offset-0 cursor-pointer"
                  aria-label="Select all memories"
                />
              </div>
              <span>Name</span>
              <span>Path</span>
              <span>Scope</span>
              <span>Preview</span>
              <div className="text-right">
                <label htmlFor="memory-sort" className="sr-only">Sort memories by</label>
                <div className="relative inline-flex items-center">
                  <select
                    id="memory-sort"
                    value={sortCriteria}
                    onChange={e => setSortCriteria(e.target.value as SortCriteria)}
                    className="appearance-none bg-transparent border-none text-v-light-text-secondary dark:text-v-text-secondary text-xs focus:ring-1 focus:ring-v-accent focus:outline-none pr-5 pl-1 py-1 cursor-pointer [&::-ms-expand]:hidden"
                    style={{
                      appearance: 'none',
                      WebkitAppearance: 'none',
                      MozAppearance: 'none',
                      backgroundImage: 'none'
                    }}
                  >
                    <option value="name-asc">Name (A-Z)</option>
                    <option value="name-desc">Name (Z-A)</option>
                    <option value="scope">Scope</option>
                  </select>
                  <svg className="h-3 w-3 text-v-light-text-secondary dark:text-v-text-secondary absolute right-0 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Table rows */}
            {filteredMemories.map(memory => {
              const displayName = getDisplayName(memory);
              const simplifiedPath = memory.path
                .replace(/^\/Users\/([^/]+)/, '~')
                .replace(/^C:\\Users\\([^\\]+)/, '~');
              const wordCount = getWordCount(memory.content);
              const preview = getContentPreview(memory.content);
              const isSelected = selectedMemoryPaths.has(memory.path);

              return (
                <div
                  key={memory.path}
                  className={`grid gap-4 px-4 py-3 items-center text-sm text-v-light-text-primary dark:text-v-text-primary hover:bg-v-light-hover/50 dark:hover:bg-v-light-dark/40 transition-colors group ${
                    isSelected ? 'bg-v-accent/5' : ''
                  }`}
                  style={{ gridTemplateColumns: '40px minmax(0,1.5fr) minmax(0,2fr) minmax(0,0.8fr) minmax(0,2fr) 92px' }}
                >
                  <div className="flex items-center justify-center">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleSelectOne(memory.path)}
                      className="h-4 w-4 rounded border-v-light-border dark:border-v-border text-v-accent focus:ring-v-accent focus:ring-offset-0 cursor-pointer"
                      aria-label={`Select ${displayName}`}
                    />
                  </div>
                  <div>
                    <div className="font-semibold truncate">{displayName}</div>
                    <div className="text-xs text-v-light-text-secondary dark:text-v-text-secondary">
                      {wordCount} words
                    </div>
                  </div>
                  <div className="relative group/path">
                    <span className="text-xs font-mono text-v-light-text-secondary dark:text-v-text-secondary truncate block">
                      {simplifiedPath}
                    </span>
                    <span className="pointer-events-none absolute -top-8 left-0 z-10 hidden group-hover/path:block bg-black text-white text-[11px] px-2 py-1 rounded shadow-lg whitespace-nowrap">
                      {memory.path}
                    </span>
                  </div>
                  <div>
                    <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                      memory.scope === AgentScope.Project
                        ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300'
                        : 'bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-300'
                    }`}>
                      {memory.scope}
                    </span>
                  </div>
                  <div className="text-v-light-text-secondary dark:text-v-text-secondary truncate text-xs">
                    {preview}
                  </div>
                  <div className="flex justify-end items-center gap-2">
                    <button
                      onClick={() => onToggleFavorite(memory)}
                      className={`inline-flex h-9 w-9 items-center justify-center rounded-md border transition-colors ${
                        memory.isFavorite
                          ? 'border-v-accent text-v-accent bg-v-accent/10 hover:bg-v-accent/20'
                          : 'border-v-light-border dark:border-v-border text-v-light-text-secondary dark:text-v-text-secondary hover:border-v-accent hover:text-v-accent'
                      }`}
                      title={memory.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                    >
                      <StarIcon className="h-4 w-4" filled={memory.isFavorite} />
                    </button>
                    <ActionMenu
                      memory={memory}
                      onEdit={onEdit}
                      onClone={onClone}
                      onDelete={handleDeleteClick}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title={deleteTarget === 'bulk' ? 'Delete Memories' : 'Delete Memory'}
        message={
          deleteTarget === 'bulk'
            ? `Are you sure you want to delete ${selectedMemoryPaths.size} memory file(s)? This action cannot be undone.`
            : `Are you sure you want to delete "${memoryToDelete ? getDisplayName(memoryToDelete) : ''}"? This action cannot be undone.`
        }
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setShowDeleteConfirm(false);
          setMemoryToDelete(null);
        }}
        variant="danger"
      />
    </div>
  );
};
