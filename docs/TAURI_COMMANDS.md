# Tauri Commands API Reference

This document describes all Tauri IPC commands available in Vinsly Desktop. These commands are invoked from the frontend via `@tauri-apps/api/core` invoke function.

## Table of Contents

- [Discovery Commands](#discovery-commands)
- [Agent Commands](#agent-commands)
- [Skill Commands](#skill-commands)
- [Memory Commands](#memory-commands)
- [Slash Command Commands](#slash-command-commands)

---

## Discovery Commands

### `discover_project_directories`

Scans the home directory for project folders containing Claude configurations.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `max_depth` | `number` | No | Maximum directory depth to scan (default: 12) |
| `include_protected_dirs` | `boolean` | No | Include protected directories on macOS (default: false) |
| `force` | `boolean` | No | Bypass cache and force fresh scan (default: false) |

**Returns:** `string[]` - Array of project directory paths

**Example:**
```typescript
import { invoke } from '@tauri-apps/api/core';

const directories = await invoke<string[]>('discover_project_directories', {
  maxDepth: 12,
  includeProtectedDirs: false,
});
```

---

## Agent Commands

### `list_agents`

Lists all agent files from the specified scope.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `scope` | `'global' \| 'project'` | Yes | Where to look for agents |
| `project_path` | `string` | For project | Root path of the project |

**Returns:** `AgentFile[]`

```typescript
interface AgentFile {
  name: string;      // Agent name (filename without .md)
  path: string;      // Full path to the agent file
  content: string;   // Markdown content of the agent
  scope: string;     // 'global' or 'project'
}
```

### `list_agents_from_directory`

Lists agent files from a specific directory path.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `directory_path` | `string` | Yes | Path to scan for agents |

**Returns:** `AgentFile[]`

### `write_agent`

Creates or updates an agent file.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `scope` | `'global' \| 'project'` | Yes | Target scope |
| `name` | `string` | Yes | Agent name (will become filename) |
| `content` | `string` | Yes | Markdown content |
| `project_path` | `string` | For project | Root path of the project |

**Returns:** `string` - Absolute path to the created/updated file

**Validation:**
- Name cannot be empty
- Name cannot contain path separators (`/`, `\`)
- Name cannot contain `..`
- Path must be within `.claude/agents/` directory

### `delete_agent`

Deletes an agent file.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | `string` | Yes | Full path to the agent file |

**Validation:**
- Path must be within `.claude/agents/` directory
- File must exist

---

## Skill Commands

### `list_skills`

Lists all skill directories from the specified scope.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `scope` | `'global' \| 'project'` | Yes | Where to look for skills |
| `project_path` | `string` | For project | Root path of the project |

**Returns:** `SkillFile[]`

```typescript
interface SkillFile {
  name: string;        // Skill name (directory name)
  directory: string;   // Path to skill directory
  path: string;        // Path to SKILL.md file
  content: string;     // Content of SKILL.md
  scope: string;       // 'global' or 'project'
  has_assets: boolean; // Whether skill has additional files
}
```

### `list_skills_from_directory`

Lists skill directories from a specific path.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `directory_path` | `string` | Yes | Path to scan for skills |

**Returns:** `SkillFile[]`

### `write_skill`

Creates or updates a skill (SKILL.md file).

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `scope` | `'global' \| 'project'` | Yes | Target scope |
| `name` | `string` | Yes | Skill name (will become directory name) |
| `content` | `string` | Yes | SKILL.md content |
| `project_path` | `string` | For project | Root path of the project |

**Returns:** `string` - Absolute path to the SKILL.md file

### `delete_skill`

Deletes a skill directory and all its contents.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | `string` | Yes | Path to skill directory |

**Validation:**
- Path must be within `.claude/skills/` directory

### `export_skill_directory`

Exports a skill directory as a ZIP archive.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `directory_path` | `string` | Yes | Skill directory to export |
| `destination` | `string` | Yes | Path for the output ZIP file |

### `export_skills_archive`

Exports multiple skills as a single ZIP archive.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `directories` | `string[]` | Yes | Array of skill directory paths |
| `destination` | `string` | Yes | Path for the output ZIP file |

### `import_skill_archive`

Imports a skill from a ZIP archive.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `archive_path` | `string` | Yes | Path to the ZIP file |
| `scope` | `'global' \| 'project'` | Yes | Target scope |
| `project_path` | `string` | For project | Root path of the project |

---

## Memory Commands

### `read_claude_memory`

Reads a CLAUDE.md memory file.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `scope` | `'global' \| 'project'` | Yes | Memory scope |
| `project_path` | `string` | For project | Project root path |

**Returns:** `MemoryFile`

```typescript
interface MemoryFile {
  path: string;     // Full path to CLAUDE.md
  content: string;  // File content
  exists: boolean;  // Whether file exists
  scope: string;    // 'global' or 'project'
}
```

### `write_claude_memory`

Creates or updates a CLAUDE.md file.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `scope` | `'global' \| 'project'` | Yes | Target scope |
| `content` | `string` | Yes | Memory content |
| `project_path` | `string` | For project | Project root path |

**Returns:** `string` - Path to the written file

### `list_claude_memories`

Lists all discoverable CLAUDE.md files.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `include_global` | `boolean` | No | Include global memory (default: true) |
| `watched_directories` | `string[]` | No | Additional directories to scan |

**Returns:** `MemoryFile[]`

### `export_memories_archive`

Exports memory files as a ZIP archive.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `paths` | `string[]` | Yes | Paths to CLAUDE.md files |
| `destination` | `string` | Yes | Output ZIP path |

### `import_memories_archive`

Imports memory files from a ZIP archive.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `archive_path` | `string` | Yes | Path to ZIP file |
| `scope` | `'global' \| 'project'` | Yes | Target scope |
| `project_path` | `string` | For project | Project root path |

---

## Slash Command Commands

### `list_slash_commands`

Lists slash command files.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `scope` | `'global' \| 'project'` | Yes | Command scope |
| `project_path` | `string` | For project | Project root path |

**Returns:** `SlashCommandFile[]`

```typescript
interface SlashCommandFile {
  name: string;        // Command name (filename without .md)
  path: string;        // Full path to command file
  content: string;     // Markdown content
  scope: string;       // 'global' or 'project'
  description: string; // First line of content (if present)
}
```

### `list_slash_commands_from_directory`

Lists commands from a specific directory.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `directory_path` | `string` | Yes | Path to scan |

**Returns:** `SlashCommandFile[]`

### `write_slash_command`

Creates or updates a slash command.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `scope` | `'global' \| 'project'` | Yes | Target scope |
| `name` | `string` | Yes | Command name |
| `content` | `string` | Yes | Command content |
| `project_path` | `string` | For project | Project root path |

**Returns:** `string` - Path to the command file

### `delete_slash_command`

Deletes a slash command file.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | `string` | Yes | Path to command file |

### `export_slash_commands_archive`

Exports commands as a ZIP archive.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `paths` | `string[]` | Yes | Command file paths |
| `destination` | `string` | Yes | Output ZIP path |

### `import_slash_commands_archive`

Imports commands from a ZIP archive.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `archive_path` | `string` | Yes | Path to ZIP file |
| `scope` | `'global' \| 'project'` | Yes | Target scope |
| `project_path` | `string` | For project | Project root path |

---

## Error Handling

All commands may throw errors. Common error patterns:

```typescript
try {
  await invoke('write_agent', { scope: 'project', name: 'test', content: '...' });
} catch (error) {
  // error will be a string describing what went wrong
  console.error('Failed to write agent:', error);
}
```

**Common Errors:**
- `"Agent name cannot be empty"` - Empty name provided
- `"Agent name cannot contain path separators"` - Invalid characters in name
- `"Project scope requires a project_path parameter"` - Missing project path
- `"Refusing to modify files outside .claude/..."` - Path security violation
- `"Failed to get home directory"` - System error

## Directory Structure

```
~/.claude/                    # Global scope
├── agents/                   # Global agents
│   └── my-agent.md
├── skills/                   # Global skills
│   └── my-skill/
│       └── SKILL.md
├── commands/                 # Global slash commands
│   └── my-command.md
└── CLAUDE.md                 # Global memory

/path/to/project/             # Project scope
└── .claude/
    ├── agents/
    ├── skills/
    ├── commands/
    └── CLAUDE.md
```
