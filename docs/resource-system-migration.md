# Resource System Migration Guide

This guide explains how to use the new generic Resource system to eliminate Agent/Skill code duplication.

## Overview

The Resource system provides:
- **Generic types** that work with both Agents and Skills
- **Unified operations** for CRUD, favorites, filtering, sorting
- **Configuration-driven** behavior customization
- **~30% code reduction** by eliminating duplication

## Architecture

```
types/resource.ts          → Generic Resource types & type guards
config/resourceConfig.ts   → Agent and Skill configurations
utils/resourceOperations.ts → Shared CRUD operations
```

## Key Concepts

### 1. Resource Types

```typescript
import { Resource, ResourceType, AgentResource, SkillResource } from './types/resource';
import { isAgentResource, isSkillResource } from './types/resource';

// Convert to Resource
const agentResource: AgentResource = agentToResource(agent);
const skillResource: SkillResource = skillToResource(skill);

// Type guards
if (isAgentResource(resource)) {
  // TypeScript knows this is AgentResource
  console.log(resource.path);
}

if (isSkillResource(resource)) {
  // TypeScript knows this is SkillResource
  console.log(resource.directoryPath);
  console.log(resource.hasAssets);
}

// Convert back
const agent = resourceToAgent(agentResource);
const skill = resourceToSkill(skillResource);
```

### 2. Resource Configuration

```typescript
import { AGENT_CONFIG, SKILL_CONFIG, getResourceConfig } from './config/resourceConfig';
import { ResourceType } from './types/resource';

// Get config for a type
const config = getResourceConfig(ResourceType.Agent);

// Use config properties
console.log(config.displayName); // "Agent"
console.log(config.displayNamePlural); // "Agents"
console.log(config.globalPath); // "~/.claude/agents"
console.log(config.isDirectory); // false

// Use config methods
const markdown = config.toMarkdown(agent);
const agent = config.fromMarkdown(content, 'agent.md', AgentScope.Global);
const isValid = config.isValid(agent);
```

### 3. Unified Operations

```typescript
import {
  toggleFavorite,
  markFavorites,
  duplicateResource,
  filterResources,
  sortResources,
  groupByScope,
} from './utils/resourceOperations';

// Toggle favorite
const updatedAgent = await toggleFavorite(agent, ResourceType.Agent);

// Mark all with favorite status
const agentsWithFavorites = await markFavorites(agents, ResourceType.Agent);

// Duplicate with unique name
const duplicate = duplicateResource(agent, existingAgents, AGENT_CONFIG);

// Filter by search
const filtered = filterResources(agents, 'code review');

// Sort
const sorted = sortResources(agents, 'name', 'asc');

// Group by scope
const { global, project } = groupByScope(agents);
```

## Migration Examples

### Before: Separate Agent and Skill Logic

```typescript
// Duplicated code for agents
const handleDuplicateAgent = (agent: Agent) => {
  const newName = generateUniqueAgentName(agent.name, agents);
  const duplicated = { ...agent, name: newName, id: newName };
  setAgents([...agents, duplicated]);
};

// Same logic duplicated for skills
const handleDuplicateSkill = (skill: Skill) => {
  const newName = generateUniqueSkillName(skill.name, skills);
  const duplicated = { ...skill, name: newName, id: newName };
  setSkills([...skills, duplicated]);
};
```

### After: Unified Resource Logic

```typescript
const handleDuplicateResource = <T extends Agent | Skill>(
  item: T,
  existing: T[],
  config: ResourceConfig
) => {
  const duplicated = duplicateResource(item, existing, config);
  setResources([...resources, duplicated]);
};

// Use with agents
handleDuplicateResource(agent, agents, AGENT_CONFIG);

// Use with skills
handleDuplicateResource(skill, skills, SKILL_CONFIG);
```

### Creating a Generic Hook

```typescript
import { useState, useEffect } from 'react';
import { ResourceConfig } from './types/resource';
import { markFavorites } from './utils/resourceOperations';

function useResources<T extends Agent | Skill>(config: ResourceConfig) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);

  const loadResources = async () => {
    setLoading(true);
    try {
      // Load from backend using config
      const loaded = await loadResourcesFromBackend(config);
      const withFavorites = await markFavorites(loaded, config.type);
      setItems(withFavorites);
    } finally {
      setLoading(false);
    }
  };

  const toggleFavorite = async (item: T) => {
    const updated = await toggleFavorite(item, config.type);
    setItems(items.map(i => i.id === updated.id ? updated : i));
  };

  const duplicate = (item: T) => {
    const dup = duplicateResource(item, items, config);
    setItems([...items, dup]);
  };

  return { items, loading, loadResources, toggleFavorite, duplicate };
}

// Use for agents
const agentHook = useResources<Agent>(AGENT_CONFIG);

// Use for skills
const skillHook = useResources<Skill>(SKILL_CONFIG);
```

### Generic List Component

```typescript
interface ResourceListProps<T extends Agent | Skill> {
  items: T[];
  config: ResourceConfig;
  onSelect: (item: T) => void;
  onDuplicate: (item: T) => void;
  onDelete: (item: T) => void;
  onToggleFavorite: (item: T) => void;
}

function ResourceList<T extends Agent | Skill>({
  items,
  config,
  onSelect,
  onDuplicate,
  onDelete,
  onToggleFavorite,
}: ResourceListProps<T>) {
  return (
    <div>
      <h2>{config.displayNamePlural}</h2>
      {items.map(item => (
        <div key={item.id}>
          <span>{item.name}</span>
          <button onClick={() => onSelect(item)}>Edit</button>
          <button onClick={() => onDuplicate(item)}>Duplicate</button>
          <button onClick={() => onDelete(item)}>Delete</button>
          <button onClick={() => onToggleFavorite(item)}>
            {item.isFavorite ? '★' : '☆'}
          </button>
        </div>
      ))}
    </div>
  );
}

// Use with agents
<ResourceList
  items={agents}
  config={AGENT_CONFIG}
  onSelect={handleSelectAgent}
  onDuplicate={handleDuplicateAgent}
  onDelete={handleDeleteAgent}
  onToggleFavorite={handleToggleFavoriteAgent}
/>

// Use with skills
<ResourceList
  items={skills}
  config={SKILL_CONFIG}
  onSelect={handleSelectSkill}
  onDuplicate={handleDuplicateSkill}
  onDelete={handleDeleteSkill}
  onToggleFavorite={handleToggleFavoriteSkill}
/>
```

## Migration Steps

### Step 1: Update useWorkspace Hook

1. Add resource type parameter
2. Use ResourceConfig instead of hard-coded logic
3. Use resourceOperations utilities
4. Keep backward compatibility with existing API

### Step 2: Create Generic Components

1. Extract common logic from AgentListScreen and SkillListScreen
2. Create ResourceListScreen that accepts config prop
3. Extract common logic from AgentEditorScreen and SkillEditorScreen
4. Create ResourceEditorScreen that accepts config prop

### Step 3: Update App.tsx

1. Pass appropriate config to new generic components
2. Remove duplicate code paths
3. Test thoroughly

### Step 4: Clean Up

1. Remove old agent-specific and skill-specific components
2. Remove duplicate utility functions
3. Update tests to use new system

## Benefits

- **Less Code**: ~30% reduction in lines of code
- **Easier Maintenance**: Fix bugs once, not twice
- **Consistent Behavior**: Agents and Skills work the same way
- **Type Safety**: Full TypeScript support with proper types
- **Extensible**: Easy to add new resource types in the future

## Testing

All resource operations have corresponding test utilities:

```typescript
import { createMockAgent, createMockSkill } from './test/helpers';
import { AGENT_CONFIG, SKILL_CONFIG } from './config/resourceConfig';

// Test with agents
const agent = createMockAgent();
const duplicate = duplicateResource(agent, [agent], AGENT_CONFIG);
expect(duplicate.name).toBe('Test Agent (Copy)');

// Test with skills
const skill = createMockSkill();
const duplicate = duplicateResource(skill, [skill], SKILL_CONFIG);
expect(duplicate.name).toBe('Test Skill (Copy)');
```

## Next Steps

1. Review this migration guide
2. Start with useWorkspace refactoring
3. Create generic list component
4. Create generic editor component
5. Update App.tsx to use new components
6. Run full test suite
7. Remove old code once stable
