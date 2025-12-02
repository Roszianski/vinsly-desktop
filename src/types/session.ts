/**
 * Claude Code Session Types
 * For detecting and managing live Claude Code sessions
 */

/**
 * Status of a Claude Code session
 */
export type SessionStatus = 'active' | 'idle' | 'error';

/**
 * Information about a detected Claude Code session
 */
export interface ClaudeSession {
  pid: number;                          // Process ID
  workingDirectory: string;             // Current working directory
  startTime: number;                    // Unix timestamp when session started
  status: SessionStatus;                // Current session status
  cpuUsage?: number;                    // CPU usage percentage (0-100)
  memoryUsage?: number;                 // Memory usage in bytes
  commandLine?: string;                 // Full command line
}

/**
 * Raw session info from Rust
 */
export interface ClaudeSessionRaw {
  pid: number;
  working_directory: string;
  start_time: number;
  status: string;
  cpu_usage?: number;
  memory_usage?: number;
  command_line?: string;
}

/**
 * Convert raw session from Rust to ClaudeSession
 */
export function rawToSession(raw: ClaudeSessionRaw): ClaudeSession {
  return {
    pid: raw.pid,
    workingDirectory: raw.working_directory,
    startTime: raw.start_time,
    status: raw.status as SessionStatus,
    cpuUsage: raw.cpu_usage,
    memoryUsage: raw.memory_usage,
    commandLine: raw.command_line,
  };
}

/**
 * Format memory usage for display
 */
export function formatMemoryUsage(bytes?: number): string {
  if (!bytes) return '-';

  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/**
 * Format session uptime for display
 */
export function formatUptime(startTime: number): string {
  const now = Date.now();
  const uptimeMs = now - (startTime * 1000); // startTime is in seconds

  const seconds = Math.floor(uptimeMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

/**
 * Extract project name from working directory
 */
export function getProjectName(workingDirectory: string): string {
  const parts = workingDirectory.split('/');
  return parts[parts.length - 1] || workingDirectory;
}

/**
 * Get status color class for display
 */
export function getStatusColor(status: SessionStatus): string {
  switch (status) {
    case 'active':
      return 'text-green-500';
    case 'idle':
      return 'text-yellow-500';
    case 'error':
      return 'text-red-500';
    default:
      return 'text-gray-500';
  }
}

/**
 * Get status background color class for display
 */
export function getStatusBgColor(status: SessionStatus): string {
  switch (status) {
    case 'active':
      return 'bg-green-500';
    case 'idle':
      return 'bg-yellow-500';
    case 'error':
      return 'bg-red-500';
    default:
      return 'bg-gray-500';
  }
}
