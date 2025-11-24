import React, { useMemo, useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import { motion } from 'framer-motion';
import { toPng } from 'html-to-image';
import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';
import { Agent, AgentScope } from '../../types';
import { buttonVariants, fadeIn } from '../../animations';
import { StarIcon } from '../icons/StarIcon';
import { ListIcon } from '../icons/ListIcon';
import { NetworkIcon } from '../icons/NetworkIcon';
import { ChartIcon } from '../icons/ChartIcon';
import { GlobeIcon } from '../icons/GlobeIcon';
import { FolderIcon } from '../icons/FolderIcon';
import { InfoIcon } from '../icons/InfoIcon';
import { useToast } from '../../contexts/ToastContext';
import { getToolsState } from '../../utils/toolHelpers';

interface AgentTeamViewProps {
  agents: Agent[];
  onBack: () => void;
  onShowList: () => void;
  onShowAnalytics: () => void;
  onEdit: (agent: Agent) => void;
  onToggleFavorite: (agent: Agent) => void;
  userName?: string;
}

type NodeKind = 'root' | 'group' | 'agent';

type ScopeVisibility = Record<AgentScope, boolean>;
type CollapsedGroupState = Record<AgentScope, boolean>;

interface GraphNode {
  id: string;
  label: string;
  description?: string;
  kind: NodeKind;
  scope?: AgentScope;
  agent?: Agent;
  collapsed?: boolean;
  totalAgents?: number;
  centerX: number;
  centerY: number;
  width: number;
  height: number;
}

interface LayoutNode extends GraphNode {
  x: number;
  y: number;
}

interface AgentRowEntry {
  agent: Agent;
  width: number;
}

interface AgentRow {
  entries: AgentRowEntry[];
  rowWidth: number;
}

const ROOT_CARD_WIDTH = 220;
const ROOT_CARD_HEIGHT = 120;
const GROUP_CARD_WIDTH = 220;
const GROUP_CARD_HEIGHT = 120;
const AGENT_MIN_WIDTH = 160;
const AGENT_HEIGHT = 44;
const LEVEL_GAP = 200;
const GROUP_PADDING = 240;
const AGENT_SPACING = 36;
const CANVAS_PADDING = 170;
const MAX_AGENT_ROW_WIDTH = 720;
const AGENT_ROW_GAP = 56;

const scopeCopy: Record<AgentScope, { title: string; text: string }> = {
  [AgentScope.Project]: {
    title: 'Project agents',
    text: 'Repo specific'
  },
  [AgentScope.Global]: {
    title: 'Global agents',
    text: 'Global, can be used anywhere'
  }
};

const DEFAULT_SCOPE_VISIBILITY: ScopeVisibility = {
  [AgentScope.Global]: true,
  [AgentScope.Project]: true
};

const colorPalette: Record<string, string> = {
  red: '#ef4444',
  blue: '#3b82f6',
  green: '#22c55e',
  yellow: '#eab308',
  purple: '#a855f7',
  orange: '#f97316',
  pink: '#ec4899',
  cyan: '#06b6d4'
};

const DEFAULT_ZOOM = 0.8;
const ZOOM_STEP = 0.1;
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 1.8;
const clampZoom = (value: number) => {
  const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
  return Math.round(clamped * 10) / 10;
};
const formatZoom = (value: number) => `${Math.round(value * 100)}%`;
const parseZoomDisplay = (displayValue: string): number => {
  const numeric = parseFloat(displayValue.replace(/[^0-9.]/g, ''));
  return numeric / 100;
};
const getAgentCardWidth = (label: string) => {
  const safeLabel = (label || 'agent').trim();
  const approx = safeLabel.length * 9 + 32;
  return Math.max(AGENT_MIN_WIDTH, approx);
};

export const AgentTeamView: React.FC<AgentTeamViewProps> = ({ agents, onBack, onShowList, onShowAnalytics, onEdit, onToggleFavorite, userName = '' }) => {
  const { showToast } = useToast();
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isEditingZoom, setIsEditingZoom] = useState(false);
  const [zoomInputValue, setZoomInputValue] = useState(formatZoom(DEFAULT_ZOOM));
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [maxPanelHeight, setMaxPanelHeight] = useState<number | null>(null);
  const [favoritesFilterActive, setFavoritesFilterActive] = useState(false);
  const [scopeVisibility, setScopeVisibility] = useState<ScopeVisibility>({ ...DEFAULT_SCOPE_VISIBILITY });
  const [collapsedGroups, setCollapsedGroups] = useState<CollapsedGroupState>({
    [AgentScope.Global]: false,
    [AgentScope.Project]: false
  });
  const [isViewportHovered, setIsViewportHovered] = useState(false);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const graphContainerRef = useRef<HTMLDivElement | null>(null);
  const panelsRef = useRef<HTMLDivElement | null>(null);
  const tooltipHideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerActiveRef = useRef(false);
  const lastPointerPositionRef = useRef({ x: 0, y: 0 });
  const zoomRef = useRef(DEFAULT_ZOOM);
  const userZoomOverrideRef = useRef(false);
  const gestureStateRef = useRef<{ baseZoom: number } | null>(null);

  const filteredAgents = useMemo(() => {
    const favorites: Agent[] = [];
    const others: Agent[] = [];

    agents.forEach(agent => {
      const scopeEnabled = scopeVisibility[agent.scope];
      const favorited = Boolean(agent.isFavorite);
      const includeViaFavorites = favoritesFilterActive && favorited;

      if (scopeEnabled || includeViaFavorites) {
        if (favoritesFilterActive && favorited) {
          favorites.push(agent);
        } else {
          others.push(agent);
        }
      }
    });

    if (favoritesFilterActive) {
      return [...favorites, ...others];
    }
    return others;
  }, [agents, scopeVisibility, favoritesFilterActive]);

  const toggleScopeVisibility = (scope: AgentScope) => {
    setScopeVisibility(prev => ({
      ...prev,
      [scope]: !prev[scope]
    }));
  };

  const toggleGroupCollapse = (scope: AgentScope) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [scope]: !prev[scope]
    }));
  };

  const resetFilters = () => {
    setFavoritesFilterActive(false);
    setScopeVisibility({ ...DEFAULT_SCOPE_VISIBILITY });
  };

  const scopeFilterOptions = useMemo(
    () => [
      { scope: AgentScope.Global, label: 'Global', Icon: GlobeIcon },
      { scope: AgentScope.Project, label: 'Project', Icon: FolderIcon }
    ],
    []
  );

  const activeScopeCount = useMemo(() => Object.values(scopeVisibility).filter(Boolean).length, [scopeVisibility]);
  const totalScopeCount = Object.keys(scopeVisibility).length;
  const allFiltersActive = !favoritesFilterActive && activeScopeCount === totalScopeCount;
  const filtersActive = !allFiltersActive;
  const showEmptyBanner = filteredAgents.length === 0;
  const emptyBannerMessage =
    agents.length === 0
      ? 'No agents to show in Swarm View yet. Scan or create an agent to populate this map.'
      : 'No agents match the current filters.';
  const showResetCta = agents.length > 0 && filtersActive;
  const filterButtonClasses = (active: boolean) =>
    `inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
      active
        ? 'border-v-accent text-v-accent bg-v-accent/10'
        : 'border-v-light-border/60 dark:border-v-border/60 text-v-light-text-secondary dark:text-v-text-secondary hover:text-v-light-text-primary dark:hover:text-v-text-primary'
    }`;
  const clearFilters = () => {
    setFavoritesFilterActive(false);
    setScopeVisibility({
      [AgentScope.Global]: false,
      [AgentScope.Project]: false
    });
  };
  const handleAllChipClick = () => {
    if (allFiltersActive) {
      clearFilters();
      return;
    }
    resetFilters();
  };
  const handleFavoritesToggle = () => {
    setFavoritesFilterActive(prev => !prev);
  };

  const filterChips = [
    {
      key: 'all',
      label: 'All',
      active: allFiltersActive,
      onClick: handleAllChipClick
    },
    ...scopeFilterOptions.map(({ scope, label, Icon }) => ({
      key: scope,
      label,
      icon: Icon,
      active: allFiltersActive ? true : scopeVisibility[scope],
      onClick: () => toggleScopeVisibility(scope)
    })),
    {
      key: 'favorites',
      label: 'Favorites',
      icon: StarIcon,
      active: allFiltersActive ? true : favoritesFilterActive,
      onClick: handleFavoritesToggle
    }
  ];
  const updatePanelHeight = useCallback(() => {
    if (typeof window === 'undefined' || !panelsRef.current) return;
    const paddingBottom = 32;
    const { top } = panelsRef.current.getBoundingClientRect();
    const available = window.innerHeight - top - paddingBottom;
    const finalHeight = available > 0 ? available : 320;
    setMaxPanelHeight(finalHeight);
  }, []);

  useEffect(() => {
    updatePanelHeight();
    window.addEventListener('resize', updatePanelHeight);
    return () => window.removeEventListener('resize', updatePanelHeight);
  }, [updatePanelHeight]);

  useEffect(() => {
    updatePanelHeight();
  }, [updatePanelHeight, showEmptyBanner, filteredAgents.length]);

  const layout = useMemo(() => {
    const createNode = (
      base: Omit<GraphNode, 'centerX' | 'centerY' | 'width' | 'height'>,
      width: number,
      height: number,
      centerX: number,
      centerY: number
    ): LayoutNode => ({
      ...base,
      width,
      height,
      centerX,
      centerY,
      x: centerX - width / 2,
      y: centerY - height / 2,
    });

    const nodes: LayoutNode[] = [];
    const links: { from: LayoutNode; to: LayoutNode }[] = [];

    const buildAgentRows = (entries: AgentRowEntry[]): AgentRow[] => {
      if (entries.length === 0) return [];
      const rows: AgentRow[] = [];
      let current: AgentRowEntry[] = [];
      let currentWidth = 0;

      const flushRow = () => {
        if (current.length === 0) return;
        rows.push({ entries: current, rowWidth: currentWidth });
        current = [];
        currentWidth = 0;
      };

      entries.forEach(entry => {
        const spacing = current.length === 0 ? 0 : AGENT_SPACING;
        const projectedWidth = currentWidth + spacing + entry.width;
        if (current.length > 0 && projectedWidth > MAX_AGENT_ROW_WIDTH) {
          flushRow();
        }
        const rowSpacing = current.length === 0 ? 0 : AGENT_SPACING;
        current.push(entry);
        currentWidth += rowSpacing + entry.width;
      });

      flushRow();
      return rows;
    };

    const rootNode = createNode(
      {
        id: 'root',
        label: 'Agent network',
        description: 'High-level view of how your assistants relate.',
        kind: 'root'
      },
      ROOT_CARD_WIDTH,
      ROOT_CARD_HEIGHT,
      0,
      0
    );

    nodes.push(rootNode);

    const groupedAgents: { scope: AgentScope; agents: Agent[] }[] = [
      { scope: AgentScope.Global, agents: filteredAgents.filter(a => a.scope === AgentScope.Global) },
      { scope: AgentScope.Project, agents: filteredAgents.filter(a => a.scope === AgentScope.Project) }
    ];

    const activeGroups = groupedAgents.filter(group => group.agents.length > 0);
    const groupsToRender = activeGroups.length > 0 ? activeGroups : groupedAgents;

    const sortedGroups = groupsToRender.map(group => {
      const sortedAgents = group.agents.slice().sort((a, b) => a.name.localeCompare(b.name));
      const isCollapsed = collapsedGroups[group.scope];
      const visibleAgents = isCollapsed ? [] : sortedAgents;
      const agentEntries: AgentRowEntry[] = visibleAgents.map(agent => ({
        agent,
        width: getAgentCardWidth(agent.name || agent.frontmatter.name || 'agent')
      }));
      const agentRows = buildAgentRows(agentEntries);
      const maxRowWidth = agentRows.reduce((max, row) => Math.max(max, row.rowWidth), 0);
      const clusterWidth = Math.max(
        GROUP_CARD_WIDTH,
        agentRows.length > 0 ? Math.min(MAX_AGENT_ROW_WIDTH, maxRowWidth) : GROUP_CARD_WIDTH
      );
      return {
        scope: group.scope,
        agentRows,
        clusterWidth,
        totalAgents: sortedAgents.length,
        isCollapsed
      };
    });

    const totalWidth = sortedGroups.reduce((acc, group, index) => {
      const gap = index === sortedGroups.length - 1 ? 0 : GROUP_PADDING;
      return acc + group.clusterWidth + gap;
    }, 0);

    let cursor = -totalWidth / 2;

    sortedGroups.forEach(group => {
      const centerX = cursor + group.clusterWidth / 2;
      cursor += group.clusterWidth + GROUP_PADDING;

      const groupNode = createNode(
        {
          id: `group-${group.scope}`,
          label: scopeCopy[group.scope].title,
          description: scopeCopy[group.scope].text,
          kind: 'group',
          scope: group.scope,
          collapsed: group.isCollapsed,
          totalAgents: group.totalAgents
        },
        GROUP_CARD_WIDTH,
        GROUP_CARD_HEIGHT,
        centerX,
        LEVEL_GAP
      );
      nodes.push(groupNode);
      links.push({ from: rootNode, to: groupNode });

      if (group.agentRows.length === 0) {
        return;
      }

      const baseAgentY = LEVEL_GAP * 2;
      group.agentRows.forEach((row, rowIndex) => {
        let agentCursor = -row.rowWidth / 2;
        const rowCenterY = baseAgentY + rowIndex * (AGENT_HEIGHT + AGENT_ROW_GAP);

        row.entries.forEach(entry => {
          const node = createNode(
            {
              id: entry.agent.id || entry.agent.name,
              label: entry.agent.name,
              description: entry.agent.frontmatter.description || 'No description provided.',
              kind: 'agent',
              scope: entry.agent.scope,
              agent: entry.agent
            },
            entry.width,
            AGENT_HEIGHT,
            groupNode.centerX + agentCursor + entry.width / 2,
            rowCenterY
          );
          nodes.push(node);
          links.push({ from: groupNode, to: node });
          agentCursor += entry.width + AGENT_SPACING;
        });
      });
    });

    const minX = Math.min(...nodes.map(node => node.x));
    const maxX = Math.max(...nodes.map(node => node.x + node.width));
    const minY = Math.min(...nodes.map(node => node.y));
    const maxY = Math.max(...nodes.map(node => node.y + node.height));

    const rawWidth = maxX - minX;
    const rawHeight = maxY - minY;
    const canvasWidth = rawWidth + CANVAS_PADDING * 2;
    const canvasHeight = rawHeight + CANVAS_PADDING * 2;

    const offsetX = CANVAS_PADDING - minX;
    const offsetY = CANVAS_PADDING - minY;

    return {
      nodes,
      links,
      canvasWidth: Math.max(canvasWidth, 640),
      canvasHeight: Math.max(canvasHeight, 520),
      offsetX,
      offsetY
    };
  }, [collapsedGroups, filteredAgents]);

  const centerViewport = useCallback((targetZoom?: number) => {
    const viewportEl = viewportRef.current;
    if (!viewportEl) return;
    const zoomValue = typeof targetZoom === 'number' ? targetZoom : zoomRef.current;
    const rect = viewportEl.getBoundingClientRect();
    const centeredX = (rect.width - layout.canvasWidth * zoomValue) / 2;
    const centeredY = (rect.height - layout.canvasHeight * zoomValue) / 2;
    setPan({ x: centeredX, y: centeredY });
  }, [layout.canvasWidth, layout.canvasHeight]);

  useEffect(() => {
    zoomRef.current = zoom;
    if (!isEditingZoom) {
      setZoomInputValue(formatZoom(zoom));
    }
  }, [zoom, isEditingZoom]);

  const autoFitGraph = useCallback((options?: { force?: boolean }) => {
    const force = options?.force ?? false;
    const viewportEl = viewportRef.current;
    if (!viewportEl || layout.canvasWidth <= 0 || layout.canvasHeight <= 0) {
      return;
    }
    const rect = viewportEl.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      return;
    }
    const fitRatio = Math.min(rect.width / layout.canvasWidth, rect.height / layout.canvasHeight);
    if (!Number.isFinite(fitRatio) || fitRatio <= 0) {
      return;
    }
    const minZoomToFit = clampZoom(fitRatio * 0.98);
    const currentZoom = zoomRef.current;
    let nextZoom = currentZoom;

    if (force || currentZoom > minZoomToFit) {
      nextZoom = minZoomToFit;
      if (nextZoom !== currentZoom) {
        zoomRef.current = nextZoom;
        setZoom(nextZoom);
        setZoomInputValue(formatZoom(nextZoom));
      }
      userZoomOverrideRef.current = false;
      centerViewport(nextZoom);
      return;
    }

    centerViewport(currentZoom);
  }, [layout.canvasWidth, layout.canvasHeight, centerViewport]);

useLayoutEffect(() => {
  autoFitGraph({ force: true });
}, [autoFitGraph, layout.canvasWidth, layout.canvasHeight]);

useEffect(() => {
  const handleResize = () => autoFitGraph();
  window.addEventListener('resize', handleResize);
  return () => window.removeEventListener('resize', handleResize);
}, [autoFitGraph]);

useEffect(() => {
  const viewportEl = viewportRef.current;
  if (!viewportEl || typeof ResizeObserver === 'undefined') {
    return;
  }
  const observer = new ResizeObserver(() => autoFitGraph());
  observer.observe(viewportEl);
  return () => observer.disconnect();
}, [autoFitGraph]);

  useEffect(() => {
    const node = viewportRef.current;
    if (!node) return;

    const handleGestureStart = (event: Event) => {
      event.preventDefault();
      gestureStateRef.current = { baseZoom: zoomRef.current };
      userZoomOverrideRef.current = true;
    };

    const handleGestureChange = (event: Event) => {
      event.preventDefault();
      const state = gestureStateRef.current;
      if (!state || typeof (event as any).scale !== 'number') {
        return;
      }
      const rawZoom = state.baseZoom * (event as any).scale;
      const snappedZoom = clampZoom(Math.round(rawZoom / ZOOM_STEP) * ZOOM_STEP);
      const nextZoom = snappedZoom;
      zoomRef.current = nextZoom;
      setZoom(nextZoom);
      setZoomInputValue(formatZoom(nextZoom));
    };

    const handleGestureEnd = (event: Event) => {
      event.preventDefault();
      gestureStateRef.current = null;
    };

    node.addEventListener('gesturestart', handleGestureStart as EventListener, { passive: false });
    node.addEventListener('gesturechange', handleGestureChange as EventListener, { passive: false });
    node.addEventListener('gestureend', handleGestureEnd as EventListener, { passive: false });

    return () => {
      node.removeEventListener('gesturestart', handleGestureStart as EventListener);
      node.removeEventListener('gesturechange', handleGestureChange as EventListener);
      node.removeEventListener('gestureend', handleGestureEnd as EventListener);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (tooltipHideTimeoutRef.current) {
        clearTimeout(tooltipHideTimeoutRef.current);
      }
    };
  }, []);

  const handleZoomChange = (delta: number) => {
    userZoomOverrideRef.current = true;
    setZoom(prev => clampZoom(prev + delta));
  };

  const handleZoomReset = () => {
    const resetZoom = DEFAULT_ZOOM;
    userZoomOverrideRef.current = false;
    zoomRef.current = resetZoom;
    centerViewport(resetZoom);
    setZoom(resetZoom);
    setZoomInputValue(formatZoom(resetZoom));
  };

  const handleExport = async () => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    try {
      // Show save dialog first (before spinner)
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const filePath = await save({
        defaultPath: `organisation-map-${timestamp}.png`,
        filters: [{
          name: 'PNG Image',
          extensions: ['png']
        }]
      });

      if (!filePath) return; // User cancelled

      setIsExporting(true);

      const isDarkMode = document.documentElement.classList.contains('dark');
      const backgroundColor = isDarkMode ? '#0f1419' : '#f8f9fa';
      const desiredPixelRatio = Math.min(5, Math.max(3, window.devicePixelRatio * 2));

      const dataUrl = await toPng(viewport, {
        backgroundColor,
        pixelRatio: desiredPixelRatio,
        cacheBust: true,
      });

      // Convert data URL to binary
      const base64Data = dataUrl.split(',')[1];
      const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

      // Write file using Tauri
      await writeFile(filePath, binaryData);
      showToast('success', 'Organisation map exported successfully');
    } catch (error) {
      console.error('Failed to export map:', error);
      showToast('error', 'Failed to export map. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (event.cancelable) {
      event.preventDefault();
    }
    event.stopPropagation();
    if (event.ctrlKey) {
      const direction = event.deltaY === 0 ? 0 : event.deltaY < 0 ? 1 : -1;
      if (direction !== 0) {
        handleZoomChange(direction * ZOOM_STEP);
      }
    } else {
      setPan(prev => ({
        x: prev.x - event.deltaX,
        y: prev.y - event.deltaY
      }));
    }
  };

  const stopPan = (event?: React.PointerEvent<HTMLDivElement>) => {
    pointerActiveRef.current = false;
    setIsDragging(false);
    if (event && event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }
    if (target.closest('[data-stop-pan="true"]')) {
      return;
    }
    if (['BUTTON', 'INPUT', 'A', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
      return;
    }
    event.preventDefault();
    setHoveredNodeId(null);
    if (tooltipHideTimeoutRef.current) {
      clearTimeout(tooltipHideTimeoutRef.current);
      tooltipHideTimeoutRef.current = null;
    }
    pointerActiveRef.current = true;
    lastPointerPositionRef.current = { x: event.clientX, y: event.clientY };
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!pointerActiveRef.current) {
      return;
    }
    const dx = event.clientX - lastPointerPositionRef.current.x;
    const dy = event.clientY - lastPointerPositionRef.current.y;
    lastPointerPositionRef.current = { x: event.clientX, y: event.clientY };
    setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!pointerActiveRef.current) {
      return;
    }
    stopPan(event);
  };

  const handleZoomInputCommit = () => {
    const actualZoom = parseZoomDisplay(zoomInputValue);
    if (Number.isFinite(actualZoom)) {
      const normalized = clampZoom(actualZoom);
      if (normalized !== zoomRef.current) {
        userZoomOverrideRef.current = true;
      }
      setZoom(normalized);
      setZoomInputValue(formatZoom(normalized));
    } else {
      setZoomInputValue(formatZoom(zoom));
    }
    setIsEditingZoom(false);
  };

  const renderNode = (node: LayoutNode) => {
    const baseClasses =
      'absolute rounded-xl px-3 py-2.5 flex flex-col gap-2 text-left transition-shadow duration-200 bg-white/95 dark:bg-v-mid-dark/90 backdrop-blur-sm border border-v-light-border/90 dark:border-v-border/80 shadow-sm overflow-hidden';
    const scopeLabel = node.scope === AgentScope.Project ? 'Project' : 'Global';
    const showTooltip = hoveredNodeId === node.id;
    const getNodeZIndex = (n: LayoutNode) => {
      if (n.kind === 'root') return 20;
      if (n.kind === 'group') return 30;
      return showTooltip ? 60 : 40;
    };
    const nodeZIndex = getNodeZIndex(node);

    const handleTooltipEnter = () => {
      if (tooltipHideTimeoutRef.current) {
        clearTimeout(tooltipHideTimeoutRef.current);
        tooltipHideTimeoutRef.current = null;
      }
      setHoveredNodeId(node.id);
    };

    const handleTooltipLeave = () => {
      if (tooltipHideTimeoutRef.current) {
        clearTimeout(tooltipHideTimeoutRef.current);
      }
      tooltipHideTimeoutRef.current = setTimeout(() => {
        setHoveredNodeId(prev => (prev === node.id ? null : prev));
      }, 80);
    };

    if (node.kind === 'root') {
      return (
        <div
          key={node.id}
          className={baseClasses}
        style={{
          width: node.width,
          minHeight: node.height,
          left: node.x + layout.offsetX,
          top: node.y + layout.offsetY,
          zIndex: nodeZIndex
        }}
      >
          <p className="text-[11px] uppercase tracking-wide text-v-light-text-secondary dark:text-v-text-secondary">
            Overview
          </p>
          <h2 className="text-base font-semibold text-v-light-text-primary dark:text-v-text-primary">{node.label}</h2>
          <p className="text-xs text-v-light-text-secondary dark:text-v-text-secondary leading-snug line-clamp-3">
            {node.description}
          </p>
        </div>
      );
    }

    if (node.kind === 'group') {
      const totalAgents = node.totalAgents ?? 0;
      const isCollapsedGroup = Boolean(node.collapsed);
      return (
        <div
          key={node.id}
          className={baseClasses}
          style={{
            width: node.width,
            minHeight: node.height,
            left: node.x + layout.offsetX,
            top: node.y + layout.offsetY,
            zIndex: nodeZIndex
          }}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-v-light-text-secondary dark:text-v-text-secondary">
                {scopeLabel}
              </div>
              <div className="text-base font-semibold tracking-tight text-v-light-text-primary dark:text-v-text-primary">{node.label}</div>
            </div>
            {node.scope && (
              <button
                type="button"
                data-stop-pan="true"
                onClick={() => toggleGroupCollapse(node.scope!)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-transparent text-v-light-text-secondary dark:text-v-text-secondary hover:text-v-accent focus-visible:ring-2 focus-visible:ring-v-accent transition-colors"
                aria-label={isCollapsedGroup ? 'Expand group' : 'Collapse group'}
              >
                <svg
                  className={`h-4 w-4 transition-transform ${isCollapsedGroup ? 'rotate-180' : ''}`}
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                >
                  <path d="M6 8l4 4 4-4" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            )}
          </div>
          <p className="text-xs text-v-light-text-secondary dark:text-v-text-secondary whitespace-pre-line leading-snug line-clamp-3">
            {node.description}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-v-light-text-secondary dark:text-v-text-secondary">
            <span>
              {totalAgents} agent{totalAgents === 1 ? '' : 's'}
            </span>
            {totalAgents > 0 && (
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide ${
                  isCollapsedGroup ? 'bg-v-accent/10 text-v-accent' : 'bg-v-light-border/60 dark:bg-v-border/40 text-v-light-text-secondary dark:text-v-text-secondary'
                }`}
              >
                {isCollapsedGroup ? 'Collapsed' : 'Expanded'}
              </span>
            )}
          </div>
        </div>
      );
    }

    const accent = node.agent?.frontmatter.color && colorPalette[node.agent.frontmatter.color] ? colorPalette[node.agent.frontmatter.color] : undefined;
    const toolsState = getToolsState(node.agent?.frontmatter.tools);
    const toolLabel = toolsState.inheritsAll
      ? 'All tools'
      : toolsState.explicitNone
        ? 'No tools'
        : `${toolsState.list.length} tool${toolsState.list.length === 1 ? '' : 's'}`;
    const agentFavorited = Boolean(node.agent?.isFavorite);
    const agentClasses = `${baseClasses} hover:shadow-md cursor-pointer ${
      favoritesFilterActive
        ? agentFavorited
          ? 'ring-2 ring-v-accent/60'
          : 'opacity-60'
        : ''
    }`;

    return (
      <div
        key={node.id}
        data-tour="team-node"
        className={agentClasses}
        style={{
          width: node.width,
          minHeight: node.height,
          left: node.x + layout.offsetX,
          top: node.y + layout.offsetY,
          overflow: 'visible',
          zIndex: nodeZIndex
        }}
        data-stop-pan="true"
        onMouseEnter={handleTooltipEnter}
        onMouseLeave={handleTooltipLeave}
      >
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-2 min-w-0 overflow-hidden">
            {accent ? (
              <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: accent }} aria-hidden="true" />
            ) : (
              <span className="h-2.5 w-2.5 rounded-full flex-shrink-0 border border-v-light-border dark:border-v-border" aria-hidden="true"></span>
            )}
            <p className="text-[13px] font-semibold text-v-light-text-primary dark:text-v-text-primary leading-tight truncate">
              {node.agent?.name || node.label}
            </p>
          </div>
          {node.agent && (
            <button
              type="button"
              data-stop-pan="true"
              onClick={event => {
                event.stopPropagation();
                onToggleFavorite(node.agent!);
              }}
              className={`inline-flex h-6 w-6 items-center justify-center rounded-full border transition-colors ${
                node.agent.isFavorite
                  ? 'border-v-accent text-v-accent bg-v-accent/10 hover:bg-v-accent/20'
                  : 'border-transparent text-v-light-text-secondary dark:text-v-text-secondary hover:text-v-accent'
              }`}
              aria-label={node.agent.isFavorite ? 'Unpin agent' : 'Pin agent'}
            >
              <StarIcon className="h-3.5 w-3.5" filled={Boolean(node.agent.isFavorite)} />
            </button>
          )}
        </div>
        {node.agent && (
          <div
            className={`absolute left-1/2 top-full mt-3 w-64 -translate-x-1/2 transition-opacity duration-150 z-[80] ${
              showTooltip ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
            }`}
            onMouseEnter={handleTooltipEnter}
            onMouseLeave={handleTooltipLeave}
            data-stop-pan="true"
          >
            <div
              className="rounded-2xl border border-v-light-border/80 dark:border-v-border/70 bg-white dark:bg-v-mid-dark shadow-2xl p-4 space-y-2"
            >
              <div className="space-y-1">
                <span className="text-[11px] uppercase tracking-[0.3em] text-v-light-text-secondary dark:text-v-text-secondary block">
                  {scopeLabel}
                </span>
                <p className="text-sm font-semibold text-v-light-text-primary dark:text-v-text-primary">
                  {node.agent.frontmatter.name || node.agent.name}
                </p>
                <p className="text-[12px] text-v-light-text-secondary dark:text-v-text-secondary">
                  {node.agent.frontmatter.model ? `Model · ${node.agent.frontmatter.model}` : 'Model · inherit'}
                </p>
              </div>
              <p className="text-xs text-v-light-text-secondary dark:text-v-text-secondary leading-snug line-clamp-5">
                {node.description}
              </p>
              <div className="text-[11px] uppercase tracking-[0.25em] text-v-light-text-secondary dark:text-v-text-secondary">
                {toolLabel}
              </div>
              <button
                onClick={() => onEdit(node.agent!)}
                className="text-xs font-semibold text-v-accent hover:text-v-accent-hover"
              >
                Inspect
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* View Switcher */}
          <div className="flex items-stretch border border-v-light-border dark:border-v-border rounded-lg overflow-hidden bg-v-light-bg dark:bg-v-dark">
            <button
              onClick={onShowList}
              title="List View"
              className="px-3 py-2 text-sm font-medium transition-colors duration-200 flex items-center gap-1.5 text-v-light-text-secondary dark:text-v-text-secondary hover:text-v-light-text-primary dark:hover:text-v-text-primary hover:bg-v-light-hover dark:hover:bg-v-light-dark"
            >
              <ListIcon className="h-4 w-4" />
              <span className="hidden sm:inline">List</span>
            </button>
            <div className="w-px bg-v-light-border dark:bg-v-border opacity-50"></div>
            <button
              onClick={() => {}}
              title="Swarm View"
              className="px-3 py-2 text-sm font-medium transition-colors duration-200 flex items-center gap-1.5 bg-v-accent/10 text-v-accent"
            >
              <NetworkIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Swarm View</span>
            </button>
            <div className="w-px bg-v-light-border dark:bg-v-border opacity-50"></div>
            <button
              onClick={onShowAnalytics}
              title="Analytics"
              className="px-3 py-2 text-sm font-medium transition-colors duration-200 flex items-center gap-1.5 text-v-light-text-secondary dark:text-v-text-secondary hover:text-v-light-text-primary dark:hover:text-v-text-primary hover:bg-v-light-hover dark:hover:bg-v-light-dark"
            >
              <ChartIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Analytics</span>
            </button>
          </div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-v-light-text-secondary dark:text-v-text-secondary">
            <span>Zoom</span>
            <div className="flex items-center border border-v-light-border dark:border-v-border rounded-md overflow-hidden bg-v-light-bg/60 dark:bg-v-dark/60 h-[34px]">
              <motion.button
                onClick={() => handleZoomChange(-ZOOM_STEP)}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                className="px-3 h-full flex items-center justify-center text-v-light-text-primary dark:text-v-text-primary hover:text-v-accent transition-colors"
                aria-label="Zoom out"
              >
                −
              </motion.button>
              <input
                type="text"
                value={zoomInputValue}
                onChange={event => setZoomInputValue(event.target.value)}
                onFocus={() => setIsEditingZoom(true)}
                onBlur={handleZoomInputCommit}
                onKeyDown={event => {
                  if (event.key === 'Enter') {
                    event.currentTarget.blur();
                  }
                  if (event.key === 'Escape') {
                    setZoomInputValue(formatZoom(zoom));
                    event.currentTarget.blur();
                  }
                }}
                className="w-20 h-full text-center bg-transparent font-semibold tracking-wide text-v-light-text-primary dark:text-v-text-primary focus:outline-none"
                aria-label="Zoom percentage"
              />
              <motion.button
                onClick={() => handleZoomChange(ZOOM_STEP)}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                className="px-3 h-full flex items-center justify-center text-v-light-text-primary dark:text-v-text-primary hover:text-v-accent transition-colors"
                aria-label="Zoom in"
              >
                +
              </motion.button>
            </div>
            <motion.button
              onClick={handleZoomReset}
              whileHover={{ scale: 1 }}
              whileTap={{ scale: 0.98 }}
              className="h-[34px] w-[70px] px-3 border border-v-light-border dark:border-v-border rounded-md text-v-light-text-primary dark:text-v-text-primary hover:bg-v-light-hover dark:hover:bg-v-light-dark hover:border-v-accent transition-colors flex items-center justify-center"
            >
              Reset
            </motion.button>
            <motion.button
              onClick={handleExport}
              disabled={isExporting}
              whileHover={{ scale: 1 }}
              whileTap={{ scale: 0.98 }}
              className="h-[34px] w-[105px] px-3 border border-v-light-border dark:border-v-border rounded-md text-v-light-text-primary dark:text-v-text-primary hover:bg-v-light-hover dark:hover:bg-v-light-dark hover:border-v-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
              title="Export as PNG"
            >
              {isExporting ? (
                <>
                  <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Exporting...
                </>
              ) : (
                <>
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Export
                </>
              )}
            </motion.button>
          </div>
        </div>
        <div data-tour="team-graph">
          <div className="text-xs uppercase tracking-[0.2em] text-v-light-text-secondary dark:text-v-text-secondary mb-1">
            Agents / Swarm View graph
          </div>
          <h1 className="text-2xl font-semibold text-v-light-text-primary dark:text-v-text-primary">
            {userName ? `${userName}'s Organisation` : 'Your Organisation'}
          </h1>
          <p className="text-sm text-v-light-text-secondary dark:text-v-text-secondary">
            Explore your swarm of subagents from a bird&apos;s-eye view.
          </p>
        </div>
        {showEmptyBanner && (
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-dashed border-v-light-border/70 dark:border-v-border/70 bg-white/60 dark:bg-v-mid-dark/40 px-4 py-3 text-sm text-v-light-text-secondary dark:text-v-text-secondary">
            <InfoIcon className="h-4 w-4 flex-shrink-0 text-v-accent" />
            <span className="flex-1 min-w-[200px]">{emptyBannerMessage}</span>
            {showResetCta && (
              <button
                type="button"
                onClick={resetFilters}
                className="text-xs font-semibold text-v-accent hover:text-v-accent-hover"
              >
                Reset filters
              </button>
            )}
          </div>
        )}
      </div>

      <div ref={panelsRef} className="flex flex-col lg:flex-row gap-4">
        <aside
          data-tour="team-filters"
          className="rounded-2xl border border-v-light-border/70 dark:border-v-border/70 bg-v-light-bg/60 dark:bg-v-dark/40 px-4 py-4 space-y-4 lg:w-72 flex-shrink-0 overflow-auto"
          style={maxPanelHeight ? { height: maxPanelHeight } : { minHeight: 420 }}
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[11px] uppercase tracking-[0.3em] text-v-light-text-secondary dark:text-v-text-secondary">
                Filters
              </span>
              {filtersActive && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="text-[11px] font-semibold text-v-accent hover:text-v-accent-hover"
                >
                  Reset filters
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {filterChips.map(({ key, label, icon: Icon, active, onClick }) => (
                <button
                  key={key}
                  type="button"
                  onClick={onClick}
                  className={filterButtonClasses(active)}
                  aria-pressed={active}
                >
                  {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
                  {label}
                </button>
              ))}
            </div>
          </div>
        </aside>
        <div className="flex-1 min-w-0 min-h-0">
          <div
            ref={graphContainerRef}
            className="bg-v-light-surface dark:bg-v-mid-dark border border-v-light-border dark:border-v-border rounded-xl p-5 shadow-inner h-full overflow-hidden"
            style={maxPanelHeight ? { height: maxPanelHeight } : { minHeight: 420 }}
          >
            <div
              ref={viewportRef}
              className={`relative overflow-hidden rounded-lg border border-dashed border-transparent h-full w-full scroll-mt-24 ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
              style={{ touchAction: 'none' }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={(event) => {
                setIsViewportHovered(false);
                handlePointerUp(event);
              }}
              onPointerCancel={handlePointerUp}
              onWheel={handleWheel}
              onPointerEnter={() => setIsViewportHovered(true)}
            >
              <div
                className={`absolute top-4 right-4 z-50 transition-opacity duration-150 ${isViewportHovered ? 'opacity-100' : 'opacity-0'} pointer-events-none`}
              >
                <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-v-light-border/70 dark:border-v-border/70 bg-v-light-bg/80 dark:bg-v-mid-dark/80 backdrop-blur-sm shadow-lg px-2 py-1">
                  <button
                    type="button"
                    onClick={() => handleZoomChange(-ZOOM_STEP)}
                    className="h-8 w-8 flex items-center justify-center rounded-full text-v-light-text-primary dark:text-v-text-primary hover:bg-v-light-hover dark:hover:bg-v-light-dark transition-colors"
                    aria-label="Zoom out"
                  >
                    −
                  </button>
                  <span className="text-xs font-semibold text-v-light-text-primary dark:text-v-text-primary w-12 text-center">
                    {zoomInputValue}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleZoomChange(ZOOM_STEP)}
                    className="h-8 w-8 flex items-center justify-center rounded-full text-v-light-text-primary dark:text-v-text-primary hover:bg-v-light-hover dark:hover:bg-v-light-dark transition-colors"
                    aria-label="Zoom in"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={handleZoomReset}
                    className="ml-1 text-[11px] font-semibold uppercase tracking-wide text-v-accent hover:text-v-accent-hover"
                  >
                    Reset
                  </button>
                </div>
              </div>
              <div
                className="absolute inset-0"
                data-graph-grid="true"
                style={{
                  backgroundImage: `linear-gradient(rgba(148, 163, 184, 0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(148, 163, 184, 0.12) 1px, transparent 1px)` ,
                  backgroundSize: '48px 48px',
                  backgroundPosition: `${pan.x}px ${pan.y}px`,
                  pointerEvents: 'none'
                }}
              ></div>
              <div
                style={{
                  width: layout.canvasWidth,
                  height: layout.canvasHeight,
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                  transformOrigin: 'top left'
                }}
                className="relative"
                data-tour="team-node-area"
                data-graph-canvas="true"
              >
                <svg
                  width={layout.canvasWidth}
                  height={layout.canvasHeight}
                  className="absolute inset-0 pointer-events-none"
                >
                  {layout.links.map(link => {
                    const startX = link.from.centerX + layout.offsetX;
                    const startY = link.from.centerY + layout.offsetY + link.from.height / 2;
                    const endX = link.to.centerX + layout.offsetX;
                    const endY = link.to.centerY + layout.offsetY - link.to.height / 2;
                    const midY = (startY + endY) / 2;
                    return (
                      <path
                        key={`${link.from.id}-${link.to.id}`}
                        d={`M${startX},${startY} C${startX},${midY} ${endX},${midY} ${endX},${endY}`}
                        stroke="rgba(148, 163, 184, 0.35)"
                        strokeWidth={1.5}
                        fill="none"
                      />
                    );
                  })}
                </svg>
                {layout.nodes.map(renderNode)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
