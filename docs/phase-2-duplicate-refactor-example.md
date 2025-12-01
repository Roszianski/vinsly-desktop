# Duplicate Operation Refactor - Practical Example

This guide shows **exactly** how to refactor the duplicate operation in App.tsx using the Resource system.

## Step 1: Find Current Duplicate Logic

Look for `handleDuplicateAgent` and `handleDuplicateSkill` in App.tsx (around lines 200-250, search for "duplicate"):

```typescript
const handleDuplicateAgent = async (agent: Agent) => {
  // Current implementation generates unique name manually
  const existingAgents = agents;
  let baseName = agent.name;
  let newName = `${baseName} (Copy)`;
  let counter = 2;

  const existingNames = new Set(existingAgents.map(a => a.name));
  while (existingNames.has(newName)) {
    newName = `${baseName} (Copy ${counter})`;
    counter++;
  }

  // Create duplicate with new name
  const timestamp = Date.now();
  const sanitized = newName.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
  const newId = agent.scope === AgentScope.Global
    ? `~/.claude/agents/${sanitized}-${timestamp}.md`
    : `.claude/agents/${sanitized}-${timestamp}.md`;

  const duplicateAgent: Agent = {
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

  await saveAgent(duplicateAgent);
  showToast('success', `Created duplicate: "${newName}"`);
};

const handleDuplicateSkill = async (skill: Skill) => {
  // DUPLICATE CODE - same logic for skills
  const existingSkills = skills;
  let baseName = skill.name;
  let newName = `${baseName} (Copy)`;
  let counter = 2;

  const existingNames = new Set(existingSkills.map(s => s.name));
  while (existingNames.has(newName)) {
    newName = `${baseName} (Copy ${counter})`;
    counter++;
  }

  // Create duplicate skill
  const timestamp = Date.now();
  const sanitized = newName.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
  const newDirPath = skill.scope === AgentScope.Global
    ? `~/.claude/skills/${sanitized}-${timestamp}`
    : `.claude/skills/${sanitized}-${timestamp}`;

  const duplicateSkill: Skill = {
    ...skill,
    id: newDirPath,
    name: newName,
    directoryPath: newDirPath,
    path: `${newDirPath}/skill.md`,
    frontmatter: {
      ...skill.frontmatter,
      name: newName,
    },
    isFavorite: false,
    hasAssets: skill.hasAssets,
  };

  await saveSkill(duplicateSkill);
  showToast('success', `Created duplicate: "${newName}"`);
};
```

## Step 2: Add Resource System Import

At the top of App.tsx, add these imports:

```typescript
// Add to existing imports at top of file
import { useResourceWorkspace } from './hooks/useResourceWorkspace';
import { ResourceType } from './types/resource';
```

## Step 3: Initialize Resource Operations

In the App component, after initializing `workspace`, add:

```typescript
function App() {
  // Existing hooks
  const workspace = useWorkspace({
    showToast,
    // ... other config
  });

  // NEW: Add resource operations wrapper
  const resourceOps = useResourceWorkspace(workspace);

  // ... rest of component
}
```

## Step 4: Replace Duplicate Functions

Replace both `handleDuplicateAgent` and `handleDuplicateSkill` with:

```typescript
const handleDuplicateAgent = async (agent: Agent) => {
  // Use generic resource duplicate operation
  const duplicate = resourceOps.duplicate(agent, ResourceType.Agent);

  // Save using existing workspace method
  await saveAgent(duplicate);

  // Show success message
  showToast('success', `Created duplicate: "${duplicate.name}"`);
};

const handleDuplicateSkill = async (skill: Skill) => {
  // Same pattern for skills!
  const duplicate = resourceOps.duplicate(skill, ResourceType.Skill);

  await saveSkill(duplicate);

  showToast('success', `Created duplicate: "${duplicate.name}"`);
};
```

## Code Comparison

### Before
```typescript
// handleDuplicateAgent: ~35 lines
// handleDuplicateSkill: ~35 lines
// Total: ~70 lines
```

### After
```typescript
// handleDuplicateAgent: ~6 lines
// handleDuplicateSkill: ~6 lines
// Total: ~12 lines
```

**Reduction: 70 → 12 lines (83% reduction)** 🎉

## What the Resource System Handles Automatically

When you call `resourceOps.duplicate(item, type)`, it automatically:

1. ✅ Generates unique name ("Copy", "Copy 2", "Copy 3", etc.)
2. ✅ Checks against existing items to avoid conflicts
3. ✅ Creates new ID based on resource type (file path for agents, directory for skills)
4. ✅ Resets `isFavorite` to false
5. ✅ Updates frontmatter name
6. ✅ Handles both Agent and Skill types with same code

## Testing the Refactor

After making the changes:

1. **Test Agent Duplication**:
   - Duplicate an agent
   - Verify it creates "Agent Name (Copy)"
   - Duplicate again
   - Verify it creates "Agent Name (Copy 2)"

2. **Test Skill Duplication**:
   - Same tests for skills
   - Verify directory structure is correct

3. **Test Edge Cases**:
   - Duplicate an agent named "Test (Copy)"
   - Should create "Test (Copy) (Copy)", not "Test (Copy 2)"

## What NOT to Change

Keep these parts unchanged:

```typescript
// Keep existing save logic
await saveAgent(duplicate);
await saveSkill(duplicate);

// Keep existing toast messages
showToast('success', `Created duplicate: "${duplicate.name}"`);

// Keep existing workspace setup
const workspace = useWorkspace({...});
```

## Complete Example

Here's the full refactored code in context:

```typescript
import { useResourceWorkspace } from './hooks/useResourceWorkspace';
import { ResourceType } from './types/resource';

function App() {
  const { showToast } = useToast();

  const workspace = useWorkspace({
    showToast,
    scanSettingsRef,
    licenseInfo,
    onScanComplete: () => {
      // ...
    },
  });

  // NEW: Initialize resource operations
  const resourceOps = useResourceWorkspace(workspace);

  // REFACTORED: Duplicate handlers
  const handleDuplicateAgent = async (agent: Agent) => {
    const duplicate = resourceOps.duplicate(agent, ResourceType.Agent);
    await saveAgent(duplicate);
    showToast('success', `Created duplicate: "${duplicate.name}"`);
  };

  const handleDuplicateSkill = async (skill: Skill) => {
    const duplicate = resourceOps.duplicate(skill, ResourceType.Skill);
    await saveSkill(duplicate);
    showToast('success', `Created duplicate: "${duplicate.name}"`);
  };

  // ... rest of App.tsx
}
```

## Benefits Achieved

✅ **Less Code**: 83% reduction in duplicate logic
✅ **Consistency**: Same behavior for agents and skills
✅ **Maintainability**: Fix bugs in one place
✅ **Type Safety**: TypeScript ensures correct usage
✅ **Extensibility**: Add new resource types easily

## Time Investment

- **Reading this guide**: 5 minutes
- **Making the changes**: 10 minutes
- **Testing**: 5 minutes
- **Total**: ~20 minutes

## Next Step

After completing this refactor, consider:
- Step 2: Refactor filter/sort operations (see `phase-2-incremental-refactoring.md`)
- Step 3: Create shared hook for list screen logic
- Step 4: Optional UI consolidation

**Remember**: This is just Step 1. You've already achieved significant code reduction! 🎉
