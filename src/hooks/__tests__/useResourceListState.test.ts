import { renderHook, act } from '@testing-library/react';
import {
  useResourceListState,
  createScopeFilter,
  createNameSorter,
  ResourceListStateConfig,
} from '../useResourceListState';

// Mock storage
jest.mock('../../utils/storage', () => ({
  getStorageItem: jest.fn().mockResolvedValue(null),
  setStorageItem: jest.fn().mockResolvedValue(undefined),
}));

// Mock fuzzyMatch
jest.mock('../../utils/fuzzyMatch', () => ({
  fuzzyMatch: (text: string, query: string) =>
    text?.toLowerCase().includes(query.toLowerCase()),
}));

interface TestItem {
  id: string;
  name: string;
  scope: 'global' | 'project';
  description: string;
  isFavorite?: boolean;
}

const createTestConfig = (): ResourceListStateConfig<TestItem, 'All' | 'global' | 'project'> => ({
  layoutStorageKey: 'test-layout',
  defaultFilter: 'All',
  defaultSort: 'name-asc',
  getSearchableText: (item) => [item.name, item.description],
  filterItem: createScopeFilter({ global: 'global', project: 'project' }),
  sortItems: createNameSorter(),
  isFavorite: (item) => item.isFavorite ?? false,
});

const createTestItems = (): TestItem[] => [
  { id: '1', name: 'Alpha', scope: 'global', description: 'First item' },
  { id: '2', name: 'Beta', scope: 'project', description: 'Second item' },
  { id: '3', name: 'Gamma', scope: 'global', description: 'Third item', isFavorite: true },
  { id: '4', name: 'Delta', scope: 'project', description: 'Fourth item' },
];

describe('useResourceListState', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initial state', () => {
    it('should have correct default values', () => {
      const { result } = renderHook(() =>
        useResourceListState(createTestItems(), createTestConfig())
      );

      expect(result.current.filter).toBe('All');
      expect(result.current.searchQuery).toBe('');
      expect(result.current.sortCriteria).toBe('name-asc');
      expect(result.current.layoutMode).toBe('table');
      expect(result.current.selectedIds.size).toBe(0);
      expect(result.current.showDeleteConfirm).toBe(false);
    });

    it('should process all items with default filter', () => {
      const items = createTestItems();
      const { result } = renderHook(() =>
        useResourceListState(items, createTestConfig())
      );

      // Should have all 4 items, with favorites first
      expect(result.current.processedItems).toHaveLength(4);
      // Gamma (favorite) should be first
      expect(result.current.processedItems[0].id).toBe('3');
    });
  });

  describe('filtering', () => {
    it('should filter by scope', () => {
      const items = createTestItems();
      const { result } = renderHook(() =>
        useResourceListState(items, createTestConfig())
      );

      act(() => {
        result.current.setFilter('global');
      });

      expect(result.current.processedItems).toHaveLength(2);
      expect(result.current.processedItems.every(item => item.scope === 'global')).toBe(true);
    });

    it('should filter by search query', () => {
      const items = createTestItems();
      const { result } = renderHook(() =>
        useResourceListState(items, createTestConfig())
      );

      act(() => {
        result.current.setSearchQuery('alpha');
      });

      expect(result.current.processedItems).toHaveLength(1);
      expect(result.current.processedItems[0].name).toBe('Alpha');
    });

    it('should search in description', () => {
      const items = createTestItems();
      const { result } = renderHook(() =>
        useResourceListState(items, createTestConfig())
      );

      act(() => {
        result.current.setSearchQuery('second');
      });

      expect(result.current.processedItems).toHaveLength(1);
      expect(result.current.processedItems[0].name).toBe('Beta');
    });

    it('should combine filter and search', () => {
      const items = createTestItems();
      const { result } = renderHook(() =>
        useResourceListState(items, createTestConfig())
      );

      act(() => {
        result.current.setFilter('global');
        result.current.setSearchQuery('alpha');
      });

      expect(result.current.processedItems).toHaveLength(1);
      expect(result.current.processedItems[0].name).toBe('Alpha');
    });
  });

  describe('sorting', () => {
    it('should sort by name ascending', () => {
      const items = createTestItems();
      const { result } = renderHook(() =>
        useResourceListState(items, createTestConfig())
      );

      // Favorites first, then alphabetical
      const nonFavorites = result.current.processedItems.filter(i => !i.isFavorite);
      expect(nonFavorites[0].name).toBe('Alpha');
      expect(nonFavorites[1].name).toBe('Beta');
      expect(nonFavorites[2].name).toBe('Delta');
    });

    it('should sort by name descending', () => {
      const items = createTestItems();
      const { result } = renderHook(() =>
        useResourceListState(items, createTestConfig())
      );

      act(() => {
        result.current.setSortCriteria('name-desc');
      });

      const nonFavorites = result.current.processedItems.filter(i => !i.isFavorite);
      expect(nonFavorites[0].name).toBe('Delta');
      expect(nonFavorites[1].name).toBe('Beta');
      expect(nonFavorites[2].name).toBe('Alpha');
    });

    it('should always put favorites first regardless of sort', () => {
      const items = createTestItems();
      const { result } = renderHook(() =>
        useResourceListState(items, createTestConfig())
      );

      // First item should always be Gamma (the favorite)
      expect(result.current.processedItems[0].id).toBe('3');

      act(() => {
        result.current.setSortCriteria('name-desc');
      });

      expect(result.current.processedItems[0].id).toBe('3');
    });
  });

  describe('selection', () => {
    it('should toggle individual selection', () => {
      const items = createTestItems();
      const { result } = renderHook(() =>
        useResourceListState(items, createTestConfig())
      );

      act(() => {
        result.current.toggleSelection('1');
      });

      expect(result.current.selectedIds.has('1')).toBe(true);
      expect(result.current.selectedIds.size).toBe(1);

      act(() => {
        result.current.toggleSelection('1');
      });

      expect(result.current.selectedIds.has('1')).toBe(false);
      expect(result.current.selectedIds.size).toBe(0);
    });

    it('should select all items', () => {
      const items = createTestItems();
      const { result } = renderHook(() =>
        useResourceListState(items, createTestConfig())
      );

      act(() => {
        result.current.toggleSelectAll();
      });

      expect(result.current.selectedIds.size).toBe(4);
      expect(result.current.areAllSelected).toBe(true);
    });

    it('should deselect all when all are selected', () => {
      const items = createTestItems();
      const { result } = renderHook(() =>
        useResourceListState(items, createTestConfig())
      );

      act(() => {
        result.current.toggleSelectAll();
      });

      expect(result.current.areAllSelected).toBe(true);

      act(() => {
        result.current.toggleSelectAll();
      });

      expect(result.current.selectedIds.size).toBe(0);
      expect(result.current.areAllSelected).toBe(false);
    });

    it('should clear selection when filter changes', () => {
      const items = createTestItems();
      const { result } = renderHook(() =>
        useResourceListState(items, createTestConfig())
      );

      act(() => {
        result.current.toggleSelection('1');
        result.current.toggleSelection('2');
      });

      expect(result.current.selectedIds.size).toBe(2);

      act(() => {
        result.current.setFilter('global');
      });

      expect(result.current.selectedIds.size).toBe(0);
    });

    it('should show indeterminate state for partial selection', () => {
      const items = createTestItems();
      const { result } = renderHook(() =>
        useResourceListState(items, createTestConfig())
      );

      act(() => {
        result.current.toggleSelection('1');
      });

      expect(result.current.isIndeterminate).toBe(true);
      expect(result.current.areAllSelected).toBe(false);
    });
  });

  describe('layout mode', () => {
    it('should change layout mode', () => {
      const items = createTestItems();
      const { result } = renderHook(() =>
        useResourceListState(items, createTestConfig())
      );

      expect(result.current.layoutMode).toBe('table');

      act(() => {
        result.current.setLayoutMode('grid');
      });

      expect(result.current.layoutMode).toBe('grid');
    });
  });

  describe('virtualization', () => {
    it('should enable virtualization for large lists in table mode', () => {
      const items = Array.from({ length: 150 }, (_, i) => ({
        id: `${i}`,
        name: `Item ${i}`,
        scope: 'global' as const,
        description: `Description ${i}`,
      }));

      const { result } = renderHook(() =>
        useResourceListState(items, createTestConfig())
      );

      expect(result.current.shouldVirtualize).toBe(true);
    });

    it('should disable virtualization for small lists', () => {
      const items = createTestItems();
      const { result } = renderHook(() =>
        useResourceListState(items, createTestConfig())
      );

      expect(result.current.shouldVirtualize).toBe(false);
    });

    it('should disable virtualization in grid mode', () => {
      const items = Array.from({ length: 150 }, (_, i) => ({
        id: `${i}`,
        name: `Item ${i}`,
        scope: 'global' as const,
        description: `Description ${i}`,
      }));

      const { result } = renderHook(() =>
        useResourceListState(items, createTestConfig())
      );

      act(() => {
        result.current.setLayoutMode('grid');
      });

      expect(result.current.shouldVirtualize).toBe(false);
    });
  });
});
