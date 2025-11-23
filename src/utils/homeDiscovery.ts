import { discoverProjectDirectories } from './tauriCommands';

export const DEFAULT_HOME_DISCOVERY_DEPTH = 12;
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes

interface CacheEntry {
  depth: number;
  includeProtected: boolean;
  timestamp: number;
  directories: string[];
}

let cacheEntry: CacheEntry | null = null;
let inflightPromise: Promise<string[]> | null = null;
let inflightDepth: number | null = null;
let inflightIncludeProtected: boolean | null = null;
let inflightToken = 0;

export interface HomeDiscoveryOptions {
  maxDepth?: number;
  force?: boolean;
  signal?: AbortSignal;
  includeProtectedDirs?: boolean;
}

export async function discoverHomeDirectories(options: HomeDiscoveryOptions = {}): Promise<string[]> {
  const depth = typeof options.maxDepth === 'number' ? Math.max(options.maxDepth, 1) : DEFAULT_HOME_DISCOVERY_DEPTH;
  const includeProtected = options.includeProtectedDirs === true;

  if (options.force) {
    invalidateHomeDiscoveryCache();
    cancelHomeDiscovery();
  }

  if (!options.force) {
    const cached = getCached(depth, includeProtected);
    if (cached) {
      return cached;
    }
  }

  const promise = scheduleDiscovery(depth, includeProtected);
  if (options.signal) {
    return withAbort(promise, options.signal);
  }
  return promise;
}

export function invalidateHomeDiscoveryCache(): void {
  cacheEntry = null;
}

export function cancelHomeDiscovery(): void {
  inflightToken += 1;
  inflightPromise = null;
  inflightDepth = null;
  inflightIncludeProtected = null;
}

function scheduleDiscovery(depth: number, includeProtected: boolean): Promise<string[]> {
  if (inflightPromise && (inflightDepth !== depth || inflightIncludeProtected !== includeProtected)) {
    cancelHomeDiscovery();
  }

  if (!inflightPromise) {
    const token = ++inflightToken;
    inflightDepth = depth;
    inflightIncludeProtected = includeProtected;
    inflightPromise = discoverProjectDirectories({
      maxDepth: depth,
      includeProtectedDirs: includeProtected,
    }).then(result => {
      if (token === inflightToken) {
        setCached(depth, includeProtected, result);
      }
      return result;
    }).finally(() => {
      if (token === inflightToken) {
        inflightPromise = null;
        inflightDepth = null;
        inflightIncludeProtected = null;
      }
    });
  }

  return inflightPromise;
}

function getCached(depth: number, includeProtected: boolean): string[] | null {
  if (!cacheEntry) {
    return null;
  }

  if (cacheEntry.depth !== depth || cacheEntry.includeProtected !== includeProtected) {
    return null;
  }

  if (Date.now() - cacheEntry.timestamp > CACHE_TTL_MS) {
    cacheEntry = null;
    return null;
  }

  return [...cacheEntry.directories];
}

function setCached(depth: number, includeProtected: boolean, directories: string[]): void {
  cacheEntry = {
    depth,
    includeProtected,
    timestamp: Date.now(),
    directories: [...directories],
  };
}

function withAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) {
    return Promise.reject(createAbortError());
  }

  return new Promise<T>((resolve, reject) => {
    const abortHandler = () => reject(createAbortError());
    signal.addEventListener('abort', abortHandler, { once: true });

    promise
      .then(value => {
        signal.removeEventListener('abort', abortHandler);
        if (signal.aborted) {
          reject(createAbortError());
        } else {
          resolve(value);
        }
      })
      .catch(error => {
        signal.removeEventListener('abort', abortHandler);
        reject(error);
      });
  });
}

function createAbortError(): Error {
  const error = new Error('Home directory discovery aborted');
  error.name = 'AbortError';
  return error;
}
