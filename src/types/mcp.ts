/**
 * MCP (Model Context Protocol) Server Types
 * For managing Claude Code's MCP server configurations
 */

/**
 * MCP server transport types
 */
export type MCPServerType = 'http' | 'stdio' | 'sse';

/**
 * Scope where the MCP server is configured
 */
export type MCPScope = 'user' | 'project' | 'local';

/**
 * Health/connection status of an MCP server
 */
export type MCPServerStatus = 'unknown' | 'checking' | 'connected' | 'disconnected' | 'error';

/**
 * Result of a health check for an MCP server
 */
export interface MCPHealthResult {
  serverName: string;
  status: MCPServerStatus;
  latencyMs?: number;
  errorMessage?: string;
  checkedAt: number;
}

/**
 * OAuth 2.0 configuration for remote MCP servers
 */
export interface MCPOAuthConfig {
  provider: string;                    // OAuth provider identifier
  authorizationUrl: string;            // OAuth authorization endpoint
  tokenUrl: string;                    // Token exchange endpoint
  clientId: string;                    // OAuth client ID
  scopes?: string[];                   // Required OAuth scopes
  redirectUri?: string;                // Override default redirect URI
}

/**
 * Authentication status for MCP servers
 */
export type MCPAuthStatus = 'none' | 'pending' | 'authenticated' | 'expired' | 'error';

/**
 * OAuth token data (stored in OS keychain, not in config)
 */
export interface MCPOAuthToken {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;                  // Unix timestamp
  tokenType: string;                   // Usually 'Bearer'
}

/**
 * Raw MCP server configuration as stored in .mcp.json files
 */
export interface MCPServerConfig {
  type?: MCPServerType;
  url?: string;                           // For http/sse
  command?: string;                       // For stdio
  args?: string[];                        // For stdio
  headers?: Record<string, string>;       // For http/sse
  env?: Record<string, string>;           // Environment variables
}

/**
 * Full MCP configuration file structure (.mcp.json)
 */
export interface MCPConfigFile {
  mcpServers?: Record<string, MCPServerConfig>;
}

/**
 * MCP server with metadata for UI display
 */
export interface MCPServer {
  id: string;                             // Unique ID for UI (name + scope)
  name: string;                           // Server name (key in mcpServers)
  type: MCPServerType;                    // Transport type
  url?: string;                           // For http/sse
  command?: string;                       // For stdio
  args?: string[];                        // For stdio
  headers?: Record<string, string>;       // For http/sse
  env?: Record<string, string>;           // Environment variables
  scope: MCPScope;                        // Where it's configured
  sourcePath: string;                     // File path it came from
  enabled: boolean;                       // Whether it's enabled in settings
  isFavorite?: boolean;                   // User favorite
}

/**
 * Template for creating new MCP servers
 */
export interface MCPServerTemplate {
  id: string;
  name: string;
  displayName: string;
  description: string;
  type: MCPServerType;
  config: Partial<MCPServerConfig>;
  packageName?: string;                   // npm package name if applicable
}

/**
 * Built-in MCP server templates
 */
export const MCP_SERVER_TEMPLATES: MCPServerTemplate[] = [
  {
    id: 'github',
    name: 'github',
    displayName: 'GitHub',
    description: 'Access GitHub repositories, issues, and pull requests',
    type: 'stdio',
    packageName: '@modelcontextprotocol/server-github',
    config: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-github'],
      env: {
        GITHUB_PERSONAL_ACCESS_TOKEN: '${GITHUB_TOKEN}'
      }
    }
  },
  {
    id: 'filesystem',
    name: 'filesystem',
    displayName: 'Filesystem',
    description: 'Read and write files from specified directories',
    type: 'stdio',
    packageName: '@modelcontextprotocol/server-filesystem',
    config: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', '/path/to/directory']
    }
  },
  {
    id: 'custom-http',
    name: 'custom-server',
    displayName: 'Custom HTTP Server',
    description: 'Connect to a custom HTTP MCP server',
    type: 'http',
    config: {
      url: 'https://your-server.com/mcp'
    }
  }
];

/**
 * Get display name for MCP scope
 */
export function getMCPScopeDisplayName(scope: MCPScope): string {
  switch (scope) {
    case 'user':
      return 'User (Global)';
    case 'project':
      return 'Project';
    case 'local':
      return 'Local';
    default:
      return scope;
  }
}

/**
 * Get file path for MCP scope
 */
export function getMCPConfigPath(scope: MCPScope, projectPath?: string): string {
  switch (scope) {
    case 'user':
      return '~/.claude.json';
    case 'project':
      return projectPath ? `${projectPath}/.mcp.json` : '.mcp.json';
    case 'local':
      return projectPath
        ? `${projectPath}/.claude/settings.local.json`
        : '.claude/settings.local.json';
    default:
      return '';
  }
}

/**
 * Create a unique ID for an MCP server
 */
export function createMCPServerId(name: string, scope: MCPScope): string {
  return `${scope}:${name}`;
}

/**
 * Parse MCP server ID to get name and scope
 */
export function parseMCPServerId(id: string): { name: string; scope: MCPScope } | null {
  const parts = id.split(':');
  if (parts.length < 2) return null;
  return {
    scope: parts[0] as MCPScope,
    name: parts.slice(1).join(':')
  };
}

/**
 * Infer MCP server type from config
 */
export function inferMCPServerType(config: MCPServerConfig): MCPServerType {
  if (config.type) return config.type;
  if (config.command) return 'stdio';
  if (config.url) {
    // SSE is deprecated, default to http
    return 'http';
  }
  return 'http';
}

/**
 * Convert raw config to MCPServer with metadata
 */
export function configToMCPServer(
  name: string,
  config: MCPServerConfig,
  scope: MCPScope,
  sourcePath: string,
  enabled: boolean = true
): MCPServer {
  return {
    id: createMCPServerId(name, scope),
    name,
    type: inferMCPServerType(config),
    url: config.url,
    command: config.command,
    args: config.args,
    headers: config.headers,
    env: config.env,
    scope,
    sourcePath,
    enabled
  };
}

/**
 * Convert MCPServer to raw config for saving
 */
export function mcpServerToConfig(server: MCPServer): MCPServerConfig {
  const config: MCPServerConfig = {
    type: server.type
  };

  if (server.type === 'stdio') {
    if (server.command) config.command = server.command;
    if (server.args && server.args.length > 0) config.args = server.args;
  } else {
    if (server.url) config.url = server.url;
    if (server.headers && Object.keys(server.headers).length > 0) {
      config.headers = server.headers;
    }
  }

  if (server.env && Object.keys(server.env).length > 0) {
    config.env = server.env;
  }

  return config;
}

/**
 * Validate MCP server configuration
 */
export function validateMCPServer(server: Partial<MCPServer>): string[] {
  const errors: string[] = [];

  if (!server.name || server.name.trim().length === 0) {
    errors.push('Server name is required');
  }

  if (server.name && !/^[a-z0-9-_]+$/i.test(server.name)) {
    errors.push('Server name can only contain letters, numbers, hyphens, and underscores');
  }

  if (server.type === 'stdio') {
    if (!server.command || server.command.trim().length === 0) {
      errors.push('Command is required for stdio servers');
    }
  } else if (server.type === 'http' || server.type === 'sse') {
    if (!server.url || server.url.trim().length === 0) {
      errors.push('URL is required for HTTP/SSE servers');
    } else {
      try {
        // Allow ${VAR} patterns in URL
        const testUrl = server.url.replace(/\$\{[^}]+\}/g, 'placeholder');
        new URL(testUrl);
      } catch {
        errors.push('Invalid URL format');
      }
    }
  }

  return errors;
}
