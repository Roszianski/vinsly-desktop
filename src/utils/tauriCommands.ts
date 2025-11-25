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
