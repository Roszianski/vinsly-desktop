# Undo/Redo System Integration Guide

Complete guide for integrating the undo/redo system into Vinsly Desktop.

## Overview

The undo/redo system provides:
- **Command Pattern** - Reversible operations
- **History Stack** - Up to 20 undoable actions
- **Keyboard Shortcuts** - Cmd+Z (undo), Cmd+Shift+Z (redo)
- **Toast Actions** - "Undo" button in notifications
- **Type Safety** - Full TypeScript support

## Quick Start

### 1. Add useHistory to App.tsx

```typescript
import { useHistory } from './hooks/useHistory';
import { useKeyboardShortcuts, CommonShortcuts } from './hooks/useKeyboardShortcuts';

function App() {
  const { showToast } = useToast();

  // Initialize history
  const history = useHistory({
    maxStackSize: 20,
    onStackChange: (canUndo, canRedo) => {
      console.log('History changed:', { canUndo, canRedo });
    },
  });

  // Setup keyboard shortcuts
  useKeyboardShortcuts([
    CommonShortcuts.undo(async () => {
      const description = await history.undo();
      if (description) {
        showToast('success', `Undone: ${description}`);
      }
    }, history.canUndo),

    CommonShortcuts.redo(async () => {
      const description = await history.redo();
      if (description) {
        showToast('success', `Redone: ${description}`);
      }
    }, history.canRedo),
  ]);

  // ... rest of app
}
```

### 2. Wrap Delete Operations

```typescript
import { AgentCommands } from './utils/workspaceCommands';

// Before: Direct delete
const handleDeleteAgent = async (agent: Agent) => {
  await deleteAgent(agent.id);
  setAgents(agents.filter(a => a.id !== agent.id));
  showToast('success', `Deleted agent "${agent.name}"`);
};

// After: With undo support
const handleDeleteAgent = async (agent: Agent) => {
  const command = AgentCommands.delete(
    agent,
    // Delete function
    async (agentToDelete) => {
      await deleteAgent(agentToDelete.id);
      setAgents(prev => prev.filter(a => a.id !== agentToDelete.id));
    },
    // Restore function
    async (agentToRestore) => {
      await saveAgent(agentToRestore);
      setAgents(prev => [...prev, agentToRestore]);
    }
  );

  await history.executeCommand(command);

  showToast('success', `Deleted agent "${agent.name}"`, 3000, {
    label: 'Undo',
    onClick: () => history.undo(),
  });
};
```

### 3. Wrap Bulk Operations

```typescript
// Bulk delete with undo
const handleBulkDelete = async (selectedAgents: Agent[]) => {
  const command = AgentCommands.bulkDelete(
    selectedAgents,
    async (agentsToDelete) => {
      await Promise.all(agentsToDelete.map(a => deleteAgent(a.id)));
      setAgents(prev => prev.filter(a => !agentsToDelete.includes(a)));
    },
    async (agentsToRestore) => {
      await Promise.all(agentsToRestore.map(a => saveAgent(a)));
      setAgents(prev => [...prev, ...agentsToRestore]);
    }
  );

  await history.executeCommand(command);

  showToast('success', `Deleted ${selectedAgents.length} agents`, 3000, {
    label: 'Undo',
    onClick: () => history.undo(),
  });
};
```

### 4. Wrap Edit Operations

```typescript
// Edit with undo
const handleSaveAgent = async (updatedAgent: Agent) => {
  const oldAgent = agents.find(a => a.id === updatedAgent.id);

  if (!oldAgent) return;

  const command = AgentCommands.update(
    oldAgent,
    updatedAgent,
    async (agentToSave) => {
      await saveAgent(agentToSave);
      setAgents(prev => prev.map(a => a.id === agentToSave.id ? agentToSave : a));
    }
  );

  await history.executeCommand(command);

  showToast('success', `Saved agent "${updatedAgent.name}"`, 3000, {
    label: 'Undo',
    onClick: () => history.undo(),
  });
};
```

### 5. Handle Favorites Toggle

```typescript
// Toggle favorite with undo
const handleToggleFavorite = async (agent: Agent) => {
  const command = AgentCommands.toggleFavorite(
    agent,
    async () => {
      const updated = await toggleAgentFavorite(agent);
      setAgents(prev => prev.map(a => a.id === agent.id ? updated : a));
    }
  );

  await history.executeCommand(command);

  // No toast needed for favorites - it's a quick toggle
};
```

## Advanced Usage

### Custom Commands

Create custom commands for complex operations:

```typescript
import { Command } from './hooks/useHistory';

const createDuplicateCommand = (
  original: Agent,
  duplicate: Agent
): Command => ({
  description: `Duplicate agent "${original.name}"`,
  execute: async () => {
    // Already executed, but could re-execute if needed
    await saveAgent(duplicate);
    setAgents(prev => [...prev, duplicate]);
  },
  undo: async () => {
    // Undo by deleting the duplicate
    await deleteAgent(duplicate.id);
    setAgents(prev => prev.filter(a => a.id !== duplicate.id));
  },
  cleanup: () => {
    // Optional: cleanup resources
    console.log('Command removed from history');
  },
});

// Usage
const duplicate = createDuplicate(agent);
await history.executeCommand(createDuplicateCommand(agent, duplicate));
```

### Conditional Undo

Some operations shouldn't be undoable:

```typescript
// Don't add to history for non-destructive actions
const handleViewAgent = (agent: Agent) => {
  // Just navigate, no undo needed
  navigate('editor', agent);
};

// Do add to history for destructive actions
const handleDeleteAgent = async (agent: Agent) => {
  // Always allow undo for deletes
  const command = AgentCommands.delete(/*...*/);
  await history.executeCommand(command);
};
```

### History State in UI

Show undo/redo state in your UI:

```typescript
function HistoryControls() {
  const history = useHistory();

  return (
    <div className="flex gap-2">
      <button
        disabled={!history.canUndo}
        onClick={() => history.undo()}
        title={history.getUndoDescription() || 'Nothing to undo'}
      >
        <UndoIcon />
      </button>

      <button
        disabled={!history.canRedo}
        onClick={() => history.redo()}
        title={history.getRedoDescription() || 'Nothing to redo'}
      >
        <RedoIcon />
      </button>

      <span className="text-sm text-gray-500">
        {history.historySize} actions
      </span>
    </div>
  );
}
```

## Skills Integration

Same pattern works for skills:

```typescript
import { SkillCommands } from './utils/workspaceCommands';

const handleDeleteSkill = async (skill: Skill) => {
  const command = SkillCommands.delete(
    skill,
    async (skillToDelete) => {
      await deleteSkill(skillToDelete.id);
      setSkills(prev => prev.filter(s => s.id !== skillToDelete.id));
    },
    async (skillToRestore) => {
      await saveSkill(skillToRestore);
      setSkills(prev => [...prev, skillToRestore]);
    }
  );

  await history.executeCommand(command);

  showToast('success', `Deleted skill "${skill.name}"`, 3000, {
    label: 'Undo',
    onClick: () => history.undo(),
  });
};
```

## Testing

Test undo/redo functionality:

```typescript
import { renderHook, act } from '@testing-library/react';
import { useHistory, createCommand } from '../hooks/useHistory';

test('should undo and redo commands', async () => {
  const { result } = renderHook(() => useHistory());

  let value = 0;

  const command = createCommand(
    'Increment',
    () => { value += 1; },
    () => { value -= 1; }
  );

  // Execute
  await act(async () => {
    await result.current.executeCommand(command);
  });

  expect(value).toBe(1);
  expect(result.current.canUndo).toBe(true);

  // Undo
  await act(async () => {
    await result.current.undo();
  });

  expect(value).toBe(0);
  expect(result.current.canRedo).toBe(true);

  // Redo
  await act(async () => {
    await result.current.redo();
  });

  expect(value).toBe(1);
});
```

## Best Practices

1. **Always provide undo for destructive actions** (delete, bulk delete)
2. **Show toast with undo button** for user feedback
3. **Keep descriptions concise** (e.g., "Delete agent", not "Deleted the agent named X")
4. **Clear history on app restart** (already handled automatically)
5. **Limit stack size** (default 20 is good for most cases)
6. **Don't undo non-destructive actions** (view, navigate, etc.)
7. **Test undo paths** as thoroughly as normal operation paths

## Keyboard Shortcuts

Users can use:
- **Cmd+Z** (Mac) / **Ctrl+Z** (Windows/Linux) - Undo
- **Cmd+Shift+Z** (Mac) / **Ctrl+Shift+Z** (Windows/Linux) - Redo

These are handled automatically by useKeyboardShortcuts.

## Troubleshooting

### Undo doesn't work

1. Check command was added to history: `history.executeCommand(command)`
2. Verify undo function is correct
3. Check history.canUndo is true
4. Look for errors in console

### Memory leaks

1. Implement cleanup function in commands
2. Clear history when appropriate: `history.clear()`
3. Limit stack size to prevent unbounded growth

### State inconsistency

1. Ensure undo function truly reverses execute
2. Test edge cases (undo after app state changes)
3. Consider storing full state snapshots for complex operations

## Migration Checklist

- [ ] Add useHistory to App.tsx
- [ ] Add keyboard shortcuts (Cmd+Z, Cmd+Shift+Z)
- [ ] Wrap agent delete with undo
- [ ] Wrap agent bulk delete with undo
- [ ] Wrap agent edit/save with undo
- [ ] Wrap skill delete with undo
- [ ] Wrap skill bulk delete with undo
- [ ] Wrap skill edit/save with undo
- [ ] Add undo buttons to toasts
- [ ] Test all undo paths
- [ ] Add undo/redo UI controls (optional)
- [ ] Document for users (optional)
