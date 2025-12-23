import { invoke } from '@tauri-apps/api/core';

/**
 * Get the default shell for the current platform
 */
export async function getDefaultShell(): Promise<string> {
  return await invoke<string>('terminal_get_default_shell');
}

/**
 * Create a new terminal session
 * @param workingDir - Optional working directory (defaults to home)
 * @param shell - Optional shell override (defaults to system shell)
 * @param cols - Terminal width in columns
 * @param rows - Terminal height in rows
 * @returns Terminal session ID
 */
export async function createTerminal(
  workingDir?: string,
  shell?: string,
  cols: number = 80,
  rows: number = 24
): Promise<string> {
  return await invoke<string>('terminal_create', {
    workingDir: workingDir ?? null,
    shell: shell ?? null,
    cols,
    rows,
  });
}

/**
 * Write data to a terminal's stdin
 * @param terminalId - Terminal session ID
 * @param data - Base64 encoded data to write
 */
export async function writeToTerminal(terminalId: string, data: string): Promise<void> {
  return await invoke('terminal_write', {
    terminalId,
    data,
  });
}

/**
 * Resize a terminal
 * @param terminalId - Terminal session ID
 * @param cols - New width in columns
 * @param rows - New height in rows
 */
export async function resizeTerminal(
  terminalId: string,
  cols: number,
  rows: number
): Promise<void> {
  return await invoke('terminal_resize', {
    terminalId,
    cols,
    rows,
  });
}

/**
 * Close a terminal and kill its process
 * @param terminalId - Terminal session ID
 */
export async function closeTerminal(terminalId: string): Promise<void> {
  return await invoke('terminal_close', {
    terminalId,
  });
}

/**
 * Close all terminals (for app cleanup)
 * @returns Array of closed terminal IDs
 */
export async function closeAllTerminals(): Promise<string[]> {
  return await invoke<string[]>('terminal_close_all');
}
