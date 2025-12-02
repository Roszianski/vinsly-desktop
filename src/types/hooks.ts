/**
 * Claude Code Hooks Types
 * For managing Claude Code's hook configurations
 *
 * Hooks allow running shell commands at specific lifecycle events
 * during Claude Code execution.
 */

/**
 * Hook event types that trigger hook execution
 */
export type HookEventType =
  | 'PreToolUse'
  | 'PostToolUse'
  | 'Notification'
  | 'Stop'
  | 'SubagentStop';

/**
 * Scope where the hook is configured
 */
export type HookScope = 'user' | 'project' | 'local';

/**
 * Raw hook configuration as stored in settings files
 */
export interface HookConfig {
  type: HookEventType;
  matcher?: string;                          // Regex/glob pattern for filtering (e.g., tool names)
  command: string;                           // Shell command to execute
  timeout?: number;                          // Timeout in milliseconds
}

/**
 * Hooks configuration in settings file
 */
export interface HooksSettingsFile {
  hooks?: {
    [K in HookEventType]?: HookConfig[];
  };
}

/**
 * Hook with metadata for UI display
 */
export interface Hook {
  id: string;                                // Unique ID for UI
  name: string;                              // User-friendly name
  type: HookEventType;                       // Event that triggers this hook
  matcher?: string;                          // Filter pattern (regex for tools, etc.)
  command: string;                           // Shell command to run
  timeout?: number;                          // Timeout in ms (default: 60000)
  scope: HookScope;                          // Where it's configured
  sourcePath: string;                        // File path it came from
  enabled: boolean;                          // Whether it's enabled
  isFavorite?: boolean;                      // User favorite
  description?: string;                      // Optional description
}

/**
 * Template for creating new hooks
 */
export interface HookTemplate {
  id: string;
  name: string;
  displayName: string;
  description: string;
  type: HookEventType;
  config: Omit<HookConfig, 'type'>;
}

/**
 * Built-in hook templates
 */
export const HOOK_TEMPLATES: HookTemplate[] = [
  {
    id: 'pre-tool-log',
    name: 'tool-usage-logger',
    displayName: 'Tool Usage Logger',
    description: 'Log tool usage before execution',
    type: 'PreToolUse',
    config: {
      command: 'echo "Using tool: $TOOL_NAME" >> ~/.claude/tool-log.txt'
    }
  },
  {
    id: 'post-tool-notify',
    name: 'tool-complete-notify',
    displayName: 'Tool Completion Notifier',
    description: 'Notify when a tool completes',
    type: 'PostToolUse',
    config: {
      command: 'osascript -e \'display notification "Tool completed: $TOOL_NAME" with title "Claude Code"\''
    }
  },
  {
    id: 'bash-safety',
    name: 'bash-command-validator',
    displayName: 'Bash Command Validator',
    description: 'Validate bash commands before execution',
    type: 'PreToolUse',
    config: {
      matcher: 'Bash',
      command: 'echo "$TOOL_INPUT" | jq -r ".command" | grep -qE "^(rm -rf|sudo|shutdown)" && exit 1 || exit 0'
    }
  },
  {
    id: 'notification-log',
    name: 'notification-logger',
    displayName: 'Notification Logger',
    description: 'Log all Claude notifications',
    type: 'Notification',
    config: {
      command: 'echo "[$(date)] $MESSAGE" >> ~/.claude/notifications.log'
    }
  },
  {
    id: 'stop-cleanup',
    name: 'session-cleanup',
    displayName: 'Session Cleanup',
    description: 'Clean up temporary files when session stops',
    type: 'Stop',
    config: {
      command: 'rm -rf /tmp/claude-session-*'
    }
  },
  {
    id: 'file-write-backup',
    name: 'file-backup',
    displayName: 'File Backup on Write',
    description: 'Create backup before file writes',
    type: 'PreToolUse',
    config: {
      matcher: 'Write|Edit',
      command: 'FILE=$(echo "$TOOL_INPUT" | jq -r ".file_path") && [ -f "$FILE" ] && cp "$FILE" "$FILE.bak"'
    }
  }
];

/**
 * Get display name for hook event type
 */
export function getHookEventDisplayName(type: HookEventType): string {
  switch (type) {
    case 'PreToolUse':
      return 'Before Tool Use';
    case 'PostToolUse':
      return 'After Tool Use';
    case 'Notification':
      return 'On Notification';
    case 'Stop':
      return 'Session Stop';
    case 'SubagentStop':
      return 'Subagent Stop';
    default:
      return type;
  }
}

/**
 * Get description for hook event type
 */
export function getHookEventDescription(type: HookEventType): string {
  switch (type) {
    case 'PreToolUse':
      return 'Runs before Claude uses a tool. Can block tool execution by returning non-zero exit code.';
    case 'PostToolUse':
      return 'Runs after Claude uses a tool. Receives tool output.';
    case 'Notification':
      return 'Runs when Claude sends a notification message.';
    case 'Stop':
      return 'Runs when the Claude Code session ends.';
    case 'SubagentStop':
      return 'Runs when a subagent completes execution.';
    default:
      return '';
  }
}

/**
 * Get display name for hook scope
 */
export function getHookScopeDisplayName(scope: HookScope): string {
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
 * Get file path for hook scope
 */
export function getHookConfigPath(scope: HookScope, projectPath?: string): string {
  switch (scope) {
    case 'user':
      return '~/.claude/settings.json';
    case 'project':
      return projectPath ? `${projectPath}/.claude/settings.json` : '.claude/settings.json';
    case 'local':
      return projectPath
        ? `${projectPath}/.claude/settings.local.json`
        : '.claude/settings.local.json';
    default:
      return '';
  }
}

/**
 * Create a unique ID for a hook
 */
export function createHookId(name: string, scope: HookScope, index?: number): string {
  return index !== undefined
    ? `${scope}:${name}:${index}`
    : `${scope}:${name}`;
}

/**
 * Parse hook ID to get name and scope
 */
export function parseHookId(id: string): { name: string; scope: HookScope; index?: number } | null {
  const parts = id.split(':');
  if (parts.length < 2) return null;
  return {
    scope: parts[0] as HookScope,
    name: parts[1],
    index: parts[2] ? parseInt(parts[2], 10) : undefined
  };
}

/**
 * Convert raw config to Hook with metadata
 */
export function configToHook(
  config: HookConfig,
  name: string,
  scope: HookScope,
  sourcePath: string,
  index?: number,
  enabled: boolean = true
): Hook {
  return {
    id: createHookId(name, scope, index),
    name,
    type: config.type,
    matcher: config.matcher,
    command: config.command,
    timeout: config.timeout,
    scope,
    sourcePath,
    enabled
  };
}

/**
 * Convert Hook to raw config for saving
 */
export function hookToConfig(hook: Hook): HookConfig {
  const config: HookConfig = {
    type: hook.type,
    command: hook.command
  };

  if (hook.matcher) {
    config.matcher = hook.matcher;
  }

  if (hook.timeout) {
    config.timeout = hook.timeout;
  }

  return config;
}

/**
 * Validate hook configuration
 */
export function validateHook(hook: Partial<Hook>): string[] {
  const errors: string[] = [];

  if (!hook.name || hook.name.trim().length === 0) {
    errors.push('Hook name is required');
  }

  if (hook.name && !/^[a-z0-9-_]+$/i.test(hook.name)) {
    errors.push('Hook name can only contain letters, numbers, hyphens, and underscores');
  }

  if (!hook.type) {
    errors.push('Event type is required');
  }

  if (!hook.command || hook.command.trim().length === 0) {
    errors.push('Command is required');
  }

  if (hook.matcher) {
    try {
      new RegExp(hook.matcher);
    } catch {
      errors.push('Invalid matcher pattern (must be valid regex)');
    }
  }

  if (hook.timeout !== undefined && hook.timeout < 0) {
    errors.push('Timeout must be a positive number');
  }

  return errors;
}

/**
 * Environment variables available to hooks
 */
export const HOOK_ENV_VARIABLES: Record<HookEventType, string[]> = {
  PreToolUse: ['TOOL_NAME', 'TOOL_INPUT', 'SESSION_ID'],
  PostToolUse: ['TOOL_NAME', 'TOOL_INPUT', 'TOOL_OUTPUT', 'TOOL_RESULT', 'SESSION_ID'],
  Notification: ['MESSAGE', 'SESSION_ID'],
  Stop: ['SESSION_ID', 'STOP_REASON'],
  SubagentStop: ['SUBAGENT_ID', 'SUBAGENT_RESULT', 'SESSION_ID']
};

/**
 * Get available environment variables for a hook type
 */
export function getHookEnvVariables(type: HookEventType): string[] {
  return HOOK_ENV_VARIABLES[type] || [];
}
