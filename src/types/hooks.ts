/**
 * Claude Code Hooks Types
 * For managing Claude Code's hook configurations
 *
 * Hooks allow running shell commands or LLM-based prompts at specific
 * lifecycle events during Claude Code execution.
 *
 * Based on official Claude Code hooks specification:
 * https://docs.anthropic.com/en/docs/claude-code/hooks
 */

/**
 * Hook event types that trigger hook execution
 * Complete list from Claude Code official documentation (12 events)
 */
export type HookEventType =
  | 'PreToolUse'           // Before tool execution
  | 'PostToolUse'          // After tool execution
  | 'PostToolUseFailure'   // After tool execution fails
  | 'PermissionRequest'    // When a permission dialog is displayed
  | 'Notification'         // When notifications are sent
  | 'UserPromptSubmit'     // When the user submits a prompt
  | 'Stop'                 // Right before Claude concludes its response
  | 'SubagentStart'        // When a subagent (Task tool call) is started
  | 'SubagentStop'         // Right before a subagent concludes its response
  | 'PreCompact'           // Before conversation compaction
  | 'SessionStart'         // When a new session is started
  | 'SessionEnd';          // When a session is ending

/**
 * Hook type - command (bash) or prompt (LLM-based)
 */
export type HookExecutionType = 'command' | 'prompt';

/**
 * Scope where the hook is configured
 */
export type HookScope = 'user' | 'project' | 'local';

/**
 * Raw hook configuration as stored in settings files
 * Supports both command (bash) and prompt (LLM-based) hook types
 */
export interface HookConfig {
  type: HookExecutionType;                   // 'command' for bash, 'prompt' for LLM-based
  matcher?: string;                          // Regex/glob pattern for filtering (e.g., tool names)
  command?: string;                          // Shell command to execute (for type: 'command')
  prompt?: string;                           // LLM prompt to evaluate (for type: 'prompt')
  timeout?: number;                          // Timeout in seconds (default: 60)
}

/**
 * Hook input provided via stdin as JSON
 * This is the context passed to hook scripts
 */
export interface HookInput {
  session_id: string;
  transcript_path: string;
  cwd: string;
  permission_mode: 'default' | 'plan' | 'acceptEdits' | 'bypassPermissions';
  hook_event_name: HookEventType;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
}

/**
 * Hook output JSON structure
 * Returned by hooks to control execution flow
 */
export interface HookOutput {
  continue?: boolean;                        // Whether to continue execution
  stopReason?: string;                       // Reason for stopping (shown to user)
  suppressOutput?: boolean;                  // Hide hook output
  systemMessage?: string;                    // Warning message to display
  hookSpecificOutput?: HookSpecificOutput;   // Event-specific output
}

/**
 * Prompt-based hook response schema
 */
export interface PromptHookResponse {
  decision: 'approve' | 'block';
  reason: string;
  continue?: boolean;
  stopReason?: string;
  systemMessage?: string;
}

/**
 * Event-specific hook output
 */
export interface HookSpecificOutput {
  hookEventName: HookEventType;
  // PreToolUse specific
  permissionDecision?: 'allow' | 'deny' | 'ask';
  permissionDecisionReason?: string;
  updatedInput?: Record<string, unknown>;
  // PermissionRequest specific
  decision?: {
    behavior: 'allow' | 'deny';
    updatedInput?: Record<string, unknown>;
    message?: string;
    interrupt?: boolean;
  };
  // UserPromptSubmit / SessionStart specific
  additionalContext?: string;
}

/**
 * Event types that support matcher patterns
 * Per official Claude Code docs: tool-related events plus PreCompact and SessionStart
 */
export const EVENTS_WITH_MATCHER_SUPPORT: HookEventType[] = [
  'PreToolUse',
  'PostToolUse',
  'PostToolUseFailure',
  'PermissionRequest',
  'Notification',
  'PreCompact',
  'SessionStart',
];

/**
 * Event types that support prompt-based hooks (LLM evaluation)
 * Per official Claude Code docs
 */
export const EVENTS_WITH_PROMPT_SUPPORT: HookEventType[] = [
  'PreToolUse',
  'PermissionRequest',
  'UserPromptSubmit',
  'Stop',
  'SubagentStop',
];

/**
 * Check if an event type supports prompt-based hooks
 */
export function eventSupportsPromptHooks(eventType: HookEventType): boolean {
  return EVENTS_WITH_PROMPT_SUPPORT.includes(eventType);
}

/**
 * Check if an event type supports matchers
 */
export function eventSupportsMatchers(eventType: HookEventType): boolean {
  return EVENTS_WITH_MATCHER_SUPPORT.includes(eventType);
}

/**
 * Tool matchers - available tools that can be matched
 * Used for PreToolUse, PostToolUse, PostToolUseFailure, PermissionRequest
 */
export const TOOL_MATCHERS = [
  'Task',
  'TaskOutput',
  'Bash',
  'Glob',
  'Grep',
  'ExitPlanMode',
  'Read',
  'Edit',
  'Write',
  'NotebookEdit',
  'WebFetch',
  'TodoWrite',
  'WebSearch',
  'KillShell',
  'AskUserQuestion',
  'Skill',
  'EnterPlanMode',
] as const;

/**
 * Notification matchers - notification types that can be matched
 */
export const NOTIFICATION_MATCHERS = [
  'permission_prompt',
  'idle_prompt',
  'auth_success',
  'elicitation_dialog',
] as const;

/**
 * PreCompact matchers - compaction triggers
 */
export const PRECOMPACT_MATCHERS = ['manual', 'auto'] as const;

/**
 * SessionStart matchers - session start sources
 */
export const SESSION_START_MATCHERS = ['startup', 'resume', 'clear', 'compact'] as const;

/**
 * Matcher category types
 */
export type MatcherCategory = 'tool' | 'notification' | 'precompact' | 'session_start';

/**
 * Get matchers available for an event type
 */
export function getMatchersForEvent(eventType: HookEventType): {
  category: MatcherCategory;
  matchers: readonly string[];
  label: string;
  hint: string;
} | null {
  switch (eventType) {
    case 'PreToolUse':
    case 'PostToolUse':
    case 'PostToolUseFailure':
    case 'PermissionRequest':
      return {
        category: 'tool',
        matchers: TOOL_MATCHERS,
        label: 'Select tools to match',
        hint: 'Choose which tools will trigger this hook. Leave empty to match all tools.',
      };
    case 'Notification':
      return {
        category: 'notification',
        matchers: NOTIFICATION_MATCHERS,
        label: 'Select notification types',
        hint: 'Choose which notification types will trigger this hook.',
      };
    case 'PreCompact':
      return {
        category: 'precompact',
        matchers: PRECOMPACT_MATCHERS,
        label: 'Select compaction triggers',
        hint: 'Choose which compaction triggers will run this hook.',
      };
    case 'SessionStart':
      return {
        category: 'session_start',
        matchers: SESSION_START_MATCHERS,
        label: 'Select session start sources',
        hint: 'Choose which session start sources will trigger this hook.',
      };
    default:
      return null;
  }
}

/**
 * Exit code behaviors for hooks
 */
export interface ExitCodeBehavior {
  code: number | string;
  description: string;
  behavior: string;
  colorClass: string;
}

export const EXIT_CODE_BEHAVIORS: ExitCodeBehavior[] = [
  {
    code: 0,
    description: 'Success',
    behavior: 'stdout/stderr not shown (or added to context for some events)',
    colorClass: 'bg-green-500/10 text-green-600 dark:text-green-400',
  },
  {
    code: 2,
    description: 'Block operation',
    behavior: 'Show stderr to model and block the operation',
    colorClass: 'bg-red-500/10 text-red-600 dark:text-red-400',
  },
  {
    code: 'Other',
    description: 'Continue with warning',
    behavior: 'Show stderr to user only but continue execution',
    colorClass: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
  },
];

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
  eventType: HookEventType;                  // Event that triggers this hook
  executionType: HookExecutionType;          // 'command' or 'prompt'
  matcher?: string;                          // Filter pattern (regex for tools, etc.)
  command?: string;                          // Shell command to run (for command type)
  prompt?: string;                           // LLM prompt to evaluate (for prompt type)
  timeout?: number;                          // Timeout in seconds (default: 60)
  scope: HookScope;                          // Where it's configured
  sourcePath: string;                        // File path it came from
  enabled: boolean;                          // Whether it's enabled
  isFavorite?: boolean;                      // User favorite
  description?: string;                      // Optional description
}

/**
 * Legacy Hook interface for backwards compatibility
 * @deprecated Use Hook interface with eventType and executionType
 */
export interface LegacyHook {
  id: string;
  name: string;
  type: HookEventType;                       // Legacy: was event type
  matcher?: string;
  command: string;
  timeout?: number;
  scope: HookScope;
  sourcePath: string;
  enabled: boolean;
  isFavorite?: boolean;
  description?: string;
}

/**
 * Template for creating new hooks
 */
export interface HookTemplate {
  id: string;
  name: string;
  displayName: string;
  description: string;
  eventType: HookEventType;
  executionType: HookExecutionType;
  config: Omit<HookConfig, 'type'>;
}

/**
 * Built-in hook templates
 * Includes both command (bash) and prompt (LLM-based) examples
 */
export const HOOK_TEMPLATES: HookTemplate[] = [
  // Command-based templates
  {
    id: 'pre-tool-log',
    name: 'tool-usage-logger',
    displayName: 'Tool Usage Logger',
    description: 'Log tool usage before execution',
    eventType: 'PreToolUse',
    executionType: 'command',
    config: {
      command: 'echo "[$(date)] Using tool: $TOOL_NAME" >> ~/.claude/tool-log.txt'
    }
  },
  {
    id: 'bash-safety',
    name: 'bash-command-validator',
    displayName: 'Bash Command Validator',
    description: 'Block dangerous commands like rm -rf or sudo',
    eventType: 'PreToolUse',
    executionType: 'command',
    config: {
      matcher: 'Bash',
      command: 'echo "$TOOL_INPUT" | jq -r ".command" | grep -qE "^(rm -rf|sudo|shutdown)" && exit 1 || exit 0'
    }
  },
  {
    id: 'file-write-backup',
    name: 'file-backup',
    displayName: 'File Backup on Write',
    description: 'Create backup before file writes',
    eventType: 'PreToolUse',
    executionType: 'command',
    config: {
      matcher: 'Write|Edit',
      command: 'FILE=$(echo "$TOOL_INPUT" | jq -r ".file_path") && [ -f "$FILE" ] && cp "$FILE" "$FILE.bak"'
    }
  },
  {
    id: 'session-start-env',
    name: 'session-env-setup',
    displayName: 'Session Environment Setup',
    description: 'Set up environment variables at session start',
    eventType: 'SessionStart',
    executionType: 'command',
    config: {
      command: '[ -n "$CLAUDE_ENV_FILE" ] && echo \'export NODE_ENV=development\' >> "$CLAUDE_ENV_FILE"'
    }
  },
  {
    id: 'permission-auto-approve',
    name: 'auto-approve-reads',
    displayName: 'Auto-approve Read Operations',
    description: 'Automatically approve read operations for safe files',
    eventType: 'PermissionRequest',
    executionType: 'command',
    config: {
      matcher: 'Read',
      command: 'python3 -c "import json,sys;d=json.load(sys.stdin);p=d.get(\'tool_input\',{}).get(\'file_path\',\'\');print(json.dumps({\'decision\':\'approve\'}) if p.endswith((\'.md\',\'.txt\',\'.json\')) else \'\')"'
    }
  }
];

/**
 * Get display name for hook event type
 * Uses the exact event type names from Claude Code
 */
export function getHookEventDisplayName(type: HookEventType): string {
  // Return the exact event type name (matching Claude Code)
  return type;
}

/**
 * Get description for hook event type
 * Matches Claude Code's exact descriptions
 */
export function getHookEventDescription(type: HookEventType): string {
  switch (type) {
    case 'PreToolUse':
      return 'Before tool execution';
    case 'PostToolUse':
      return 'After tool execution';
    case 'PostToolUseFailure':
      return 'After tool execution fails';
    case 'PermissionRequest':
      return 'When a permission dialog is displayed';
    case 'Notification':
      return 'When notifications are sent';
    case 'UserPromptSubmit':
      return 'When the user submits a prompt';
    case 'Stop':
      return 'Right before Claude concludes its response';
    case 'SubagentStart':
      return 'When a subagent (Task tool call) is started';
    case 'SubagentStop':
      return 'Right before a subagent (Task tool call) concludes its response';
    case 'PreCompact':
      return 'Before conversation compaction';
    case 'SessionStart':
      return 'When a new session is started';
    case 'SessionEnd':
      return 'When a session is ending';
    default:
      return '';
  }
}

/**
 * Get display name for hook execution type
 */
export function getHookExecutionTypeDisplayName(type: HookExecutionType): string {
  switch (type) {
    case 'command':
      return 'Command (Bash)';
    case 'prompt':
      return 'Prompt (LLM)';
    default:
      return type;
  }
}

/**
 * Get description for hook execution type
 */
export function getHookExecutionTypeDescription(type: HookExecutionType): string {
  switch (type) {
    case 'command':
      return 'Execute a shell command. Exit code 0 = success, exit code 2 = block.';
    case 'prompt':
      return 'Evaluate using an LLM. Returns JSON with decision (approve/block).';
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
  eventType: HookEventType,
  name: string,
  scope: HookScope,
  sourcePath: string,
  index?: number,
  enabled: boolean = true
): Hook {
  return {
    id: createHookId(name, scope, index),
    name,
    eventType,
    executionType: config.type,
    matcher: config.matcher,
    command: config.command,
    prompt: config.prompt,
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
    type: hook.executionType,
  };

  if (hook.executionType === 'command' && hook.command) {
    config.command = hook.command;
  }

  if (hook.executionType === 'prompt' && hook.prompt) {
    config.prompt = hook.prompt;
  }

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

  if (!hook.eventType) {
    errors.push('Event type is required');
  }

  if (!hook.executionType) {
    errors.push('Execution type is required');
  }

  // Validate based on execution type
  if (hook.executionType === 'command') {
    if (!hook.command || hook.command.trim().length === 0) {
      errors.push('Command is required for command-type hooks');
    }
  } else if (hook.executionType === 'prompt') {
    if (!hook.prompt || hook.prompt.trim().length === 0) {
      errors.push('Prompt is required for prompt-type hooks');
    }
    // Prompt hooks only supported for specific events
    if (hook.eventType && !eventSupportsPromptHooks(hook.eventType)) {
      errors.push(`Prompt hooks are not supported for "${hook.eventType}". Use command type instead.`);
    }
  }

  // Validate matcher if provided
  if (hook.matcher) {
    // Check if this event type supports matchers
    if (hook.eventType && !eventSupportsMatchers(hook.eventType)) {
      errors.push(`Event type "${hook.eventType}" does not support matchers`);
    }
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
 * Per official Claude Code docs, only 3 env vars are provided:
 * - CLAUDE_PROJECT_DIR: Absolute path to project root
 * - CLAUDE_CODE_REMOTE: "true" if running in web, empty for local CLI
 * - CLAUDE_ENV_FILE: Path to persist env vars (SessionStart only)
 *
 * All other context is provided via stdin JSON, not environment variables.
 */
export const HOOK_ENV_VARIABLES = [
  'CLAUDE_PROJECT_DIR',      // Absolute path to project root
  'CLAUDE_CODE_REMOTE',      // "true" if web environment, empty/unset for local
];

/**
 * Additional env var for SessionStart only
 */
export const SESSION_START_ENV_VARIABLES = [
  ...HOOK_ENV_VARIABLES,
  'CLAUDE_ENV_FILE',         // Path to file for persisting environment variables
];

/**
 * Variables available in prompt-based hooks (via $ARGUMENTS placeholder)
 */
export const PROMPT_HOOK_VARIABLES = ['$ARGUMENTS'];

/**
 * Get available environment variables for a hook event type
 */
export function getHookEnvVariables(type: HookEventType): string[] {
  if (type === 'SessionStart') {
    return SESSION_START_ENV_VARIABLES;
  }
  return HOOK_ENV_VARIABLES;
}

/**
 * Get stdin input fields for a hook event type
 * All hook context is provided via JSON stdin (not environment variables)
 * Per official Claude Code documentation
 */
export function getHookStdinFields(type: HookEventType): string[] {
  const commonFields = [
    'session_id',
    'transcript_path',
    'cwd',
    'permission_mode',
    'hook_event_name',
  ];

  const eventSpecificFields: Record<HookEventType, string[]> = {
    PreToolUse: ['tool_name', 'tool_input', 'tool_use_id'],
    PostToolUse: ['tool_name', 'tool_input', 'tool_response', 'tool_use_id'],
    PostToolUseFailure: ['tool_name', 'tool_input', 'tool_error', 'tool_use_id'],
    PermissionRequest: ['tool_name', 'tool_input', 'tool_use_id'],
    Notification: ['message', 'notification_type'],
    UserPromptSubmit: ['prompt'],
    Stop: ['stop_hook_active'],
    SubagentStart: ['subagent_id', 'task'],
    SubagentStop: ['stop_hook_active'],
    PreCompact: ['trigger', 'custom_instructions'],
    SessionStart: ['source'],
    SessionEnd: ['reason'],
  };

  return [...commonFields, ...(eventSpecificFields[type] || [])];
}

/**
 * Stdin field descriptions for documentation in UI
 */
export const STDIN_FIELD_DESCRIPTIONS: Record<string, string> = {
  session_id: 'Unique session identifier',
  transcript_path: 'Path to transcript JSONL file',
  cwd: 'Current working directory',
  permission_mode: 'Current permission mode (default|plan|acceptEdits|bypassPermissions)',
  hook_event_name: 'Name of the hook event',
  tool_name: 'Name of the tool being used',
  tool_input: 'JSON object with tool parameters',
  tool_response: 'Tool execution result (PostToolUse)',
  tool_error: 'Error message from failed tool execution (PostToolUseFailure)',
  tool_use_id: 'Unique identifier for this tool use',
  message: 'Notification message text',
  notification_type: 'Type: permission_prompt|idle_prompt|auth_success|elicitation_dialog',
  prompt: 'User\'s submitted prompt text',
  stop_hook_active: 'true if continuing from a previous stop hook',
  subagent_id: 'Unique identifier for the subagent',
  task: 'The task description passed to the subagent',
  trigger: 'Compaction trigger: manual|auto',
  custom_instructions: 'Optional custom instructions for compaction',
  source: 'Session source: startup|resume|clear|compact',
  reason: 'End reason: clear|logout|prompt_input_exit|other',
};
