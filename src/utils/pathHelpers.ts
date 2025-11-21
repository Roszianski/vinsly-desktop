import { homeDir, join } from '@tauri-apps/api/path';

let cachedHomeDir: string | null = null;

async function getHomeDirectory(): Promise<string> {
  if (cachedHomeDir) {
    return cachedHomeDir;
  }
  const resolved = await homeDir();
  cachedHomeDir = resolved.replace(/[\\\/]+$/, '');
  return cachedHomeDir;
}

/**
 * Resolve stored agent paths (which might use ~ or be relative) into absolute
 * filesystem paths suitable for native operations.
 */
export async function resolveAgentPath(rawPath?: string): Promise<string | null> {
  if (!rawPath) {
    return null;
  }

  const normalized = rawPath.trim();
  if (!normalized) {
    return null;
  }

  // Already absolute on POSIX
  if (normalized.startsWith('/')) {
    return normalized;
  }

  // Windows absolute path (e.g., C:\ or \\?\)
  if (/^[a-zA-Z]:[\\/]/.test(normalized) || normalized.startsWith('\\\\')) {
    return normalized;
  }

  // Expand tilde
  if (normalized === '~' || normalized.startsWith('~/') || normalized.startsWith('~\\')) {
    const home = await getHomeDirectory();
    const remainder = normalized.length > 1 ? normalized.slice(2) : '';
    return remainder ? await join(home, remainder) : home;
  }

  // Paths like ".claude/agents/xyz.md" should resolve inside the home directory
  const hasRelativePrefix =
    normalized.startsWith('./') ||
    normalized.startsWith('.\\');
  const withoutRelative = hasRelativePrefix ? normalized.slice(2) : normalized;

  if (
    withoutRelative.startsWith('.claude')
  ) {
    const home = await getHomeDirectory();
    return await join(home, withoutRelative);
  }

  // We can't reliably resolve relative project paths here
  return null;
}
