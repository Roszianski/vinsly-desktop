# Phase 2: Incremental Refactoring Guide

Practical step-by-step guide for adopting the Resource system in existing code.

## Current State Analysis

**AgentListScreen.tsx** (768 lines) and **SkillListScreen.tsx** have:
- ✅ Complex virtualization logic (lines 235-256)
- ✅ Custom fuzzyMatch filtering (line 128)
- ✅ Favorites-first sorting (lines 133-158)
- ✅ Bulk operations (select, delete, export)
- ✅ Layout switching (table/grid)
- ⚠️ **Duplicate filter/sort logic** between Agent and Skill screens
- ⚠️ **Duplicate list item components** (AgentListItem vs SkillListItem)

## Recommended Incremental Approach

### Step 1: Use Resource Operations for Duplicate (15 mins)

**Current Code** (AgentListScreen.tsx would call):
```typescript
const handleDuplicate = async (agent: Agent) => {
  // Manual duplicate logic scattered across components
  const duplicate = { ...agent, id: newId, name: `${agent.name} (Copy)` };
  await saveAgent(duplicate);
};
```

**Refactored Code**:
```typescript
import { useResourceWorkspace } from '../hooks/useResourceWorkspace';
import { ResourceType } from '../types/resource';

// In component
const workspace = useWorkspace({...});
const resourceOps = useResourceWorkspace(workspace);

const handleDuplicate = async (agent: Agent) => {
  // Generic operation - works for both agents and skills
  const duplicate = resourceOps.duplicate(agent, ResourceType.Agent);
  await workspace.saveAgent(duplicate);
};
```

**Benefits**:
- ✅ Automatic unique name generation
- ✅ Consistent behavior across agents and skills
- ✅ 40 lines → 3 lines (92% reduction)

---

### Step 2: Optional Resource-based Filtering (30 mins)

**Current Code** (AgentListScreen.tsx lines 124-131):
```typescript
const filtered = agents.filter(agent => {
  const scopeMatch = filter === 'All' || agent.scope === filter;
  const searchMatch = !searchQuery ||
    fuzzyMatch(agent.name, searchQuery) ||
    fuzzyMatch(agent.frontmatter.description, searchQuery);
  return scopeMatch && searchMatch;
});
```

**Option A: Keep Existing** (if fuzzyMatch is important)
```typescript
// Keep existing filter logic - it's fine!
const filtered = agents.filter(agent => {
  const scopeMatch = filter === 'All' || agent.scope === filter;
  const searchMatch = !searchQuery || resourceOps.filter([agent], searchQuery).length > 0;
  return scopeMatch && searchMatch;
});
```

**Option B: Use Resource Filter** (simpler, but different matching):
```typescript
import { filterResources } from '../utils/resourceOperations';

// Simple scope filter first
const scopeFiltered = filter === 'All'
  ? agents
  : agents.filter(a => a.scope === filter);

// Then use generic resource filter
const filtered = filterResources(scopeFiltered, searchQuery);
```

**Recommendation**: **Keep existing filter** if fuzzyMatch is important. The resource filter is exact match, not fuzzy.

---

### Step 3: Use Resource-based Sorting (15 mins)

**Current Code** (AgentListScreen.tsx lines 133-158):
```typescript
const sorted = filtered.slice().sort((a, b) => {
  // Favorites first
  const favoriteDelta = Number(Boolean(b.isFavorite)) - Number(Boolean(a.isFavorite));
  if (favoriteDelta !== 0) return favoriteDelta;

  // Then by criteria
  switch (sortCriteria) {
    case 'name-asc': return a.name.localeCompare(b.name);
    case 'name-desc': return b.name.localeCompare(a.name);
    case 'scope': return a.scope.localeCompare(b.scope);
    case 'model': {
      const modelA = a.frontmatter.model || 'default';
      const modelB = b.frontmatter.model || 'default';
      return modelA.localeCompare(modelB);
    }
    default: return 0;
  }
});
```

**Refactored Code**:
```typescript
import { sortResources } from '../utils/resourceOperations';

// Resource operations handle favorites-first automatically!
const sorted = sortResources(filtered, sortField, sortDirection);
```

**Note**: Resource sort currently supports 'name', 'scope', but not 'model'. You could:
1. **Keep existing sort** for now (it's fine!)
2. **Extend resourceOperations.ts** to support model sorting
3. **Mix approaches**: Use resource sort for name/scope, keep custom for model

---

### Step 4: Share Logic Between Agent & Skill Screens (1 hour)

Both screens have nearly identical code. You can:

**Option A: Create Shared Hook** (recommended)
```typescript
// hooks/useResourceListScreen.ts
export function useResourceListScreen<T extends Agent | Skill>(
  items: T[],
  type: ResourceType
) {
  const workspace = useWorkspace({...});
  const resourceOps = useResourceWorkspace(workspace);

  const [filter, setFilter] = useState<Filter>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortCriteria, setSortCriteria] = useState<SortCriteria>('name-asc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const processedItems = useMemo(() => {
    // Shared filter/sort logic
    let result = items;

    // Apply filter
    if (filter !== 'All') {
      result = result.filter(item => item.scope === filter);
    }

    // Apply search (use existing fuzzyMatch or resource filter)
    if (searchQuery) {
      result = resourceOps.filter(result, searchQuery);
    }

    // Apply sort
    result = resourceOps.sort(result, sortField, sortDirection);

    return result;
  }, [items, filter, searchQuery, sortCriteria]);

  const handleDuplicate = useCallback((item: T) => {
    const duplicate = resourceOps.duplicate(item, type);
    // Save logic...
  }, [resourceOps, type]);

  return {
    filter, setFilter,
    searchQuery, setSearchQuery,
    sortCriteria, setSortCriteria,
    selectedIds, setSelectedIds,
    processedItems,
    handleDuplicate,
  };
}
```

Then in AgentListScreen:
```typescript
const {
  filter, setFilter,
  searchQuery, setSearchQuery,
  processedItems,
  handleDuplicate,
} = useResourceListScreen(agents, ResourceType.Agent);
```

And in SkillListScreen:
```typescript
const {
  filter, setFilter,
  searchQuery, setSearchQuery,
  processedItems,
  handleDuplicate,
} = useResourceListScreen(skills, ResourceType.Skill);
```

**Benefits**:
- ✅ Share logic between agent and skill screens
- ✅ Single source of truth for list behavior
- ✅ Easier to maintain and test

---

## Incremental Adoption Timeline

### Week 1: Low-Hanging Fruit (2 hours)
- [x] Create resource system infrastructure (Phase 2 foundation)
- [ ] Refactor duplicate operations to use `resourceOps.duplicate()`
- [ ] Test duplicate works for both agents and skills

### Week 2: Shared Logic (4 hours)
- [ ] Extract shared filter/sort logic to `useResourceListScreen` hook
- [ ] Update AgentListScreen to use shared hook
- [ ] Update SkillListScreen to use shared hook
- [ ] Test both screens work identically

### Week 3: UI Consolidation (6 hours) - OPTIONAL
- [ ] Evaluate if table-based list items can be unified
- [ ] If yes, create generic ResourceTableItem component
- [ ] Gradually replace AgentListItem/SkillListItem usage
- [ ] If no, keep separate components (that's fine!)

### Week 4: Testing & Polish (2 hours)
- [ ] Comprehensive testing of all refactored components
- [ ] Performance testing (ensure no regression)
- [ ] Update documentation
- [ ] Celebrate reduced code! 🎉

---

## What NOT to Refactor

Some things are intentionally **NOT** worth refactoring:

1. **Virtualization logic** - Complex, works well, leave it alone
2. **Layout switching** - Screen-specific feature, keep as-is
3. **Export/Import** - Type-specific operations, different formats
4. **Bulk operations** - Already generic enough
5. **Menu positioning** - Complex portal logic, not worth touching

---

## Code Reduction Potential

| Component | Current | After Refactor | Reduction |
|-----------|---------|----------------|-----------|
| Duplicate logic | ~40 lines × 2 | 3 lines × 1 | **95%** |
| Filter/sort | ~60 lines × 2 | Shared hook ~60 lines | **50%** |
| List screens | 768 + 750 lines | 768 + 750 (same) | **0%** ⚠️ |

**Note**: List screens stay the same size because they have unique features (virtualization, bulk ops, etc). The benefit is in **shared logic**, not line count.

---

## Real-World Example: Duplicate Refactor

### Before (in App.tsx or AgentListScreen)
```typescript
const handleDuplicateAgent = async (agent: Agent) => {
  const existingNames = agents.map(a => a.name);
  let newName = `${agent.name} (Copy)`;
  let counter = 2;

  while (existingNames.includes(newName)) {
    newName = `${agent.name} (Copy ${counter})`;
    counter++;
  }

  const newId = `${agent.path.replace(/\.md$/, '')}-copy-${Date.now()}.md`;
  const duplicate: Agent = {
    ...agent,
    id: newId,
    name: newName,
    path: newId,
    frontmatter: {
      ...agent.frontmatter,
      name: newName,
    },
    isFavorite: false,
  };

  await saveAgent(duplicate);
  showToast('success', `Duplicated agent "${agent.name}"`);
};

const handleDuplicateSkill = async (skill: Skill) => {
  const existingNames = skills.map(s => s.name);
  let newName = `${skill.name} (Copy)`;
  let counter = 2;

  while (existingNames.includes(newName)) {
    newName = `${skill.name} (Copy ${counter})`;
    counter++;
  }

  const newId = `${skill.directoryPath}-copy-${Date.now()}`;
  const duplicate: Skill = {
    ...skill,
    id: newId,
    name: newName,
    directoryPath: newId,
    path: `${newId}/skill.md`,
    frontmatter: {
      ...skill.frontmatter,
      name: newName,
    },
    isFavorite: false,
  };

  await saveSkill(duplicate);
  showToast('success', `Duplicated skill "${skill.name}"`);
};
```

**Total: ~80 lines of duplicate code**

---

### After (using Resource system)
```typescript
import { useResourceWorkspace } from './hooks/useResourceWorkspace';
import { ResourceType } from './types/resource';

const workspace = useWorkspace({...});
const resourceOps = useResourceWorkspace(workspace);

const handleDuplicateAgent = async (agent: Agent) => {
  const duplicate = resourceOps.duplicate(agent, ResourceType.Agent);
  await workspace.saveAgent(duplicate);
  showToast('success', `Duplicated agent "${agent.name}"`);
};

const handleDuplicateSkill = async (skill: Skill) => {
  const duplicate = resourceOps.duplicate(skill, ResourceType.Skill);
  await workspace.saveSkill(duplicate);
  showToast('success', `Duplicated skill "${skill.name}"`);
};
```

**Total: ~14 lines shared code**

**Savings: 80 → 14 lines (82% reduction)** 🎉

---

## Testing Strategy

After each refactor step, test:

1. **Duplicate**
   - [ ] Creates unique name correctly
   - [ ] Works for both agents and skills
   - [ ] Handles edge cases (Copy, Copy 2, Copy 3...)

2. **Filter**
   - [ ] Searches by name
   - [ ] Searches by description
   - [ ] Case-insensitive matching
   - [ ] Works with fuzzyMatch (if kept)

3. **Sort**
   - [ ] Favorites always first
   - [ ] Name ascending/descending
   - [ ] Scope sorting
   - [ ] Model sorting (if implemented)

4. **Integration**
   - [ ] No performance regression
   - [ ] All existing features still work
   - [ ] No visual changes (unless intentional)

---

## Rollback Plan

If issues arise during refactoring:

1. **Git branch** - Do all refactoring in a feature branch
2. **Incremental commits** - Commit after each successful step
3. **Easy rollback** - Can cherry-pick good changes, revert bad ones
4. **Testing** - Test thoroughly before merging to main

---

## Success Metrics

✅ **Quantitative**:
- 80% code reduction in duplicate logic
- 50% code reduction in filter/sort logic
- Single source of truth for operations
- No performance regression

✅ **Qualitative**:
- Easier to add new features (work for both agents and skills automatically)
- Easier to fix bugs (fix once, works everywhere)
- Easier for new developers to understand
- Reduced maintenance burden

---

## Next Steps

1. ✅ **Phase 2 foundation complete** - Resource types, config, operations
2. 👉 **Start with duplicate** - Low risk, high impact, easy win
3. 🔜 **Add shared hook** - Consolidate filter/sort logic
4. 🔜 **Optional UI consolidation** - Only if beneficial

Remember: **Incremental adoption is the key**. You don't have to refactor everything at once!
