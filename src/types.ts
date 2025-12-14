
export enum AgentScope {
  Global = 'Global',
  Project = 'Project',
}

export type AgentModel = 'sonnet' | 'haiku' | 'inherit' | 'opus' | 'default';

export type PermissionMode = 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan' | 'ignore';

export enum ToolRisk {
  Low = 'Low',
  Medium = 'Medium',
  High = 'High',
  Unknown = 'Unknown'
}

export type ToolCategory = 'Read-only' | 'Edit' | 'Execution' | 'Other';

export interface Tool {
  name: string;
  category: ToolCategory;
  risk: ToolRisk;
}

export interface Agent {
  id: string;
  name: string;
  scope: AgentScope;
  path: string;
  frontmatter: {
    name: string;
    description: string;
    model?: AgentModel;
    tools?: string | string[];
    color?: string;
    permissionMode?: PermissionMode;
    skills?: string[];
    [key: string]: unknown; // For unknown keys
  };
  body: string;
  isFavorite?: boolean;
}

export interface Skill {
  id: string;
  name: string;
  scope: AgentScope;
  directoryPath: string;
  path: string;
  frontmatter: {
    name: string;
    description: string;
    allowedTools?: string[]; // Array of tool names per official SKILL.md spec
    license?: string;
    version?: string;
    disableModelInvocation?: boolean;
    [key: string]: unknown;
  };
  body: string;
  hasAssets?: boolean;
  isFavorite?: boolean;
}

// CLAUDE.md Memory file
export interface ClaudeMemory {
  id: string;           // 'global' or 'project'
  scope: AgentScope;
  path: string;         // Full file path
  content: string;      // Raw markdown content
  exists: boolean;      // Whether file exists on disk
  lastModified?: Date;
  isFavorite?: boolean;
}

// Slash Command (custom prompt macro)
export interface SlashCommand {
  id: string;           // File path
  name: string;         // Command name (filename without .md)
  scope: AgentScope;
  path: string;         // Full file path
  frontmatter?: {
    description?: string;
    argumentHint?: string;      // Shows as [args] hint, e.g., "[message]"
    allowedTools?: string;      // Comma-separated tools
    model?: string;
    disableModelInvocation?: boolean;
  };
  description?: string; // First line or extracted summary (legacy, prefer frontmatter)
  body: string;         // Markdown content after frontmatter
  isFavorite?: boolean;
}

// Scan Settings Types
export interface ScanSettings {
  autoScanGlobalOnStartup: boolean;
  autoScanWatchedOnStartup: boolean;
  autoScanHomeDirectoryOnStartup: boolean;
  fullDiskAccessEnabled: boolean;
  watchedDirectories: string[];
}

export interface LoadAgentsOptions {
  projectPaths?: string | string[];
  includeGlobal?: boolean;
  scanWatchedDirectories?: boolean;
  additionalDirectories?: string[];
}

// Detailed scan result with counts per resource type
export interface DetailedScanResult {
  total: number;
  newCount: number;
  breakdown: {
    agents: { total: number; new: number };
    skills: { total: number; new: number };
    commands: { total: number; new: number };
    mcpServers: { total: number; new: number };
    hooks: { total: number; new: number };
    memories: { total: number; new: number };
  };
}
