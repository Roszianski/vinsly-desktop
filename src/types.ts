
export enum AgentScope {
  Global = 'Global',
  Project = 'Project',
}

export type AgentModel = 'sonnet' | 'haiku' | 'inherit' | 'opus' | 'default';

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
    [key: string]: unknown;
  };
  body: string;
  hasAssets?: boolean;
  isFavorite?: boolean;
}

// Scan Settings Types
export interface ScanSettings {
  autoScanGlobalOnStartup: boolean;
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
