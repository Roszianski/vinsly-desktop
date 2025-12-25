import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { MCPServer, MCPScope, getMCPScopeDisplayName } from '../../types/mcp';
import { listContainer } from '../../animations';
import { PlusIcon } from '../icons/PlusIcon';
import { SearchIcon } from '../icons/SearchIcon';
import { ListIcon } from '../icons/ListIcon';
import { GridIcon } from '../icons/GridIcon';
import { LayersIcon } from '../icons/LayersIcon';
import { DeleteIcon } from '../icons/DeleteIcon';
import { GlobeIcon } from '../icons/GlobeIcon';
import { FolderIcon } from '../icons/FolderIcon';
import { EditIcon } from '../icons/EditIcon';
import { StarIcon } from '../icons/StarIcon';
import { ServerIcon } from '../icons/ServerIcon';
import { RefreshIcon } from '../icons/RefreshIcon';
import { StatusIndicator } from '../icons/StatusIndicator';
import { LockIcon } from '../icons/LockIcon';
import { NavigationTabs, TabView } from '../NavigationTabs';
import { ConfirmDialog } from '../ConfirmDialog';
import { getStorageItem, setStorageItem } from '../../utils/storage';
import { fuzzyMatch } from '../../utils/fuzzyMatch';
import { useToast } from '../../contexts/ToastContext';
import { useMCPHealth } from '../../hooks/useMCPHealth';
import { useMCPAuth } from '../../hooks/useMCPAuth';

type LayoutMode = 'table' | 'grid';
type Filter = 'All' | 'user' | 'project';
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

const getTypeColor = (type: string): string => {
  switch (type) {
    case 'http':
      return 'bg-blue-500/20 text-blue-600 dark:text-blue-400';
    case 'stdio':
      return 'bg-green-500/20 text-green-600 dark:text-green-400';
    case 'sse':
      return 'bg-orange-500/20 text-orange-600 dark:text-orange-400';
    default:
      return 'bg-gray-500/20 text-gray-600 dark:text-gray-400';
  }
};

interface MCPListScreenProps {
  servers: MCPServer[];
  onCreateServer: () => void;
  onEditServer: (server: MCPServer) => void;
  onDeleteServer: (server: MCPServer) => void;
  onShowSubagents: () => void;
  onShowSkills: () => void;
  onShowMemory: () => void;
  onShowCommands: () => void;
  onShowMCP: () => void;
  onShowHooks: () => void;
  activeView: string;
  onToggleFavorite: (server: MCPServer) => void;
  shortcutHint?: string;
}

export const MCPListScreen: React.FC<MCPListScreenProps> = ({
  servers,
  onCreateServer,
  onEditServer,
  onDeleteServer,
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
  const { showToast } = useToast();
  const [filter, setFilter] = useState<Filter>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('table');
  const [layoutLoaded, setLayoutLoaded] = useState(false);
  const [selectedServerIds, setSelectedServerIds] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [serverToDelete, setServerToDelete] = useState<MCPServer | null>(null);
  const [sortCriteria, setSortCriteria] = useState<SortCriteria>('name-asc');
  const selectAllCheckboxRef = useRef<HTMLInputElement>(null);

  // Health monitoring for MCP servers
  const { getStatus, getHealthInfo, checkAllHealth, isChecking } = useMCPHealth({
    servers,
    enabled: true,
  });

  // Auth status for HTTP/SSE servers
  const { getAuthStatus } = useMCPAuth({
    servers,
    enabled: true,
  });

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
    setSelectedServerIds(new Set());
  }, [searchQuery, filter, layoutMode]);

  const { totalServers, userServers, projectServers } = useMemo(() => {
    const userCount = servers.filter(s => s.scope === 'user').length;
    const projectCount = servers.filter(s => s.scope === 'project').length;
    return {
      totalServers: servers.length,
      userServers: userCount,
      projectServers: projectCount,
    };
  }, [servers]);

  const filteredServers = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const filtered = servers.filter(server => {
      const scopeMatch = filter === 'All' || server.scope === filter;
      if (!scopeMatch) return false;

      if (!normalizedQuery) return true;

      return (
        fuzzyMatch(server.name, normalizedQuery) ||
        server.type.toLowerCase().includes(normalizedQuery) ||
        (server.url && server.url.toLowerCase().includes(normalizedQuery)) ||
        (server.command && server.command.toLowerCase().includes(normalizedQuery))
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
  }, [servers, filter, searchQuery, sortCriteria]);

  const areAllSelected = filteredServers.length > 0 && selectedServerIds.size === filteredServers.length;
  const isIndeterminate = selectedServerIds.size > 0 && !areAllSelected;

  useEffect(() => {
    if (selectAllCheckboxRef.current) {
      selectAllCheckboxRef.current.indeterminate = isIndeterminate;
    }
  }, [isIndeterminate]);

  const handleSelectServer = (serverId: string, isSelected: boolean) => {
    setSelectedServerIds(prev => {
      const next = new Set(prev);
      if (isSelected) {
        next.add(serverId);
      } else {
        next.delete(serverId);
      }
      return next;
    });
  };

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedServerIds(new Set(filteredServers.map(s => s.id)));
    } else {
      setSelectedServerIds(new Set());
    }
  };

  const handleDeleteClick = (server: MCPServer) => {
    setServerToDelete(server);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    if (serverToDelete) {
      onDeleteServer(serverToDelete);
      setServerToDelete(null);
    }
    setShowDeleteConfirm(false);
  };

  const handleBulkDelete = () => {
    if (selectedServerIds.size === 0) return;
    setShowDeleteConfirm(true);
  };

  const confirmBulkDelete = () => {
    selectedServerIds.forEach(id => {
      const server = servers.find(s => s.id === id);
      if (server) onDeleteServer(server);
    });
    setSelectedServerIds(new Set());
    setShowDeleteConfirm(false);
  };

  const handleNavigate = (view: TabView) => {
    const handlers: Record<TabView, () => void> = {
      subagents: onShowSubagents,
      skills: onShowSkills,
      memory: onShowMemory,
      commands: onShowCommands,
      mcp: onShowMCP,
      hooks: onShowHooks,
    };
    handlers[view]();
  };

  const renderViewSwitcher = () => (
    <NavigationTabs activeView={activeView} onNavigate={handleNavigate} />
  );

  const renderToolbar = () => (
    <div className="flex flex-wrap items-center justify-between gap-3">
      {selectedServerIds.size > 0 ? (
        <div className="flex-grow flex items-center gap-4">
          <span className="text-sm font-semibold text-v-light-text-primary dark:text-v-text-primary">
            {selectedServerIds.size} selected
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
                placeholder="Search MCP servers..."
                value={searchQuery}
                onChange={event => setSearchQuery(event.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-v-light-surface dark:bg-v-mid-dark border border-v-light-border dark:border-v-border text-v-light-text-primary dark:text-v-text-primary focus:border-v-accent focus:ring-2 focus:ring-v-accent focus:ring-offset-1 focus:ring-offset-v-light-surface dark:focus:ring-offset-v-mid-dark focus-visible:outline-none text-sm rounded-md"
              />
            </div>
            <div className="flex items-center border border-v-light-border dark:border-v-border rounded-md overflow-hidden">
              {(['All', 'user', 'project'] as Filter[]).map(value => (
                <button
                  key={value}
                  onClick={() => setFilter(value)}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors duration-150 ${
                    filter === value
                      ? 'bg-v-accent text-white'
                      : 'bg-v-light-hover dark:bg-v-light-dark text-v-light-text-secondary dark:text-v-text-secondary hover:text-v-light-text-primary dark:hover:text-v-text-primary'
                  }`}
                >
                  {value === 'All' ? 'All' : getMCPScopeDisplayName(value as MCPScope)}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void checkAllHealth()}
              disabled={isChecking}
              className={`inline-flex h-10 items-center gap-2 px-3 border border-v-light-border dark:border-v-border font-medium text-sm transition-colors duration-150 flex-shrink-0 rounded-md ${
                isChecking
                  ? 'bg-v-light-hover dark:bg-v-light-dark text-v-light-text-secondary dark:text-v-text-secondary cursor-not-allowed'
                  : 'bg-v-light-surface dark:bg-v-mid-dark text-v-light-text-primary dark:text-v-text-primary hover:border-v-accent hover:text-v-accent'
              }`}
              title="Refresh server status"
            >
              <RefreshIcon className={`h-4 w-4 ${isChecking ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh Status</span>
            </button>
            <button
              onClick={onCreateServer}
              className="inline-flex h-10 items-center gap-3 px-4 bg-v-accent text-white font-semibold text-sm transition-all duration-200 ease-out flex-shrink-0 rounded-md shadow-sm hover:shadow-lg transform hover:-translate-y-0.5 active:scale-95"
            >
              <PlusIcon className="h-4 w-4" />
              <span>New Server</span>
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
        style={{ gridTemplateColumns: '32px minmax(0,1.5fr) minmax(0,0.6fr) minmax(0,0.6fr) minmax(0,2fr) minmax(0,0.8fr) minmax(0,0.8fr)' }}
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
        <div>Type</div>
        <div>Status</div>
        <div>Endpoint</div>
        <div>Scope</div>
        <div className="text-right">
          <label htmlFor="mcp-sort" className="sr-only">Sort servers by</label>
          <div className="relative inline-flex items-center">
            <select
              id="mcp-sort"
              value={sortCriteria}
              onChange={e => setSortCriteria(e.target.value as SortCriteria)}
              className="appearance-none bg-transparent border-none text-v-light-text-secondary dark:text-v-text-secondary text-[11px] uppercase font-bold tracking-[0.2em] focus:ring-1 focus:ring-v-accent focus:outline-none pr-5 pl-1 py-1 cursor-pointer [&::-ms-expand]:hidden"
              style={{
                appearance: 'none',
                WebkitAppearance: 'none',
                MozAppearance: 'none',
                backgroundImage: 'none'
              }}
            >
              <option value="name-asc">Name (A-Z)</option>
              <option value="name-desc">Name (Z-A)</option>
              <option value="type">Type</option>
              <option value="scope">Scope</option>
            </select>
            <svg className="h-3 w-3 text-v-light-text-secondary dark:text-v-text-secondary absolute right-0 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {filteredServers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-v-light-text-secondary dark:text-v-text-secondary">
          <ServerIcon className="w-12 h-12 mb-4 opacity-50" />
          <p className="text-lg font-medium mb-2">No MCP servers found</p>
          <p className="text-sm mb-4">
            {searchQuery ? 'Try adjusting your search' : 'Configure your first MCP server'}
          </p>
          {!searchQuery && (
            <button
              onClick={onCreateServer}
              className="flex items-center gap-2 px-4 py-2 bg-v-accent text-white rounded-lg hover:bg-v-accent-dark transition-colors"
            >
              <PlusIcon className="w-4 h-4" />
              New Server
            </button>
          )}
        </div>
      ) : (
        <motion.div
          key={`mcp-table-${filter}`}
          variants={listContainer}
          initial="hidden"
          animate="visible"
        >
        {filteredServers.map(server => (
          <div
            key={server.id}
            className="grid gap-4 px-4 py-3 items-center border-b border-v-light-border/50 dark:border-v-border/50 hover:bg-v-light-hover dark:hover:bg-v-light-dark/50 transition-colors group"
            style={{ gridTemplateColumns: '32px minmax(0,1.5fr) minmax(0,0.6fr) minmax(0,0.6fr) minmax(0,2fr) minmax(0,0.8fr) minmax(0,0.8fr)' }}
          >
            <div className="flex items-center justify-center">
              <input
                type="checkbox"
                checked={selectedServerIds.has(server.id)}
                onChange={e => handleSelectServer(server.id, e.target.checked)}
                className="h-4 w-4 rounded border-v-light-border dark:border-v-border text-v-accent focus:ring-v-accent"
              />
            </div>

            <div className="flex items-center gap-2 min-w-0">
              <button
                onClick={() => onToggleFavorite(server)}
                className={`flex-shrink-0 p-1 rounded transition-colors ${
                  server.isFavorite
                    ? 'text-yellow-500'
                    : 'text-v-light-text-secondary dark:text-v-text-secondary hover:text-yellow-500'
                }`}
              >
                <StarIcon className="h-4 w-4" filled={server.isFavorite} />
              </button>
              <div className="relative group/name min-w-0">
                <span
                  className="font-medium text-v-light-text-primary dark:text-v-text-primary truncate cursor-pointer hover:text-v-accent block"
                  onClick={() => onEditServer(server)}
                >
                  {highlightText(server.name, searchQuery)}
                </span>
                <span className="pointer-events-none absolute -top-8 left-0 z-10 hidden group-hover/name:block bg-black text-white text-[11px] px-2 py-1 rounded shadow-lg whitespace-nowrap">
                  {server.name}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <span className={`px-2 py-0.5 text-xs font-medium rounded ${getTypeColor(server.type)}`}>
                {server.type.toUpperCase()}
              </span>
              {(server.type === 'http' || server.type === 'sse') && getAuthStatus(server.id) !== 'none' && (
                <span
                  className={`inline-flex items-center px-1.5 py-0.5 text-xs rounded ${
                    getAuthStatus(server.id) === 'authenticated'
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                      : getAuthStatus(server.id) === 'expired'
                      ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400'
                      : getAuthStatus(server.id) === 'error'
                      ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                      : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                  }`}
                  title={`Auth: ${getAuthStatus(server.id)}`}
                >
                  <LockIcon className="h-3 w-3" unlocked={getAuthStatus(server.id) !== 'authenticated'} />
                </span>
              )}
            </div>

            <div className="flex items-center" title={getHealthInfo(server.id)?.errorMessage}>
              <StatusIndicator status={getStatus(server.id)} size="md" showLabel />
            </div>

            <div className="text-sm text-v-light-text-secondary dark:text-v-text-secondary truncate font-mono">
              {server.type === 'stdio' ? server.command : server.url || '-'}
            </div>

            <div className="flex items-center gap-1">
              {server.scope === 'user' ? (
                <GlobeIcon className="h-4 w-4 text-v-light-text-secondary dark:text-v-text-secondary" />
              ) : (
                <FolderIcon className="h-4 w-4 text-v-light-text-secondary dark:text-v-text-secondary" />
              )}
              <span className="text-sm text-v-light-text-secondary dark:text-v-text-secondary">
                {getMCPScopeDisplayName(server.scope)}
              </span>
            </div>

            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => onEditServer(server)}
                className="p-1.5 rounded hover:bg-v-light-surface dark:hover:bg-v-mid-dark text-v-light-text-secondary dark:text-v-text-secondary hover:text-v-accent transition-colors"
                title="Edit server"
              >
                <EditIcon className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleDeleteClick(server)}
                className="p-1.5 rounded hover:bg-v-light-surface dark:hover:bg-v-mid-dark text-v-light-text-secondary dark:text-v-text-secondary hover:text-v-danger transition-colors"
                title="Delete server"
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
      {filteredServers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-v-light-text-secondary dark:text-v-text-secondary">
          <ServerIcon className="w-12 h-12 mb-4 opacity-50" />
          <p className="text-lg font-medium mb-2">No MCP servers found</p>
          <p className="text-sm mb-4">
            {searchQuery ? 'Try adjusting your search' : 'Configure your first MCP server'}
          </p>
          {!searchQuery && (
            <button
              onClick={onCreateServer}
              className="flex items-center gap-2 px-4 py-2 bg-v-accent text-white rounded-lg hover:bg-v-accent-dark transition-colors"
            >
              <PlusIcon className="w-4 h-4" />
              New Server
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-v-light-border dark:border-v-border text-xs font-semibold uppercase tracking-wide text-v-light-text-secondary dark:text-v-text-secondary">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selectedServerIds.size === filteredServers.length && filteredServers.length > 0}
                onChange={e => {
                  if (e.target.checked) {
                    setSelectedServerIds(new Set(filteredServers.map(s => s.id)));
                  } else {
                    setSelectedServerIds(new Set());
                  }
                }}
                disabled={filteredServers.length === 0}
                aria-label="Select all servers"
                className="h-4 w-4 bg-v-light-surface dark:bg-v-mid-dark border-v-light-border dark:border-v-border text-v-accent focus:ring-v-accent rounded"
              />
              <span>Select all</span>
            </div>
          </div>
          <motion.div
            key={`mcp-grid-${filter}`}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4"
            variants={listContainer}
            initial="hidden"
            animate="visible"
          >
            {filteredServers.map(server => (
            <div
              key={server.id}
              className="p-4 rounded-2xl border border-v-light-border/80 dark:border-v-border/70 bg-v-light-surface dark:bg-v-mid-dark/90 shadow-[0_6px_20px_rgba(15,23,42,0.08)] dark:shadow-[0_8px_24px_rgba(0,0,0,0.35)] hover:border-v-accent/60 transition-all cursor-pointer group"
              onClick={() => onEditServer(server)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="relative group/name flex items-center gap-2 min-w-0">
                  <ServerIcon className="h-5 w-5 text-v-accent flex-shrink-0" />
                  <span className="font-semibold text-v-light-text-primary dark:text-v-text-primary truncate">
                    {highlightText(server.name, searchQuery)}
                  </span>
                  <span className="pointer-events-none absolute -top-8 left-0 z-10 hidden group-hover/name:block bg-black text-white text-[11px] px-2 py-1 rounded shadow-lg whitespace-nowrap">
                    {server.name}
                  </span>
                </div>
                <button
                  onClick={e => {
                    e.stopPropagation();
                    onToggleFavorite(server);
                  }}
                  className={`flex items-center justify-center h-8 w-8 rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-v-accent/50 focus:ring-offset-0 ${
                    server.isFavorite
                      ? 'border-v-accent bg-v-accent/10 text-v-accent'
                      : 'border-transparent text-v-light-text-secondary dark:text-v-text-secondary hover:text-v-accent hover:border-v-accent/40'
                  }`}
                >
                  <StarIcon className="h-4 w-4" filled={server.isFavorite} />
                </button>
              </div>

              <div className="flex items-center gap-2 mb-2">
                <span className={`px-2 py-0.5 text-xs font-medium rounded ${getTypeColor(server.type)}`}>
                  {server.type.toUpperCase()}
                </span>
                {(server.type === 'http' || server.type === 'sse') && getAuthStatus(server.id) !== 'none' && (
                  <span
                    className={`inline-flex items-center px-1.5 py-0.5 text-xs rounded ${
                      getAuthStatus(server.id) === 'authenticated'
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                        : getAuthStatus(server.id) === 'expired'
                        ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400'
                        : getAuthStatus(server.id) === 'error'
                        ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                        : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                    }`}
                    title={`Auth: ${getAuthStatus(server.id)}`}
                  >
                    <LockIcon className="h-3 w-3" unlocked={getAuthStatus(server.id) !== 'authenticated'} />
                  </span>
                )}
                <span className="text-xs text-v-light-text-secondary dark:text-v-text-secondary flex items-center gap-1">
                  {server.scope === 'user' ? (
                    <GlobeIcon className="h-3 w-3" />
                  ) : (
                    <FolderIcon className="h-3 w-3" />
                  )}
                  {getMCPScopeDisplayName(server.scope)}
                </span>
                <StatusIndicator status={getStatus(server.id)} size="sm" />
              </div>

              <p className="text-xs text-v-light-text-secondary dark:text-v-text-secondary truncate font-mono">
                {server.type === 'stdio' ? server.command : server.url || '-'}
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
            <ServerIcon className="h-5 w-5 text-v-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-[0.2em] text-v-light-text-secondary dark:text-v-text-secondary/90 font-medium">Total Servers</p>
            <p className="text-3xl font-bold text-v-light-text-primary dark:text-v-text-primary mt-0.5 tabular-nums">{totalServers}</p>
          </div>
        </div>
        <div className="group rounded-xl bg-v-light-surface dark:bg-v-mid-dark border border-v-light-border dark:border-v-border px-4 py-3.5 shadow-sm hover:shadow-md transition-all duration-200 flex items-center gap-3 hover:border-v-accent/30 transform hover:-translate-y-0.5">
          <div className="flex-shrink-0 p-2 rounded-lg bg-v-accent/10 group-hover:bg-v-accent/20 transition-colors">
            <GlobeIcon className="h-5 w-5 text-v-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-[0.2em] text-v-light-text-secondary dark:text-v-text-secondary/90 font-medium">User (Global)</p>
            <p className="text-3xl font-bold text-v-light-text-primary dark:text-v-text-primary mt-0.5 tabular-nums">{userServers}</p>
          </div>
        </div>
        <div className="group rounded-xl bg-v-light-surface dark:bg-v-mid-dark border border-v-light-border dark:border-v-border px-4 py-3.5 shadow-sm hover:shadow-md transition-all duration-200 flex items-center gap-3 hover:border-v-accent/30 transform hover:-translate-y-0.5">
          <div className="flex-shrink-0 p-2 rounded-lg bg-v-accent/10 group-hover:bg-v-accent/20 transition-colors">
            <FolderIcon className="h-5 w-5 text-v-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-[0.2em] text-v-light-text-secondary dark:text-v-text-secondary/90 font-medium">Project</p>
            <p className="text-3xl font-bold text-v-light-text-primary dark:text-v-text-primary mt-0.5 tabular-nums">{projectServers}</p>
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

      {/* Server List */}
      <div className="bg-v-light-surface dark:bg-v-mid-dark border border-v-light-border dark:border-v-border rounded-lg overflow-hidden">
        {layoutMode === 'table' ? renderTable() : renderGrid()}
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title={serverToDelete ? `Delete "${serverToDelete.name}"?` : `Delete ${selectedServerIds.size} server(s)?`}
        message={
          serverToDelete
            ? 'This will remove the MCP server from your configuration. This action cannot be undone.'
            : `This will remove ${selectedServerIds.size} MCP server(s) from your configuration. This action cannot be undone.`
        }
        confirmText="Delete"
        onConfirm={serverToDelete ? confirmDelete : confirmBulkDelete}
        onCancel={() => {
          setShowDeleteConfirm(false);
          setServerToDelete(null);
        }}
        variant="danger"
      />
    </div>
  );
};
