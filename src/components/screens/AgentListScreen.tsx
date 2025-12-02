import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Agent, AgentScope } from '../../types';
import { AgentListItem } from '../AgentListItem';
import { AgentGridCard } from '../AgentGridCard';
import { PlusIcon } from '../icons/PlusIcon';
import { SearchIcon } from '../icons/SearchIcon';
import { DeleteIcon } from '../icons/DeleteIcon';
import { LayersIcon } from '../icons/LayersIcon';
import { FolderIcon } from '../icons/FolderIcon';
import { NetworkIcon } from '../icons/NetworkIcon';
import { DownloadIcon } from '../icons/DownloadIcon';
import { UploadIcon } from '../icons/UploadIcon';
import { ListIcon } from '../icons/ListIcon';
import { GridIcon } from '../icons/GridIcon';
import { GlobeIcon } from '../icons/GlobeIcon';
import { ChartIcon } from '../icons/ChartIcon';
import { SpinnerIcon } from '../icons/SpinnerIcon';
import { DocumentIcon } from '../icons/DocumentIcon';
import { TerminalIcon } from '../icons/TerminalIcon';
import { ServerIcon } from '../icons/ServerIcon';
import { LightningIcon } from '../icons/LightningIcon';
import { listContainer } from '../../animations';
import { fuzzyMatch } from '../../utils/fuzzyMatch';
import { exportAgentsAsZip } from '../../utils/agentExport';
import { openImportDialog } from '../../utils/agentImport';
import { getStorageItem, setStorageItem } from '../../utils/storage';
import { useToast } from '../../contexts/ToastContext';
import { ConfirmDialog } from '../ConfirmDialog';

interface AgentListScreenProps {
  agents: Agent[];
  onCreate: () => void;
  onEdit: (agent: Agent) => void;
  onDuplicate: (agent: Agent) => void;
  onDelete: (agentId: string) => void;
  onBulkDelete: (agentIds: string[]) => void;
  onShowTeam: () => void;
  onShowSubagents: () => void;
  onShowSkills: () => void;
  onShowAnalytics: () => void;
  onShowMemory: () => void;
  onShowCommands: () => void;
  onShowMCP: () => void;
  onShowHooks: () => void;
  activeView: 'subagents' | 'skills' | 'team' | 'analytics' | 'memory' | 'commands' | 'mcp' | 'hooks';
  onToggleFavorite: (agent: Agent) => void;
  onImport?: (agents: Agent[], errors: string[]) => void;
  shortcutHint?: string;
}

type Filter = 'All' | AgentScope;
type SortCriteria = 'name-asc' | 'name-desc' | 'scope' | 'model';
type LayoutMode = 'table' | 'grid';

const LAYOUT_STORAGE_KEY = 'vinsly-list-layout';
const DEFAULT_VIEW_KEY = 'vinsly-default-view';
const VIRTUALIZATION_THRESHOLD = 100;
const VIRTUALIZATION_BUFFER = 6;
const DEFAULT_ROW_HEIGHT = 120;
const DEFAULT_CONTAINER_HEIGHT = 600;
const LIST_GRID_TEMPLATE = '60px minmax(0,2.1fr) minmax(0,2.6fr) minmax(0,1.1fr) minmax(0,1fr) minmax(0,0.9fr) minmax(0,1.2fr)';
let sessionLayoutCache: LayoutMode | null = null;

export const AgentListScreen: React.FC<AgentListScreenProps> = ({
  agents,
  onCreate,
  onEdit,
  onDuplicate,
  onDelete,
  onBulkDelete,
  onShowTeam,
  onShowSubagents,
  onShowSkills,
  onShowAnalytics,
  onShowMemory,
  onShowCommands,
  onShowMCP,
  onShowHooks,
  activeView,
  onToggleFavorite,
  onImport,
  shortcutHint
}) => {
  const { showToast } = useToast();
  const [filter, setFilter] = useState<Filter>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortCriteria, setSortCriteria] = useState<SortCriteria>('name-asc');
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('table');
  const [layoutLoaded, setLayoutLoaded] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isExportingAll, setIsExportingAll] = useState(false);

  // Load layout mode from storage on mount
  useEffect(() => {
    const loadLayoutMode = async () => {
      if (sessionLayoutCache) {
        setLayoutMode(sessionLayoutCache);
        setLayoutLoaded(true);
        return;
      }

      const storedLayout = await getStorageItem<LayoutMode>(LAYOUT_STORAGE_KEY);
      if (storedLayout === 'grid' || storedLayout === 'table') {
        sessionLayoutCache = storedLayout;
        setLayoutMode(storedLayout);
        setLayoutLoaded(true);
        return;
      }

      const defaultView = await getStorageItem<LayoutMode>(DEFAULT_VIEW_KEY);
      if (defaultView === 'grid' || defaultView === 'table') {
        sessionLayoutCache = defaultView;
        setLayoutMode(defaultView);
      }
      setLayoutLoaded(true);
    };
    loadLayoutMode();
  }, []);
  const [selectedAgentIds, setSelectedAgentIds] = useState<Set<string>>(new Set());
  const selectAllCheckboxRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(DEFAULT_CONTAINER_HEIGHT);
  const { totalAgents, projectAgents, globalAgents } = useMemo(() => {
    const projectCount = agents.filter(agent => agent.scope === AgentScope.Project).length;
    const globalCount = agents.filter(agent => agent.scope === AgentScope.Global).length;
    return {
      totalAgents: agents.length,
      projectAgents: projectCount,
      globalAgents: globalCount,
    };
  }, [agents]);

  const processedAgents = useMemo(() => {
    const filtered = agents.filter(agent => {
        const scopeMatch = filter === 'All' || agent.scope === filter;
        const searchMatch = !searchQuery ||
            fuzzyMatch(agent.name, searchQuery) ||
            fuzzyMatch(agent.frontmatter.description, searchQuery);
        return scopeMatch && searchMatch;
    });

    const compareByCriteria = (a: Agent, b: Agent) => {
      switch (sortCriteria) {
        case 'name-asc':
          return a.name.localeCompare(b.name);
        case 'name-desc':
          return b.name.localeCompare(a.name);
        case 'scope':
          return a.scope.localeCompare(b.scope);
        case 'model': {
          const modelA = a.frontmatter.model || 'default';
          const modelB = b.frontmatter.model || 'default';
          return modelA.localeCompare(modelB);
        }
        default:
          return 0;
      }
    };

    return filtered.slice().sort((a, b) => {
      const favoriteDelta =
        Number(Boolean(b.isFavorite)) - Number(Boolean(a.isFavorite));
      if (favoriteDelta !== 0) {
        return favoriteDelta;
      }
      return compareByCriteria(a, b);
    });
  }, [agents, filter, searchQuery, sortCriteria]);

  useEffect(() => {
    if (!layoutLoaded) return;
    sessionLayoutCache = layoutMode;
    setStorageItem(LAYOUT_STORAGE_KEY, layoutMode);
  }, [layoutMode, layoutLoaded]);

  // Listen for view changes from settings
  useEffect(() => {
    const handleViewChange = (event: CustomEvent<{ view: LayoutMode }>) => {
      setLayoutMode(event.detail.view);
    };

    window.addEventListener('vinsly-view-change', handleViewChange as EventListener);
    return () => {
      window.removeEventListener('vinsly-view-change', handleViewChange as EventListener);
    };
  }, []);

  const isGridLayout = layoutMode === 'grid';

  useEffect(() => {
    setSelectedAgentIds(new Set());
  }, [searchQuery, filter, sortCriteria]);

  const areAllSelected = processedAgents.length > 0 && selectedAgentIds.size === processedAgents.length;
  const isIndeterminate = selectedAgentIds.size > 0 && !areAllSelected;
  const shouldVirtualize = !isGridLayout && processedAgents.length >= VIRTUALIZATION_THRESHOLD;

  useEffect(() => {
    if (selectAllCheckboxRef.current) {
        selectAllCheckboxRef.current.indeterminate = isIndeterminate;
    }
  }, [isIndeterminate]);

  const handleVirtualScroll = useCallback(() => {
    if (scrollContainerRef.current) {
      setScrollTop(scrollContainerRef.current.scrollTop);
    }
  }, []);

  useEffect(() => {
    if (!shouldVirtualize) return;
    const element = scrollContainerRef.current;
    if (!element) return;

    const updateHeight = () => {
      setContainerHeight(element.clientHeight || DEFAULT_CONTAINER_HEIGHT);
    };

    updateHeight();

    let resizeObserver: ResizeObserver | null = null;

    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(updateHeight);
      resizeObserver.observe(element);

      return () => {
        resizeObserver?.disconnect();
      };
    } else if (typeof window !== 'undefined') {
      window.addEventListener('resize', updateHeight);
      return () => window.removeEventListener('resize', updateHeight);
    }
  }, [shouldVirtualize]);

  useEffect(() => {
    if (!shouldVirtualize) return;
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
    setScrollTop(0);
  }, [searchQuery, filter, sortCriteria, shouldVirtualize]);

  const { visibleAgents, virtualizedOffset, totalVirtualHeight } = useMemo(() => {
    if (!shouldVirtualize) {
      return {
        visibleAgents: processedAgents,
        virtualizedOffset: 0,
        totalVirtualHeight: 0
      };
    }

    const safeRowHeight = DEFAULT_ROW_HEIGHT;
    const totalHeight = processedAgents.length * safeRowHeight;
    const viewportHeight = containerHeight || DEFAULT_CONTAINER_HEIGHT;
    const startIndex = Math.max(0, Math.floor(scrollTop / safeRowHeight) - VIRTUALIZATION_BUFFER);
    const itemsInView = Math.ceil(viewportHeight / safeRowHeight) + VIRTUALIZATION_BUFFER * 2;
    const endIndex = Math.min(processedAgents.length, startIndex + itemsInView);

    return {
      visibleAgents: processedAgents.slice(startIndex, endIndex),
      virtualizedOffset: startIndex * safeRowHeight,
      totalVirtualHeight: totalHeight
    };
  }, [shouldVirtualize, processedAgents, scrollTop, containerHeight]);


  const handleSelectAgent = (agentId: string, isSelected: boolean) => {
    setSelectedAgentIds(prev => {
        const newSet = new Set(prev);
        if (isSelected) {
            newSet.add(agentId);
        } else {
            newSet.delete(agentId);
        }
        return newSet;
    });
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
        setSelectedAgentIds(new Set(processedAgents.map(a => a.id)));
    } else {
        setSelectedAgentIds(new Set());
    }
  };

  const handleLayoutChange = (mode: LayoutMode) => {
    setLayoutMode(prev => (prev === mode ? prev : mode));
  };
    
  const handleBulkDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const confirmBulkDelete = () => {
    onBulkDelete(Array.from(selectedAgentIds));
    setSelectedAgentIds(new Set());
    setShowDeleteConfirm(false);
  };

  const handleExportAll = async () => {
    if (isExportingAll || agents.length === 0) return;
    setIsExportingAll(true);
    try {
      const success = await exportAgentsAsZip(agents, 'all-agents');
      if (success) {
        showToast('success', `Successfully exported ${agents.length} agent(s)`);
      }
    } catch (error) {
      showToast('error', `Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsExportingAll(false);
    }
  };

  const handleExportSelected = async () => {
    if (selectedAgentIds.size === 0) return;

    try {
      const selectedAgents = agents.filter(agent => selectedAgentIds.has(agent.id));
      const success = await exportAgentsAsZip(selectedAgents, 'selected-agents');
      if (success) {
        showToast('success', `Successfully exported ${selectedAgents.length} agent(s)`);
      }
    } catch (error) {
      showToast('error', `Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleImport = async () => {
    if (!onImport || isImporting) return;
    setIsImporting(true);
    try {
      await openImportDialog((importedAgents, errors) => {
        if (errors.length > 0) {
          console.error('Import errors:', errors);
          alert(`Import completed with errors:\n${errors.join('\n')}`);
        }
        if (importedAgents.length > 0) {
          onImport(importedAgents, errors);
        }
      }, AgentScope.Global, true, true);
    } finally {
      setIsImporting(false);
    }
  };

  const FilterButton: React.FC<{ value: Filter; label: string }> = ({ value, label }) => (
    <button
      onClick={() => setFilter(value)}
      className={`px-3 py-1.5 text-sm font-medium transition-colors duration-150 ${
        filter === value
          ? 'bg-v-accent text-white'
          : 'bg-v-light-hover dark:bg-v-light-dark text-v-light-text-secondary dark:text-v-text-secondary hover:bg-v-light-border dark:hover:bg-v-border hover:text-v-light-text-primary dark:hover:text-v-text-primary'
      }`}
    >
      {label}
    </button>
  );

  const listContent = (
    <>
      <div className="space-y-4 scroll-mt-24">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { label: 'Total agents', value: totalAgents, icon: LayersIcon },
            { label: 'Global agents', value: globalAgents, icon: GlobeIcon },
            { label: 'Project agents', value: projectAgents, icon: FolderIcon },
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
                  <p className="text-[10px] uppercase tracking-[0.2em] text-v-light-text-secondary dark:text-v-text-secondary/90 font-medium">{stat.label}</p>
                  <p className="text-3xl font-bold text-v-light-text-primary dark:text-v-text-primary mt-0.5 tabular-nums">{stat.value}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* View Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-stretch border border-v-light-border dark:border-v-border rounded-lg overflow-hidden bg-v-light-bg dark:bg-v-dark">
          {[
            {
              key: 'subagents',
              label: 'Subagents',
              icon: <ListIcon className="h-4 w-4" />,
              action: onShowSubagents,
            },
            {
              key: 'skills',
              label: 'Skills',
              icon: <LayersIcon className="h-4 w-4" />,
              action: onShowSkills,
            },
            {
              key: 'memory',
              label: 'Memory',
              icon: <DocumentIcon className="h-4 w-4" />,
              action: onShowMemory,
            },
            {
              key: 'commands',
              label: 'Commands',
              icon: <TerminalIcon className="h-4 w-4" />,
              action: onShowCommands,
            },
            {
              key: 'mcp',
              label: 'MCP',
              icon: <ServerIcon className="h-4 w-4" />,
              action: onShowMCP,
            },
            {
              key: 'hooks',
              label: 'Hooks',
              icon: <LightningIcon className="h-4 w-4" />,
              action: onShowHooks,
            },
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

        <div className="flex items-center gap-2">
          {/* Network and Analytics buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={onShowTeam}
              className="p-2 rounded-md border border-v-light-border dark:border-v-border hover:border-v-accent text-v-light-text-secondary dark:text-v-text-secondary hover:text-v-accent transition-colors"
              title="Network View"
            >
              <NetworkIcon className="h-4 w-4" />
            </button>
            <button
              onClick={onShowAnalytics}
              className="p-2 rounded-md border border-v-light-border dark:border-v-border hover:border-v-accent text-v-light-text-secondary dark:text-v-text-secondary hover:text-v-accent transition-colors"
              title="Analytics"
            >
              <ChartIcon className="h-4 w-4" />
            </button>
          </div>

          {layoutLoaded && (
            <div className="flex items-center border border-v-light-border dark:border-v-border rounded-md overflow-hidden">
              <button
                type="button"
                onClick={() => handleLayoutChange('table')}
                className={`p-2 transition-colors ${
                  layoutMode === 'table'
                    ? 'bg-v-accent text-white'
                    : 'bg-v-light-hover dark:bg-v-light-dark text-v-light-text-secondary dark:text-v-text-secondary hover:text-v-light-text-primary dark:hover:text-v-text-primary'
                }`}
                aria-pressed={layoutMode === 'table'}
                title="Row layout"
              >
                <ListIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => handleLayoutChange('grid')}
                className={`p-2 transition-colors ${
                  layoutMode === 'grid'
                    ? 'bg-v-accent text-white'
                    : 'bg-v-light-hover dark:bg-v-light-dark text-v-light-text-secondary dark:text-v-text-secondary hover:text-v-light-text-primary dark:hover:text-v-text-primary'
                }`}
                aria-pressed={layoutMode === 'grid'}
                title="Card layout"
              >
                <GridIcon className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4">

        <div className="flex justify-between items-center gap-4 min-h-[38px]">
          {selectedAgentIds.size > 0 ? (
              <div className="flex-grow flex items-center gap-4">
                  <span className="text-sm font-semibold text-v-light-text-primary dark:text-v-text-primary">{selectedAgentIds.size} selected</span>
                  <button
                      onClick={handleExportSelected}
                      className="flex items-center gap-2 px-3 py-1.5 bg-v-accent hover:bg-v-accent-hover text-white font-semibold text-sm transition-transform duration-150 rounded-md shadow-sm hover:shadow-md active:scale-95"
                  >
                      <DownloadIcon className="h-4 w-4" />
                      Export Selected
                  </button>
                  <button
                      onClick={handleBulkDeleteClick}
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
                              placeholder="Search by name or description..."
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              className="w-full pl-9 pr-3 py-1.5 bg-v-light-surface dark:bg-v-mid-dark border border-v-light-border dark:border-v-border text-v-light-text-primary dark:text-v-text-primary focus:border-v-accent focus:ring-2 focus:ring-v-accent focus:ring-offset-1 focus:ring-offset-v-light-surface dark:focus:ring-offset-v-mid-dark focus-visible:outline-none text-sm rounded-md"
                          />
                      </div>
                      <div className="flex items-center border border-v-light-border dark:border-v-border rounded-md overflow-hidden">
                          <FilterButton value="All" label={`All (${totalAgents})`} />
                          <FilterButton value={AgentScope.Global} label="Global" />
                          <FilterButton value={AgentScope.Project} label="Project" />
                      </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleImport}
                      disabled={isImporting}
                      className="inline-flex h-10 items-center gap-2 px-3 text-sm font-semibold text-v-light-text-primary dark:text-v-text-primary border border-v-light-border dark:border-v-border rounded-md hover:border-v-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Import agents from .zip or .md files"
                    >
                      {isImporting ? (
                        <>
                          <SpinnerIcon className="h-4 w-4 text-v-light-text-secondary dark:text-v-text-secondary" />
                          <span>Importing…</span>
                        </>
                      ) : (
                        <>
                          <UploadIcon className="h-4 w-4" />
                          <span>Import</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={handleExportAll}
                      disabled={isExportingAll || agents.length === 0}
                      className="inline-flex h-10 items-center gap-2 px-3 text-sm font-semibold text-v-light-text-primary dark:text-v-text-primary border border-v-light-border dark:border-v-border rounded-md hover:border-v-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Export all agents as .zip"
                    >
                      {isExportingAll ? (
                        <>
                          <SpinnerIcon className="h-4 w-4 text-v-light-text-secondary dark:text-v-text-secondary" />
                          <span>Exporting…</span>
                        </>
                      ) : (
                        <>
                          <DownloadIcon className="h-4 w-4" />
                          <span>Export All</span>
                        </>
                      )}
                    </button>
                    <button
                     
                      onClick={onCreate}
                      className="inline-flex h-10 items-center gap-3 px-4 bg-v-accent text-white font-semibold text-sm transition-all duration-200 ease-out flex-shrink-0 rounded-md shadow-sm hover:shadow-lg transform hover:-translate-y-0.5 active:scale-95"
                    >
                      <PlusIcon className="h-4 w-4" />
                      <span>New Agent</span>
                      {shortcutHint && (
                        <span className="px-2 py-0.5 text-[10px] uppercase tracking-wide rounded bg-white/20 text-white">{shortcutHint}</span>
                      )}
                    </button>
                  </div>
              </>
          )}
        </div>
      </div>

      {filter === AgentScope.Global && globalAgents === 0 && (
        <div className="mt-3 rounded-md border border-v-light-border dark:border-v-border bg-v-light-hover/60 dark:bg-v-light-dark/40 px-4 py-3 text-sm text-v-light-text-secondary dark:text-v-text-secondary">
          No global agents yet. Switch back to <span className="font-semibold text-v-light-text-primary dark:text-v-text-primary">All</span> to see your project agents.
        </div>
      )}
      {filter === AgentScope.Project && projectAgents === 0 && (
        <div className="mt-3 rounded-md border border-v-light-border dark:border-v-border bg-v-light-hover/60 dark:bg-v-light-dark/40 px-4 py-3 text-sm text-v-light-text-secondary dark:text-v-text-secondary">
          No project agents found. Choose <span className="font-semibold text-v-light-text-primary dark:text-v-text-primary">All</span> to view your global agents.
        </div>
      )}

      <div className="bg-v-light-surface dark:bg-v-mid-dark border border-v-light-border dark:border-v-border rounded-lg overflow-x-hidden">
        {isGridLayout ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-v-light-border dark:border-v-border text-xs font-semibold uppercase tracking-wide text-v-light-text-secondary dark:text-v-text-secondary">
              <div className="flex items-center gap-2">
                <input
                  ref={selectAllCheckboxRef}
                  type="checkbox"
                  checked={areAllSelected}
                  onChange={handleSelectAll}
                  disabled={processedAgents.length === 0}
                  aria-label="Select all agents"
                  className="h-4 w-4 bg-v-light-surface dark:bg-v-mid-dark border-v-light-border dark:border-v-border text-v-accent focus:ring-v-accent rounded"
                />
                <span>Select all</span>
              </div>
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide">
                <label htmlFor="agent-sort-grid" className="sr-only">Sort agents by</label>
                <div className="relative inline-flex items-center">
                  <select
                    id="agent-sort-grid"
                    value={sortCriteria}
                    onChange={(e) => setSortCriteria(e.target.value as SortCriteria)}
                    className="appearance-none bg-transparent border-none text-v-light-text-secondary dark:text-v-text-secondary text-[11px] focus:ring-1 focus:ring-v-accent focus:outline-none pr-5 pl-1 py-1 cursor-pointer [&::-ms-expand]:hidden"
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
                    <option value="model">Model</option>
                  </select>
                  <svg className="h-3 w-3 text-v-light-text-secondary dark:text-v-text-secondary absolute right-0 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>
            {processedAgents.length > 0 ? (
              <div className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {processedAgents.map(agent => (
                    <AgentGridCard
                      key={agent.id || agent.path || agent.name}
                      agent={agent}
                      onEdit={onEdit}
                      onDuplicate={onDuplicate}
                      onDelete={onDelete}
                      onToggleFavorite={onToggleFavorite}
                      onSelect={handleSelectAgent}
                      isSelected={selectedAgentIds.has(agent.id)}
                      highlightTerm={searchQuery}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-v-light-text-secondary dark:text-v-text-secondary">
                No agents found.
              </div>
            )}
          </>
        ) : (
          <>
            <div
              className="grid gap-4 px-4 py-2 border-b border-v-light-border dark:border-v-border text-v-light-text-secondary dark:text-v-text-secondary text-xs uppercase font-bold tracking-wider items-center"
              style={{ gridTemplateColumns: LIST_GRID_TEMPLATE }}
            >
              <div className="flex justify-center">
                <input
                    ref={selectAllCheckboxRef}
                    type="checkbox"
                    checked={areAllSelected}
                    onChange={handleSelectAll}
                    disabled={processedAgents.length === 0}
                    aria-label="Select all agents"
                    className="h-4 w-4 bg-v-light-surface dark:bg-v-mid-dark border-v-light-border dark:border-v-border text-v-accent focus:ring-v-accent rounded"
                />
              </div>
              <div>Name</div>
              <div>Path</div>
              <div>Scope</div>
              <div>Model</div>
              <div>Tools</div>
              <div className="text-right">
                <label htmlFor="agent-sort" className="sr-only">Sort agents by</label>
                <div className="relative inline-flex items-center">
                  <select
                      id="agent-sort"
                      value={sortCriteria}
                      onChange={(e) => setSortCriteria(e.target.value as SortCriteria)}
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
                      <option value="model">Model</option>
                  </select>
                  <svg className="h-3 w-3 text-v-light-text-secondary dark:text-v-text-secondary absolute right-0 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>
            {processedAgents.length > 0 ? (
              shouldVirtualize ? (
                <div className="relative">
                  <div
                    ref={scrollContainerRef}
                    className="max-h-[65vh] overflow-y-auto custom-scrollbar"
                    onScroll={handleVirtualScroll}
                  >
                    <div style={{ height: totalVirtualHeight }} className="relative">
                      <motion.div
                        className="divide-y divide-v-light-border dark:divide-v-border absolute left-0 right-0 top-0"
                        style={{ transform: `translateY(${virtualizedOffset}px)` }}
                        variants={listContainer}
                        initial="hidden"
                        animate="visible"
                      >
                        {visibleAgents.map(agent => (
                          <AgentListItem
                            key={agent.id || agent.path || agent.name}
                            agent={agent}
                            onEdit={onEdit}
                            onDuplicate={onDuplicate}
                            onDelete={onDelete}
                            onToggleFavorite={onToggleFavorite}
                            isSelected={selectedAgentIds.has(agent.id)}
                            onSelect={handleSelectAgent}
                            highlightTerm={searchQuery}
                            gridTemplateColumns={LIST_GRID_TEMPLATE}
                          />
                        ))}
                      </motion.div>
                    </div>
                  </div>
                </div>
              ) : (
                <motion.div
                  className="divide-y divide-v-light-border dark:divide-v-border"
                  variants={listContainer}
                  initial="hidden"
                  animate="visible"
                >
                  {processedAgents.map(agent => (
                    <AgentListItem
                      key={agent.id || agent.path || agent.name}
                      agent={agent}
                      onEdit={onEdit}
                      onDuplicate={onDuplicate}
                      onDelete={onDelete}
                      onToggleFavorite={onToggleFavorite}
                      isSelected={selectedAgentIds.has(agent.id)}
                      onSelect={handleSelectAgent}
                      highlightTerm={searchQuery}
                      gridTemplateColumns={LIST_GRID_TEMPLATE}
                    />
                  ))}
                </motion.div>
              )
            ) : (
              <div className="text-center py-12 text-v-light-text-secondary dark:text-v-text-secondary">
                No agents found.
              </div>
            )}
          </>
        )}
      </div>
    </>
  );

  return (
    <div className="space-y-6">
      {listContent}

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Delete Agents"
        message={`Are you sure you want to delete ${selectedAgentIds.size} selected agent(s)? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmBulkDelete}
        onCancel={() => setShowDeleteConfirm(false)}
        variant="danger"
      />
    </div>
  );
};
