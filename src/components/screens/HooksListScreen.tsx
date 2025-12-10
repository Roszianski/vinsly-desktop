import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Hook, HookScope, getHookScopeDisplayName, getHookEventDisplayName } from '../../types/hooks';
import { listContainer } from '../../animations';
import { PlusIcon } from '../icons/PlusIcon';
import { SearchIcon } from '../icons/SearchIcon';
import { ListIcon } from '../icons/ListIcon';
import { GridIcon } from '../icons/GridIcon';
import { LayersIcon } from '../icons/LayersIcon';
import { DocumentIcon } from '../icons/DocumentIcon';
import { TerminalIcon } from '../icons/TerminalIcon';
import { DeleteIcon } from '../icons/DeleteIcon';
import { GlobeIcon } from '../icons/GlobeIcon';
import { FolderIcon } from '../icons/FolderIcon';
import { EditIcon } from '../icons/EditIcon';
import { StarIcon } from '../icons/StarIcon';
import { LightningIcon } from '../icons/LightningIcon';
import { ServerIcon } from '../icons/ServerIcon';
import { ConfirmDialog } from '../ConfirmDialog';
import { getStorageItem, setStorageItem } from '../../utils/storage';
import { fuzzyMatch } from '../../utils/fuzzyMatch';

type LayoutMode = 'table' | 'grid';
type Filter = 'All' | 'user' | 'project' | 'local';
type SortCriteria = 'name-asc' | 'name-desc' | 'type' | 'scope';

const LAYOUT_STORAGE_KEY = 'vinsly-list-layout';

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const highlightText = (text: string, term?: string) => {
  if (!term?.trim()) return text;
  const escaped = escapeRegExp(term.trim());
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

const getEventTypeColor = (type: string): string => {
  switch (type) {
    case 'PreToolUse':
      return 'bg-blue-500/20 text-blue-600 dark:text-blue-400';
    case 'PostToolUse':
      return 'bg-green-500/20 text-green-600 dark:text-green-400';
    case 'Notification':
      return 'bg-purple-500/20 text-purple-600 dark:text-purple-400';
    case 'Stop':
      return 'bg-orange-500/20 text-orange-600 dark:text-orange-400';
    case 'SubagentStop':
      return 'bg-red-500/20 text-red-600 dark:text-red-400';
    default:
      return 'bg-gray-500/20 text-gray-600 dark:text-gray-400';
  }
};

interface HooksListScreenProps {
  hooks: Hook[];
  onCreateHook: () => void;
  onEditHook: (hook: Hook) => void;
  onDeleteHook: (hook: Hook) => void;
  onShowSubagents: () => void;
  onShowSkills: () => void;
  onShowMemory: () => void;
  onShowCommands: () => void;
  onShowMCP: () => void;
  onShowHooks: () => void;
  activeView: string;
  onToggleFavorite: (hook: Hook) => void;
  shortcutHint?: string;
}

export const HooksListScreen: React.FC<HooksListScreenProps> = ({
  hooks,
  onCreateHook,
  onEditHook,
  onDeleteHook,
  onShowSubagents,
  onShowSkills,
  onShowMemory,
  onShowCommands,
  onShowMCP,
  onShowHooks,
  activeView,
  onToggleFavorite,
  shortcutHint,
}) => {
  const [filter, setFilter] = useState<Filter>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('table');
  const [layoutLoaded, setLayoutLoaded] = useState(false);
  const [selectedHookIds, setSelectedHookIds] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [hookToDelete, setHookToDelete] = useState<Hook | null>(null);
  const [sortCriteria, setSortCriteria] = useState<SortCriteria>('name-asc');
  const selectAllCheckboxRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    if (!layoutLoaded) return;
    setStorageItem(LAYOUT_STORAGE_KEY, layoutMode);
  }, [layoutMode, layoutLoaded]);

  useEffect(() => {
    setSelectedHookIds(new Set());
  }, [searchQuery, filter, layoutMode]);

  const { totalHooks, globalHooks, projectHooks } = useMemo(() => {
    const globalCount = hooks.filter(h => h.scope === 'user').length;
    const projectCount = hooks.filter(h => h.scope === 'project' || h.scope === 'local').length;
    return {
      totalHooks: hooks.length,
      globalHooks: globalCount,
      projectHooks: projectCount,
    };
  }, [hooks]);

  const filteredHooks = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const filtered = hooks.filter(hook => {
      const scopeMatch = filter === 'All' || hook.scope === filter;
      if (!scopeMatch) return false;

      if (!normalizedQuery) return true;

      return (
        fuzzyMatch(hook.name, normalizedQuery) ||
        hook.type.toLowerCase().includes(normalizedQuery) ||
        hook.command.toLowerCase().includes(normalizedQuery) ||
        (hook.matcher && hook.matcher.toLowerCase().includes(normalizedQuery))
      );
    });

    return filtered.sort((a, b) => {
      const favoriteDelta = Number(Boolean(b.isFavorite)) - Number(Boolean(a.isFavorite));
      if (favoriteDelta !== 0) return favoriteDelta;
      switch (sortCriteria) {
        case 'name-asc':
          return a.name.localeCompare(b.name);
        case 'name-desc':
          return b.name.localeCompare(a.name);
        case 'type':
          return a.type.localeCompare(b.type);
        case 'scope':
          return a.scope.localeCompare(b.scope);
        default:
          return 0;
      }
    });
  }, [hooks, filter, searchQuery, sortCriteria]);

  const areAllSelected = filteredHooks.length > 0 && selectedHookIds.size === filteredHooks.length;
  const isIndeterminate = selectedHookIds.size > 0 && !areAllSelected;

  useEffect(() => {
    if (selectAllCheckboxRef.current) {
      selectAllCheckboxRef.current.indeterminate = isIndeterminate;
    }
  }, [isIndeterminate]);

  const handleSelectHook = (hookId: string, isSelected: boolean) => {
    setSelectedHookIds(prev => {
      const next = new Set(prev);
      if (isSelected) {
        next.add(hookId);
      } else {
        next.delete(hookId);
      }
      return next;
    });
  };

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedHookIds(new Set(filteredHooks.map(h => h.id)));
    } else {
      setSelectedHookIds(new Set());
    }
  };

  const handleDeleteClick = (hook: Hook) => {
    setHookToDelete(hook);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    if (hookToDelete) {
      onDeleteHook(hookToDelete);
      setHookToDelete(null);
    }
    setShowDeleteConfirm(false);
  };

  const handleBulkDelete = () => {
    if (selectedHookIds.size === 0) return;
    setShowDeleteConfirm(true);
  };

  const confirmBulkDelete = () => {
    selectedHookIds.forEach(id => {
      const hook = hooks.find(h => h.id === id);
      if (hook) onDeleteHook(hook);
    });
    setSelectedHookIds(new Set());
    setShowDeleteConfirm(false);
  };

  const renderViewSwitcher = () => (
    <div className="flex items-stretch border border-v-light-border dark:border-v-border rounded-lg overflow-hidden bg-v-light-bg dark:bg-v-dark">
      {[
        { key: 'subagents', label: 'Subagents', icon: <ListIcon className="h-4 w-4" />, action: onShowSubagents },
        { key: 'skills', label: 'Skills', icon: <LayersIcon className="h-4 w-4" />, action: onShowSkills },
        { key: 'memory', label: 'Memory', icon: <DocumentIcon className="h-4 w-4" />, action: onShowMemory },
        { key: 'commands', label: 'Commands', icon: <TerminalIcon className="h-4 w-4" />, action: onShowCommands },
        { key: 'mcp', label: 'MCP', icon: <ServerIcon className="h-4 w-4" />, action: onShowMCP },
        { key: 'hooks', label: 'Hooks', icon: <LightningIcon className="h-4 w-4" />, action: onShowHooks },
      ].map((item, index, array) => (
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
  );

  const renderToolbar = () => (
    <div className="flex flex-wrap items-center justify-between gap-3">
      {selectedHookIds.size > 0 ? (
        <div className="flex-grow flex items-center gap-4">
          <span className="text-sm font-semibold text-v-light-text-primary dark:text-v-text-primary">
            {selectedHookIds.size} selected
          </span>
          <button
            onClick={handleBulkDelete}
            className="flex items-center gap-2 px-3 py-1.5 border border-v-light-border dark:border-v-border text-v-light-text-secondary dark:text-v-text-secondary hover:border-red-400 hover:text-red-500 font-semibold text-sm transition-colors duration-150 rounded-md"
          >
            <DeleteIcon className="h-4 w-4" />
            Delete Selected
          </button>
        </div>
      ) : (
        <>
          <div className="flex-grow flex items-center gap-4">
            <div className="relative flex-grow max-w-md">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <SearchIcon className="h-4 w-4 text-v-light-text-secondary dark:text-v-text-secondary" />
              </div>
              <input
                type="text"
                placeholder="Search hooks..."
                value={searchQuery}
                onChange={event => setSearchQuery(event.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-v-light-surface dark:bg-v-mid-dark border border-v-light-border dark:border-v-border text-v-light-text-primary dark:text-v-text-primary focus:border-v-accent focus:ring-2 focus:ring-v-accent focus:ring-offset-1 focus:ring-offset-v-light-surface dark:focus:ring-offset-v-mid-dark focus-visible:outline-none text-sm rounded-md"
              />
            </div>
            <div className="flex items-center border border-v-light-border dark:border-v-border rounded-md overflow-hidden">
              {(['All', 'user', 'project', 'local'] as Filter[]).map(value => (
                <button
                  key={value}
                  onClick={() => setFilter(value)}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors duration-150 ${
                    filter === value
                      ? 'bg-v-accent text-white'
                      : 'bg-v-light-hover dark:bg-v-light-dark text-v-light-text-secondary dark:text-v-text-secondary hover:text-v-light-text-primary dark:hover:text-v-text-primary'
                  }`}
                >
                  {value === 'All' ? 'All' : getHookScopeDisplayName(value as HookScope)}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onCreateHook}
              className="inline-flex h-10 items-center gap-3 px-4 bg-v-accent text-white font-semibold text-sm transition-all duration-200 ease-out flex-shrink-0 rounded-md shadow-sm hover:shadow-lg transform hover:-translate-y-0.5 active:scale-95"
            >
              <PlusIcon className="h-4 w-4" />
              <span>New Hook</span>
              {shortcutHint && (
                <span className="px-2 py-0.5 text-[10px] uppercase tracking-wide rounded bg-white/20 text-white">{shortcutHint}</span>
              )}
            </button>
          </div>
        </>
      )}
    </div>
  );

  const renderTable = () => (
    <div className="space-y-2">
      <div
        className="hidden md:grid gap-4 px-4 py-2 border-b border-v-light-border dark:border-v-border text-v-light-text-secondary dark:text-v-text-secondary text-[11px] uppercase font-bold tracking-[0.2em] items-center"
        style={{ gridTemplateColumns: '32px minmax(0,1.2fr) minmax(0,1fr) minmax(0,0.8fr) minmax(0,2fr) minmax(0,0.8fr)' }}
      >
        <div className="flex items-center justify-center">
          <input
            ref={selectAllCheckboxRef}
            type="checkbox"
            checked={areAllSelected}
            onChange={handleSelectAll}
            className="h-4 w-4 rounded border-v-light-border dark:border-v-border text-v-accent focus:ring-v-accent"
          />
        </div>
        <div>Name</div>
        <div>Event</div>
        <div>Matcher</div>
        <div>Command</div>
        <div className="text-right">
          <label htmlFor="hooks-sort" className="sr-only">Sort hooks by</label>
          <div className="relative inline-flex items-center">
            <select
              id="hooks-sort"
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
              <option value="type">Event Type</option>
              <option value="scope">Scope</option>
            </select>
            <svg className="h-3 w-3 text-v-light-text-secondary dark:text-v-text-secondary absolute right-0 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {filteredHooks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-v-light-text-secondary dark:text-v-text-secondary">
          <LightningIcon className="w-12 h-12 mb-4 opacity-50" />
          <p className="text-lg font-medium mb-2">No hooks found</p>
          <p className="text-sm mb-4">
            {searchQuery ? 'Try adjusting your search' : 'Create your first hook'}
          </p>
          {!searchQuery && (
            <button
              onClick={onCreateHook}
              className="flex items-center gap-2 px-4 py-2 bg-v-accent text-white rounded-lg hover:bg-v-accent-dark transition-colors"
            >
              <PlusIcon className="w-4 h-4" />
              New Hook
            </button>
          )}
        </div>
      ) : (
        <motion.div
          key={`hooks-table-${filter}`}
          variants={listContainer}
          initial="hidden"
          animate="visible"
        >
        {filteredHooks.map(hook => (
          <div
            key={hook.id}
            className="grid gap-4 px-4 py-3 items-center border-b border-v-light-border/50 dark:border-v-border/50 hover:bg-v-light-hover dark:hover:bg-v-light-dark/50 transition-colors group"
            style={{ gridTemplateColumns: '32px minmax(0,1.2fr) minmax(0,1fr) minmax(0,0.8fr) minmax(0,2fr) minmax(0,0.8fr)' }}
          >
            <div className="flex items-center justify-center">
              <input
                type="checkbox"
                checked={selectedHookIds.has(hook.id)}
                onChange={e => handleSelectHook(hook.id, e.target.checked)}
                className="h-4 w-4 rounded border-v-light-border dark:border-v-border text-v-accent focus:ring-v-accent"
              />
            </div>

            <div className="flex items-center gap-2 min-w-0">
              <button
                onClick={() => onToggleFavorite(hook)}
                className={`flex-shrink-0 p-1 rounded transition-colors ${
                  hook.isFavorite
                    ? 'text-yellow-500'
                    : 'text-v-light-text-secondary dark:text-v-text-secondary hover:text-yellow-500'
                }`}
              >
                <StarIcon className="h-4 w-4" filled={hook.isFavorite} />
              </button>
              <div className="relative group/name min-w-0">
                <span
                  className="font-medium text-v-light-text-primary dark:text-v-text-primary truncate cursor-pointer hover:text-v-accent block"
                  onClick={() => onEditHook(hook)}
                >
                  {highlightText(hook.name, searchQuery)}
                </span>
                <span className="pointer-events-none absolute -top-8 left-0 z-10 hidden group-hover/name:block bg-black text-white text-[11px] px-2 py-1 rounded shadow-lg whitespace-nowrap">
                  {hook.name}
                </span>
              </div>
            </div>

            <div>
              <span className={`px-2 py-0.5 text-xs font-medium rounded ${getEventTypeColor(hook.type)}`}>
                {getHookEventDisplayName(hook.type)}
              </span>
            </div>

            <div className="text-sm text-v-light-text-secondary dark:text-v-text-secondary truncate font-mono">
              {hook.matcher || '-'}
            </div>

            <div className="text-sm text-v-light-text-secondary dark:text-v-text-secondary truncate font-mono">
              {hook.command}
            </div>

            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => onEditHook(hook)}
                className="p-1.5 rounded hover:bg-v-light-surface dark:hover:bg-v-mid-dark text-v-light-text-secondary dark:text-v-text-secondary hover:text-v-accent transition-colors"
                title="Edit hook"
              >
                <EditIcon className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleDeleteClick(hook)}
                className="p-1.5 rounded hover:bg-v-light-surface dark:hover:bg-v-mid-dark text-v-light-text-secondary dark:text-v-text-secondary hover:text-v-danger transition-colors"
                title="Delete hook"
              >
                <DeleteIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
        </motion.div>
      )}
    </div>
  );

  const renderGrid = () => (
    <>
      {filteredHooks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-v-light-text-secondary dark:text-v-text-secondary">
          <LightningIcon className="w-12 h-12 mb-4 opacity-50" />
          <p className="text-lg font-medium mb-2">No hooks found</p>
          <p className="text-sm mb-4">
            {searchQuery ? 'Try adjusting your search' : 'Create your first hook'}
          </p>
          {!searchQuery && (
            <button
              onClick={onCreateHook}
              className="flex items-center gap-2 px-4 py-2 bg-v-accent text-white rounded-lg hover:bg-v-accent-dark transition-colors"
            >
              <PlusIcon className="w-4 h-4" />
              New Hook
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-v-light-border dark:border-v-border text-xs font-semibold uppercase tracking-wide text-v-light-text-secondary dark:text-v-text-secondary">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selectedHookIds.size === filteredHooks.length && filteredHooks.length > 0}
                onChange={e => {
                  if (e.target.checked) {
                    setSelectedHookIds(new Set(filteredHooks.map(h => h.id)));
                  } else {
                    setSelectedHookIds(new Set());
                  }
                }}
                disabled={filteredHooks.length === 0}
                aria-label="Select all hooks"
                className="h-4 w-4 bg-v-light-surface dark:bg-v-mid-dark border-v-light-border dark:border-v-border text-v-accent focus:ring-v-accent rounded"
              />
              <span>Select all</span>
            </div>
          </div>
          <motion.div
            key={`hooks-grid-${filter}`}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4"
            variants={listContainer}
            initial="hidden"
            animate="visible"
          >
            {filteredHooks.map(hook => (
            <div
              key={hook.id}
              className="p-4 rounded-2xl border border-v-light-border/80 dark:border-v-border/70 bg-v-light-surface dark:bg-v-mid-dark/90 shadow-[0_6px_20px_rgba(15,23,42,0.08)] dark:shadow-[0_8px_24px_rgba(0,0,0,0.35)] hover:border-v-accent/60 transition-all cursor-pointer group"
              onClick={() => onEditHook(hook)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="relative group/name flex items-center gap-2 min-w-0">
                  <LightningIcon className="h-5 w-5 text-v-accent flex-shrink-0" />
                  <span className="font-semibold text-v-light-text-primary dark:text-v-text-primary truncate">
                    {highlightText(hook.name, searchQuery)}
                  </span>
                  <span className="pointer-events-none absolute -top-8 left-0 z-10 hidden group-hover/name:block bg-black text-white text-[11px] px-2 py-1 rounded shadow-lg whitespace-nowrap">
                    {hook.name}
                  </span>
                </div>
                <button
                  onClick={e => {
                    e.stopPropagation();
                    onToggleFavorite(hook);
                  }}
                  className={`flex items-center justify-center h-8 w-8 rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-v-accent/50 focus:ring-offset-0 ${
                    hook.isFavorite
                      ? 'border-v-accent bg-v-accent/10 text-v-accent'
                      : 'border-transparent text-v-light-text-secondary dark:text-v-text-secondary hover:text-v-accent hover:border-v-accent/40'
                  }`}
                >
                  <StarIcon className="h-4 w-4" filled={hook.isFavorite} />
                </button>
              </div>

              <div className="flex items-center gap-2 mb-2">
                <span className={`px-2 py-0.5 text-xs font-medium rounded ${getEventTypeColor(hook.type)}`}>
                  {getHookEventDisplayName(hook.type)}
                </span>
                <span className="text-xs text-v-light-text-secondary dark:text-v-text-secondary flex items-center gap-1">
                  {hook.scope === 'user' ? (
                    <GlobeIcon className="h-3 w-3" />
                  ) : (
                    <FolderIcon className="h-3 w-3" />
                  )}
                  {getHookScopeDisplayName(hook.scope)}
                </span>
              </div>

              {hook.matcher && (
                <p className="text-xs text-v-light-text-secondary dark:text-v-text-secondary mb-1">
                  <span className="font-medium">Matcher:</span> <span className="font-mono">{hook.matcher}</span>
                </p>
              )}

              <p className="text-xs text-v-light-text-secondary dark:text-v-text-secondary truncate font-mono">
                {hook.command}
              </p>
            </div>
            ))}
          </motion.div>
        </>
      )}
    </>
  );

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="group rounded-xl bg-v-light-surface dark:bg-v-mid-dark border border-v-light-border dark:border-v-border px-4 py-3.5 shadow-sm hover:shadow-md transition-all duration-200 flex items-center gap-3 hover:border-v-accent/30 transform hover:-translate-y-0.5">
          <div className="flex-shrink-0 p-2 rounded-lg bg-v-accent/10 group-hover:bg-v-accent/20 transition-colors">
            <LightningIcon className="h-5 w-5 text-v-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-[0.2em] text-v-light-text-secondary dark:text-v-text-secondary/90 font-medium">Total Hooks</p>
            <p className="text-3xl font-bold text-v-light-text-primary dark:text-v-text-primary mt-0.5 tabular-nums">{totalHooks}</p>
          </div>
        </div>
        <div className="group rounded-xl bg-v-light-surface dark:bg-v-mid-dark border border-v-light-border dark:border-v-border px-4 py-3.5 shadow-sm hover:shadow-md transition-all duration-200 flex items-center gap-3 hover:border-v-accent/30 transform hover:-translate-y-0.5">
          <div className="flex-shrink-0 p-2 rounded-lg bg-v-accent/10 group-hover:bg-v-accent/20 transition-colors">
            <GlobeIcon className="h-5 w-5 text-v-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-[0.2em] text-v-light-text-secondary dark:text-v-text-secondary/90 font-medium">Global Hooks</p>
            <p className="text-3xl font-bold text-v-light-text-primary dark:text-v-text-primary mt-0.5 tabular-nums">{globalHooks}</p>
          </div>
        </div>
        <div className="group rounded-xl bg-v-light-surface dark:bg-v-mid-dark border border-v-light-border dark:border-v-border px-4 py-3.5 shadow-sm hover:shadow-md transition-all duration-200 flex items-center gap-3 hover:border-v-accent/30 transform hover:-translate-y-0.5">
          <div className="flex-shrink-0 p-2 rounded-lg bg-v-accent/10 group-hover:bg-v-accent/20 transition-colors">
            <FolderIcon className="h-5 w-5 text-v-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-[0.2em] text-v-light-text-secondary dark:text-v-text-secondary/90 font-medium">Project Hooks</p>
            <p className="text-3xl font-bold text-v-light-text-primary dark:text-v-text-primary mt-0.5 tabular-nums">{projectHooks}</p>
          </div>
        </div>
      </div>

      {/* View Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {renderViewSwitcher()}
        {layoutLoaded && (
          <div className="flex items-center border border-v-light-border dark:border-v-border rounded-md overflow-hidden">
            <button
              onClick={() => setLayoutMode('table')}
              className={`p-2 transition-colors ${
                layoutMode === 'table'
                  ? 'bg-v-accent text-white'
                  : 'bg-v-light-hover dark:bg-v-light-dark text-v-light-text-secondary dark:text-v-text-secondary hover:text-v-light-text-primary dark:hover:text-v-text-primary'
              }`}
              title="Row layout"
            >
              <ListIcon className="h-4 w-4" />
            </button>
            <button
              onClick={() => setLayoutMode('grid')}
              className={`p-2 transition-colors ${
                layoutMode === 'grid'
                  ? 'bg-v-accent text-white'
                  : 'bg-v-light-hover dark:bg-v-light-dark text-v-light-text-secondary dark:text-v-text-secondary hover:text-v-light-text-primary dark:hover:text-v-text-primary'
              }`}
              title="Card layout"
            >
              <GridIcon className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Toolbar */}
      {renderToolbar()}

      {/* Hooks List */}
      <div className="bg-v-light-surface dark:bg-v-mid-dark border border-v-light-border dark:border-v-border rounded-lg overflow-hidden">
        {layoutMode === 'table' ? renderTable() : renderGrid()}
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title={hookToDelete ? `Delete "${hookToDelete.name}"?` : `Delete ${selectedHookIds.size} hook(s)?`}
        message={
          hookToDelete
            ? 'This will remove the hook from your configuration. This action cannot be undone.'
            : `This will remove ${selectedHookIds.size} hook(s) from your configuration. This action cannot be undone.`
        }
        confirmText="Delete"
        onConfirm={hookToDelete ? confirmDelete : confirmBulkDelete}
        onCancel={() => {
          setShowDeleteConfirm(false);
          setHookToDelete(null);
        }}
        variant="danger"
      />
    </div>
  );
};
