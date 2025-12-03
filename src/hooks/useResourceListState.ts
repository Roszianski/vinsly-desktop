import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { getStorageItem, setStorageItem } from '../utils/storage';
import { fuzzyMatch } from '../utils/fuzzyMatch';

/**
 * Common layout modes for resource lists
 */
export type LayoutMode = 'table' | 'grid';

/**
 * Common sort directions
 */
export type SortDirection = 'asc' | 'desc';

/**
 * Configuration for the resource list state hook
 */
export interface ResourceListStateConfig<T, TFilter extends string = string> {
  /** Storage key for persisting layout mode */
  layoutStorageKey: string;
  /** Default filter value */
  defaultFilter: TFilter;
  /** Default sort criteria */
  defaultSort: string;
  /** Function to get filterable text from an item for search */
  getSearchableText: (item: T) => string[];
  /** Function to check if item matches the current filter */
  filterItem: (item: T, filter: TFilter) => boolean;
  /** Function to sort items */
  sortItems: (a: T, b: T, sortCriteria: string) => number;
  /** Function to check if item is favorite (for priority sorting) */
  isFavorite?: (item: T) => boolean;
  /** Threshold for enabling virtualization */
  virtualizationThreshold?: number;
}

/**
 * Result of the resource list state hook
 */
export interface ResourceListStateResult<T, TFilter extends string = string> {
  // State
  filter: TFilter;
  searchQuery: string;
  sortCriteria: string;
  layoutMode: LayoutMode;
  layoutLoaded: boolean;
  selectedIds: Set<string>;
  showDeleteConfirm: boolean;

  // Computed
  processedItems: T[];
  areAllSelected: boolean;
  isIndeterminate: boolean;
  shouldVirtualize: boolean;

  // Actions
  setFilter: (filter: TFilter) => void;
  setSearchQuery: (query: string) => void;
  setSortCriteria: (criteria: string) => void;
  setLayoutMode: (mode: LayoutMode) => void;
  setShowDeleteConfirm: (show: boolean) => void;
  toggleSelection: (id: string) => void;
  toggleSelectAll: () => void;
  clearSelection: () => void;
  selectAllCheckboxRef: React.RefObject<HTMLInputElement | null>;
}

// Session cache for layout mode
const sessionLayoutCache = new Map<string, LayoutMode>();

/**
 * Hook for managing common list state across resource list screens
 * Handles filtering, searching, sorting, selection, and layout persistence
 */
export function useResourceListState<T extends { id: string }, TFilter extends string = string>(
  items: T[],
  config: ResourceListStateConfig<T, TFilter>
): ResourceListStateResult<T, TFilter> {
  const {
    layoutStorageKey,
    defaultFilter,
    defaultSort,
    getSearchableText,
    filterItem,
    sortItems,
    isFavorite,
    virtualizationThreshold = 100,
  } = config;

  // State
  const [filter, setFilter] = useState<TFilter>(defaultFilter);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortCriteria, setSortCriteria] = useState(defaultSort);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('table');
  const [layoutLoaded, setLayoutLoaded] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const selectAllCheckboxRef = useRef<HTMLInputElement>(null);

  // Load layout mode from storage
  useEffect(() => {
    const loadLayoutMode = async () => {
      // Check session cache first
      const cached = sessionLayoutCache.get(layoutStorageKey);
      if (cached) {
        setLayoutMode(cached);
        setLayoutLoaded(true);
        return;
      }

      // Then check persistent storage
      const stored = await getStorageItem<LayoutMode>(layoutStorageKey);
      if (stored === 'grid' || stored === 'table') {
        sessionLayoutCache.set(layoutStorageKey, stored);
        setLayoutMode(stored);
      }
      setLayoutLoaded(true);
    };
    loadLayoutMode();
  }, [layoutStorageKey]);

  // Persist layout mode changes
  useEffect(() => {
    if (!layoutLoaded) return;
    sessionLayoutCache.set(layoutStorageKey, layoutMode);
    setStorageItem(layoutStorageKey, layoutMode);
  }, [layoutMode, layoutLoaded, layoutStorageKey]);

  // Listen for global view change events
  useEffect(() => {
    const handleViewChange = (event: CustomEvent<{ view: LayoutMode }>) => {
      setLayoutMode(event.detail.view);
    };

    window.addEventListener('vinsly-view-change', handleViewChange as EventListener);
    return () => {
      window.removeEventListener('vinsly-view-change', handleViewChange as EventListener);
    };
  }, []);

  // Clear selection when filter/search/sort changes
  useEffect(() => {
    setSelectedIds(new Set());
  }, [searchQuery, filter, sortCriteria]);

  // Process items (filter, search, sort)
  const processedItems = useMemo(() => {
    const filtered = items.filter(item => {
      // Apply filter
      if (!filterItem(item, filter)) return false;

      // Apply search
      if (searchQuery) {
        const searchableTexts = getSearchableText(item);
        const hasMatch = searchableTexts.some(text =>
          text && fuzzyMatch(text, searchQuery)
        );
        if (!hasMatch) return false;
      }

      return true;
    });

    // Sort items
    return filtered.slice().sort((a, b) => {
      // Favorites first if supported
      if (isFavorite) {
        const favoriteDelta = Number(isFavorite(b)) - Number(isFavorite(a));
        if (favoriteDelta !== 0) return favoriteDelta;
      }

      return sortItems(a, b, sortCriteria);
    });
  }, [items, filter, searchQuery, sortCriteria, filterItem, getSearchableText, sortItems, isFavorite]);

  // Selection state
  const areAllSelected = processedItems.length > 0 && selectedIds.size === processedItems.length;
  const isIndeterminate = selectedIds.size > 0 && !areAllSelected;
  const shouldVirtualize = layoutMode === 'table' && processedItems.length >= virtualizationThreshold;

  // Update indeterminate state on checkbox
  useEffect(() => {
    if (selectAllCheckboxRef.current) {
      selectAllCheckboxRef.current.indeterminate = isIndeterminate;
    }
  }, [isIndeterminate]);

  // Actions
  const toggleSelection = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (areAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(processedItems.map(item => item.id)));
    }
  }, [areAllSelected, processedItems]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  return {
    // State
    filter,
    searchQuery,
    sortCriteria,
    layoutMode,
    layoutLoaded,
    selectedIds,
    showDeleteConfirm,

    // Computed
    processedItems,
    areAllSelected,
    isIndeterminate,
    shouldVirtualize,

    // Actions
    setFilter,
    setSearchQuery,
    setSortCriteria,
    setLayoutMode,
    setShowDeleteConfirm,
    toggleSelection,
    toggleSelectAll,
    clearSelection,
    selectAllCheckboxRef,
  };
}

/**
 * Create a filter function for scope-based filtering
 */
export function createScopeFilter<T extends { scope: string }>(
  scopeEnum: Record<string, string>
) {
  return (item: T, filter: string): boolean => {
    if (filter === 'All') return true;
    return item.scope === filter;
  };
}

/**
 * Create a sort function for common sort criteria
 */
export function createNameSorter<T extends { name: string }>(
  additionalSorters?: Record<string, (a: T, b: T) => number>
) {
  return (a: T, b: T, sortCriteria: string): number => {
    switch (sortCriteria) {
      case 'name-asc':
        return a.name.localeCompare(b.name);
      case 'name-desc':
        return b.name.localeCompare(a.name);
      default:
        if (additionalSorters && sortCriteria in additionalSorters) {
          return additionalSorters[sortCriteria](a, b);
        }
        return 0;
    }
  };
}
