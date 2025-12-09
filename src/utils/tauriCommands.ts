import { invoke } from '@tauri-apps/api/core';

export interface AgentFile {
  name: string;
  path: string;
  content: string;
  scope: string;
}

export interface SkillFile {
  name: string;
  directory: string;
  path: string;
  content: string;
  scope: string;
  has_assets: boolean;
}

// List all agents from a specific scope
export async function listAgents(scope: 'project' | 'global', projectPath?: string): Promise<AgentFile[]> {
  return await invoke<AgentFile[]>('list_agents', { scope, projectPath, project_path: projectPath });
}

// Read a single agent file
export async function readAgent(path: string): Promise<string> {
  return await invoke<string>('read_agent', { path });
}

// Write an agent file
export async function writeAgent(
  scope: 'project' | 'global',
  name: string,
  content: string,
  projectPath?: string
): Promise<string> {
  return await invoke<string>('write_agent', { scope, name, content, projectPath, project_path: projectPath });
}

// Delete an agent file
export async function deleteAgent(path: string): Promise<void> {
  return await invoke('delete_agent', { path });
}

// List agents from a specific directory
export async function listAgentsFromDirectory(directory: string): Promise<AgentFile[]> {
  return await invoke<AgentFile[]>('list_agents_from_directory', { directory });
}

export async function listSkills(scope: 'project' | 'global', projectPath?: string): Promise<SkillFile[]> {
  return await invoke<SkillFile[]>('list_skills', { scope, projectPath, project_path: projectPath });
}

export async function writeSkill(
  scope: 'project' | 'global',
  name: string,
  content: string,
  projectPath?: string
): Promise<string> {
  return await invoke<string>('write_skill', { scope, name, content, projectPath, project_path: projectPath });
}

export async function deleteSkill(path: string): Promise<void> {
  return await invoke('delete_skill', { path });
}

export async function migrateSkill(
  oldPath: string,
  scope: 'project' | 'global',
  name: string,
  content: string,
  projectPath?: string
): Promise<string> {
  return await invoke<string>('migrate_skill', {
    oldPath,
    old_path: oldPath,
    scope,
    name,
    content,
    projectPath,
    project_path: projectPath,
  });
}

export async function listSkillsFromDirectory(directory: string): Promise<SkillFile[]> {
  return await invoke<SkillFile[]>('list_skills_from_directory', { directory });
}

export async function exportSkillDirectory(directory: string, destination: string): Promise<void> {
  return await invoke('export_skill_directory', { directory, destination });
}

export async function importSkillArchive(
  archivePath: string,
  scope: 'project' | 'global',
  projectPath?: string
): Promise<string> {
  return await invoke<string>('import_skill_archive', { archivePath, archive_path: archivePath, scope, projectPath, project_path: projectPath });
}

export async function exportSkillsArchive(directories: string[], destination: string): Promise<void> {
  return await invoke('export_skills_archive', { directories, destination });
}

// Get home directory path
export async function getHomeDir(): Promise<string> {
  return await invoke<string>('get_home_dir');
}

interface DiscoverProjectDirectoriesOptions {
  maxDepth?: number;
  includeProtectedDirs?: boolean;
}

export async function discoverProjectDirectories(options: DiscoverProjectDirectoriesOptions = {}): Promise<string[]> {
  const payload: Record<string, number | boolean> = {};
  if (typeof options.maxDepth === 'number') {
    payload.maxDepth = options.maxDepth;
    payload.max_depth = options.maxDepth;
  }
  if (typeof options.includeProtectedDirs === 'boolean') {
    payload.includeProtectedDirs = options.includeProtectedDirs;
    payload.include_protected_dirs = options.includeProtectedDirs;
  }
  return await invoke<string[]>('discover_project_directories', payload);
}

export async function checkFullDiskAccess(): Promise<boolean> {
  return await invoke<boolean>('check_full_disk_access');
}

export async function openFullDiskAccessSettings(): Promise<void> {
  await invoke('open_full_disk_access_settings');
}

// ============================================================================
// CLAUDE.md (Memory) Commands
// ============================================================================

export interface ClaudeMemoryFile {
  scope: string;
  path: string;
  content: string;
  exists: boolean;
}

export async function readClaudeMemory(
  scope: 'project' | 'global',
  projectPath?: string
): Promise<ClaudeMemoryFile> {
  return await invoke<ClaudeMemoryFile>('read_claude_memory', {
    scope,
    projectPath,
    project_path: projectPath,
  });
}

export async function writeClaudeMemory(
  scope: 'project' | 'global',
  content: string,
  projectPath?: string
): Promise<string> {
  return await invoke<string>('write_claude_memory', {
    scope,
    content,
    projectPath,
    project_path: projectPath,
  });
}

export async function checkClaudeMemoryExists(
  scope: 'project' | 'global',
  projectPath?: string
): Promise<boolean> {
  return await invoke<boolean>('check_claude_memory_exists', {
    scope,
    projectPath,
    project_path: projectPath,
  });
}

// ============================================================================
// Slash Commands
// ============================================================================

export interface SlashCommandFile {
  name: string;
  path: string;
  content: string;
  scope: string;
}

export async function listSlashCommands(
  scope: 'project' | 'global',
  projectPath?: string
): Promise<SlashCommandFile[]> {
  return await invoke<SlashCommandFile[]>('list_slash_commands', {
    scope,
    projectPath,
    project_path: projectPath,
  });
}

export async function readSlashCommand(path: string): Promise<string> {
  return await invoke<string>('read_slash_command', { path });
}

export async function writeSlashCommand(
  scope: 'project' | 'global',
  name: string,
  content: string,
  projectPath?: string
): Promise<string> {
  return await invoke<string>('write_slash_command', {
    scope,
    name,
    content,
    projectPath,
    project_path: projectPath,
  });
}

export async function deleteSlashCommand(path: string): Promise<void> {
  return await invoke('delete_slash_command', { path });
}

export async function listSlashCommandsFromDirectory(
  directory: string
): Promise<SlashCommandFile[]> {
  return await invoke<SlashCommandFile[]>('list_slash_commands_from_directory', {
    directory,
  });
}

// Export slash commands to a zip archive
export async function exportSlashCommandsArchive(
  paths: string[],
  destination: string
): Promise<void> {
  return await invoke('export_slash_commands_archive', { paths, destination });
}

// Import slash commands from a zip archive
export async function importSlashCommandsArchive(
  archivePath: string,
  scope: 'project' | 'global',
  projectPath?: string
): Promise<string[]> {
  return await invoke<string[]>('import_slash_commands_archive', {
    archivePath,
    archive_path: archivePath,
    scope,
    projectPath,
    project_path: projectPath,
  });
}

// Export CLAUDE.md memory files to a zip archive
export async function exportMemoriesArchive(
  paths: string[],
  destination: string
): Promise<void> {
  return await invoke('export_memories_archive', { paths, destination });
}

// Import CLAUDE.md memory files from a zip archive
export async function importMemoriesArchive(
  archivePath: string,
  scope: 'project' | 'global',
  projectPath?: string
): Promise<string[]> {
  return await invoke<string[]>('import_memories_archive', {
    archivePath,
    archive_path: archivePath,
    scope,
    projectPath,
    project_path: projectPath,
  });
}

// ============================================================================
// MCP Server Commands
// ============================================================================

export interface MCPServerConfigRaw {
  type?: string;
  url?: string;
  command?: string;
  args?: string[];
  headers?: Record<string, string>;
  env?: Record<string, string>;
}

export interface MCPConfigFileRaw {
  mcpServers: Record<string, MCPServerConfigRaw>;
}

export interface MCPServerInfoRaw {
  name: string;
  server_type: string;
  url?: string;
  command?: string;
  args?: string[];
  headers?: Record<string, string>;
  env?: Record<string, string>;
  scope: string;
  source_path: string;
  enabled: boolean;
}

// List all MCP servers from user and project scopes
export async function listMCPServers(projectPath?: string): Promise<MCPServerInfoRaw[]> {
  return await invoke<MCPServerInfoRaw[]>('list_mcp_servers', {
    projectPath,
    project_path: projectPath,
  });
}

// Read MCP config from a specific scope
export async function readMCPConfig(
  scope: 'user' | 'project' | 'local',
  projectPath?: string
): Promise<MCPConfigFileRaw> {
  return await invoke<MCPConfigFileRaw>('read_mcp_config', {
    scope,
    projectPath,
    project_path: projectPath,
  });
}

// Write MCP config to a specific scope
export async function writeMCPConfig(
  scope: 'user' | 'project' | 'local',
  config: MCPConfigFileRaw,
  projectPath?: string
): Promise<string> {
  return await invoke<string>('write_mcp_config', {
    scope,
    config,
    projectPath,
    project_path: projectPath,
  });
}

// Add a single MCP server to a config
export async function addMCPServer(
  scope: 'user' | 'project' | 'local',
  name: string,
  serverConfig: MCPServerConfigRaw,
  projectPath?: string
): Promise<string> {
  return await invoke<string>('add_mcp_server', {
    scope,
    name,
    serverConfig,
    server_config: serverConfig,
    projectPath,
    project_path: projectPath,
  });
}

// Remove an MCP server from a config
export async function removeMCPServer(
  scope: 'user' | 'project' | 'local',
  name: string,
  projectPath?: string
): Promise<string> {
  return await invoke<string>('remove_mcp_server', {
    scope,
    name,
    projectPath,
    project_path: projectPath,
  });
}

// ============================================================================
// Hooks Commands
// ============================================================================

export interface HookConfigRaw {
  type: string;
  matcher?: string;
  command: string;
  timeout?: number;
}

export interface HooksConfigFileRaw {
  hooks: Record<string, HookConfigRaw[]>;
}

export interface HookInfoRaw {
  id: string;
  name: string;
  event_type: string;
  matcher?: string;
  command: string;
  timeout?: number;
  scope: string;
  source_path: string;
  enabled: boolean;
}

// List all hooks from user and project scopes
export async function listHooks(projectPath?: string): Promise<HookInfoRaw[]> {
  return await invoke<HookInfoRaw[]>('list_hooks', {
    projectPath,
    project_path: projectPath,
  });
}

// Read hooks config from a specific scope
export async function readHooksConfig(
  scope: 'user' | 'project' | 'local',
  projectPath?: string
): Promise<HooksConfigFileRaw> {
  return await invoke<HooksConfigFileRaw>('read_hooks_config', {
    scope,
    projectPath,
    project_path: projectPath,
  });
}

// Write hooks config to a specific scope
export async function writeHooksConfig(
  scope: 'user' | 'project' | 'local',
  config: HooksConfigFileRaw,
  projectPath?: string
): Promise<string> {
  return await invoke<string>('write_hooks_config', {
    scope,
    config,
    projectPath,
    project_path: projectPath,
  });
}

// Add a hook to a specific event type
export async function addHook(
  scope: 'user' | 'project' | 'local',
  eventType: string,
  hookConfig: HookConfigRaw,
  projectPath?: string
): Promise<string> {
  return await invoke<string>('add_hook', {
    scope,
    eventType,
    event_type: eventType,
    hookConfig,
    hook_config: hookConfig,
    projectPath,
    project_path: projectPath,
  });
}

// Remove a hook by event type and index
export async function removeHook(
  scope: 'user' | 'project' | 'local',
  eventType: string,
  hookIndex: number,
  projectPath?: string
): Promise<string> {
  return await invoke<string>('remove_hook', {
    scope,
    eventType,
    event_type: eventType,
    hookIndex,
    hook_index: hookIndex,
    projectPath,
    project_path: projectPath,
  });
}

// ============================================================================
// Claude Code Session Detection
// ============================================================================

export interface ClaudeSessionRaw {
  pid: number;
  working_directory: string;
  start_time: number;
  status: string;
  cpu_usage?: number;
  memory_usage?: number;
  command_line?: string;
}

// Detect running Claude Code sessions
export async function detectClaudeSessions(): Promise<ClaudeSessionRaw[]> {
  return await invoke<ClaudeSessionRaw[]>('detect_claude_sessions');
}

// Kill a Claude Code session by PID
export async function killClaudeSession(pid: number): Promise<void> {
  return await invoke('kill_claude_session', { pid });
}

// ============================================================================
// Safe File Export/Import (replaces @tauri-apps/plugin-fs)
// ============================================================================

// Write text content to a user-selected file path
export async function exportTextFile(path: string, content: string): Promise<void> {
  return await invoke('export_text_file', { path, content });
}

// Write binary content to a user-selected file path
export async function exportBinaryFile(path: string, content: number[]): Promise<void> {
  return await invoke('export_binary_file', { path, content });
}

// Read text content from a user-selected file path
export async function importTextFile(path: string): Promise<string> {
  return await invoke<string>('import_text_file', { path });
}

// Read binary content from a user-selected file path
export async function importBinaryFile(path: string): Promise<number[]> {
  return await invoke<number[]>('import_binary_file', { path });
}

// ============================================================================
// Window Appearance
// ============================================================================

// Set the title bar appearance to match the app theme (macOS only)
export async function setTitleBarTheme(dark: boolean): Promise<void> {
  return await invoke('set_title_bar_theme', { dark });
}

// Write the theme cache to disk (for instant title bar theme on startup)
export async function writeThemeCache(dark: boolean): Promise<void> {
  return await invoke('write_theme_cache', { dark });
}
