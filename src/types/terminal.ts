/**
 * Terminal type definitions for the integrated terminal feature
 */

/**
 * Represents a single terminal session
 */
export interface TerminalSession {
  id: string;
  title: string;
  workingDirectory: string;
  createdAt: Date;
}

/**
 * Terminal size in columns and rows
 */
export interface TerminalSize {
  cols: number;
  rows: number;
}

/**
 * Terminal panel state for persistence
 */
export interface TerminalPanelState {
  isOpen: boolean;
  height: number;
  activeTabId: string | null;
  fontSize: number;
}

/**
 * Event payload for terminal output from backend
 */
export interface TerminalOutputEvent {
  terminal_id: string;
  data: string; // Base64 encoded
}

/**
 * Event payload for terminal exit from backend
 */
export interface TerminalExitEvent {
  terminal_id: string;
  exit_code: number | null;
}
