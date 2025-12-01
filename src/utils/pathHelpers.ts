import { homeDir, join, normalize } from '@tauri-apps/api/path';

let cachedHomeDir: string | null = null;

/**
 * Validate that a path doesn't contain traversal sequences that could
 * escape the intended directory scope
 */
export function isPathSafe(path: string): boolean {
  if (!path || typeof path !== 'string') {
    return false;
  }

  const normalized = path.trim();

  // Reject empty or whitespace-only paths
  if (!normalized) {
    return false;
  }

  // Reject null bytes (can cause issues in file system operations)
  if (normalized.includes('\0')) {
    return false;
  }

  // Check for parent directory traversal patterns
  // These patterns could allow escaping the intended directory
  const dangerousPatterns = [
    /\/\.\.\//,    // Unix-style parent directory (/../)
    /\\\.\.\\/,    // Windows-style parent directory (\..\)
    /^\.\.[\\/]/,  // Starts with parent directory (../ or ..\)
    /[\\/]\.\./,   // Separator followed by parent directory (/.. or \..)
    /\.\.[\\/]/,   // Parent directory with separator (../ or ..\)
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(normalized)) {
      return false;
    }
  }

  return true;
}

/**
 * Validate that a resolved path is within an allowed base directory
 * @param resolvedPath - The absolute path to validate
 * @param basePath - The base directory that the path must be within
 */
export function isPathWithinBase(resolvedPath: string, basePath: string): boolean {
  // Normalize both paths to ensure consistent comparison
  const normalizedResolved = resolvedPath.replace(/\\/g, '/').replace(/\/+$/, '');
  const normalizedBase = basePath.replace(/\\/g, '/').replace(/\/+$/, '');

  // Check if the resolved path starts with the base path
  return normalizedResolved.startsWith(normalizedBase + '/') || normalizedResolved === normalizedBase;
}

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

  // Validate path safety before processing
  if (!isPathSafe(normalized)) {
    console.warn('Unsafe path detected:', normalized);
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
