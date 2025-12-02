# lib.rs Refactoring Guide

This document outlines the recommended structure for refactoring `src-tauri/src/lib.rs` from a 1591-line monolith into modular components.

## Current Structure

The current `lib.rs` contains:
- Home directory discovery and caching (~100 lines)
- Path validation utilities (~50 lines)
- Agent operations (~400 lines)
- Skill operations (~400 lines)
- Memory/CLAUDE.md operations (~200 lines)
- Slash command operations (~200 lines)
- ZIP archive utilities (~200 lines)
- Tauri command registration (~50 lines)

## Recommended Module Structure

```
src-tauri/src/
├── lib.rs              # Tauri app setup, command registration
├── agents.rs           # Agent CRUD operations
├── skills.rs           # Skill CRUD operations
├── memory.rs           # CLAUDE.md operations
├── commands.rs         # Slash command operations
├── archive.rs          # ZIP import/export utilities
├── paths.rs            # Path validation and resolution
├── discovery.rs        # Home directory discovery, caching
└── scanner.rs          # Already exists - project scanning
```

## Module Details

### paths.rs
Move from lib.rs:
- `validate_entry_name()`
- `ensure_path_in_claude_subdir()`
- `ensure_path_in_agents_dir()`
- `ensure_path_in_skills_dir()`
- `get_agents_dir()`
- `get_skills_dir()`
- `get_commands_dir()`
- `get_memory_path()`

### discovery.rs
Move from lib.rs:
- `DiscoveryCacheEntry`
- `HOME_DISCOVERY_CACHE`
- `HOME_DISCOVERY_MUTEX`
- `home_discovery_cache()`
- `home_discovery_mutex()`
- `get_cached_directories()`
- `cache_directories()`
- `discover_project_directories` command

### agents.rs
Move from lib.rs:
- `AgentFile` struct
- `list_agents` command
- `list_agents_from_directory` command
- `write_agent` command
- `delete_agent` command
- `export_agents_archive` command

### skills.rs
Move from lib.rs:
- `SkillFile` struct
- `list_skills` command
- `list_skills_from_directory` command
- `write_skill` command
- `delete_skill` command
- `export_skill_directory` command
- `export_skills_archive` command
- `import_skill_archive` command

### memory.rs
Move from lib.rs:
- `MemoryFile` struct
- `read_claude_memory` command
- `write_claude_memory` command
- `list_claude_memories` command
- `export_memories_archive` command
- `import_memories_archive` command

### commands.rs
Move from lib.rs:
- `SlashCommandFile` struct
- `list_slash_commands` command
- `list_slash_commands_from_directory` command
- `write_slash_command` command
- `delete_slash_command` command
- `export_slash_commands_archive` command
- `import_slash_commands_archive` command

### archive.rs
Move from lib.rs:
- ZIP creation utilities
- ZIP extraction utilities
- Archive error handling

### lib.rs (after refactoring)
Should contain only:
```rust
pub mod agents;
pub mod archive;
pub mod commands;
pub mod discovery;
pub mod memory;
pub mod paths;
pub mod scanner;
pub mod skills;

use tauri::Builder;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    Builder::default()
        .invoke_handler(tauri::generate_handler![
            // Discovery
            discovery::discover_project_directories,

            // Agents
            agents::list_agents,
            agents::list_agents_from_directory,
            agents::write_agent,
            agents::delete_agent,
            agents::export_agents_archive,

            // Skills
            skills::list_skills,
            skills::list_skills_from_directory,
            skills::write_skill,
            skills::delete_skill,
            skills::export_skill_directory,
            skills::export_skills_archive,
            skills::import_skill_archive,

            // Memory
            memory::read_claude_memory,
            memory::write_claude_memory,
            memory::list_claude_memories,
            memory::export_memories_archive,
            memory::import_memories_archive,

            // Commands
            commands::list_slash_commands,
            commands::list_slash_commands_from_directory,
            commands::write_slash_command,
            commands::delete_slash_command,
            commands::export_slash_commands_archive,
            commands::import_slash_commands_archive,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

## Migration Steps

1. **Create paths.rs** - Extract path utilities first (no dependencies)
2. **Create discovery.rs** - Move caching and discovery (uses paths.rs)
3. **Create archive.rs** - Extract ZIP utilities (no dependencies)
4. **Create agents.rs** - Move agent commands (uses paths.rs, archive.rs)
5. **Create skills.rs** - Move skill commands (uses paths.rs, archive.rs)
6. **Create memory.rs** - Move memory commands (uses paths.rs, archive.rs)
7. **Create commands.rs** - Move slash command functions (uses paths.rs, archive.rs)
8. **Update lib.rs** - Remove moved code, update command registration

## Testing

After each module extraction:
1. Run `cargo check` to verify compilation
2. Run `cargo test` if tests exist
3. Test the corresponding frontend functionality

## Benefits

- **Maintainability**: Each module has a single responsibility
- **Testability**: Smaller modules are easier to unit test
- **Readability**: ~200-300 lines per module vs 1591 lines
- **Collaboration**: Multiple developers can work on different modules
