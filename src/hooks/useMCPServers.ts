import { useCallback, useState, useRef, useEffect } from 'react';
import {
  listMCPServers,
  addMCPServer as addMCPServerCmd,
  removeMCPServer as removeMCPServerCmd,
  MCPServerInfoRaw,
  MCPServerConfigRaw,
} from '../utils/tauriCommands';
import {
  MCPServer,
  MCPScope,
  MCPServerType,
  createMCPServerId,
  mcpServerToConfig,
} from '../types/mcp';
import { ToastType } from '../components/Toast';
import { devLog } from '../utils/devLogger';
import { getStorageItem, setStorageItem } from '../utils/storage';

const MCP_CACHE_KEY = 'vinsly-mcp-servers-cache';
const MCP_SEEN_KEY = 'vinsly-seen-mcp-ids';

/**
 * Convert raw server info from Rust to MCPServer type
 */
function rawToMCPServer(raw: MCPServerInfoRaw): MCPServer {
  return {
    id: createMCPServerId(raw.name, raw.scope as MCPScope),
    name: raw.name,
    type: (raw.server_type || 'http') as MCPServerType,
    url: raw.url,
    command: raw.command,
    args: raw.args,
    headers: raw.headers,
    env: raw.env,
    scope: raw.scope as MCPScope,
    sourcePath: raw.source_path,
    enabled: raw.enabled,
  };
}

/**
 * Convert MCPServer to raw config for Rust
 */
function mcpServerToRawConfig(server: MCPServer): MCPServerConfigRaw {
  const config = mcpServerToConfig(server);
  return {
    type: config.type,
    url: config.url,
    command: config.command,
    args: config.args,
    headers: config.headers,
    env: config.env,
  };
}

export interface UseMCPServersOptions {
  showToast: (type: ToastType, message: string) => void;
}

export interface LoadServersOptions {
  projectPaths?: string[];
  includeGlobal?: boolean;
}

export interface UseMCPServersResult {
  servers: MCPServer[];
  serversRef: React.RefObject<MCPServer[]>;
  isLoading: boolean;
  loadServers: (options?: LoadServersOptions) => Promise<{ total: number; newCount: number }>;
  addServer: (server: MCPServer, projectPath?: string) => Promise<void>;
  updateServer: (server: MCPServer, oldServer: MCPServer, projectPath?: string) => Promise<void>;
  removeServer: (name: string, scope: MCPScope, projectPath?: string) => Promise<void>;
  toggleFavorite: (server: MCPServer) => void;
  getServerById: (id: string) => MCPServer | undefined;
  getServerByName: (name: string, scope: MCPScope) => MCPServer | undefined;
}

export function useMCPServers({ showToast }: UseMCPServersOptions): UseMCPServersResult {
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCacheReady, setIsCacheReady] = useState(false);
  const serversRef = useRef<MCPServer[]>([]);
  const cacheHydrated = useRef(false);

  // Keep ref in sync with state
  serversRef.current = servers;

  // Hydrate from cache on mount
  useEffect(() => {
    if (cacheHydrated.current) return;

    const hydrateCache = async () => {
      try {
        const cached = await getStorageItem<MCPServer[]>(MCP_CACHE_KEY);
        if (cached && cached.length > 0 && serversRef.current.length === 0) {
          setServers(cached);
        }
      } catch (error) {
        devLog.error('Failed to hydrate MCP servers cache:', error);
      } finally {
        cacheHydrated.current = true;
        setIsCacheReady(true);
      }
    };

    void hydrateCache();
  }, []);

  // Persist to cache when servers change
  useEffect(() => {
    if (!isCacheReady) return;
    setStorageItem(MCP_CACHE_KEY, servers);
  }, [servers, isCacheReady]);

  const loadServers = useCallback(async (options: LoadServersOptions = {}): Promise<{ total: number; newCount: number }> => {
    const { projectPaths = [], includeGlobal = true } = options;
    setIsLoading(true);
    try {
      const allServers: MCPServer[] = [];
      const currentIds = new Set<string>();

      const addServer = (server: MCPServer) => {
        if (currentIds.has(server.id)) return;
        currentIds.add(server.id);
        allServers.push(server);
      };

      // Load global servers
      if (includeGlobal) {
        const globalServers = await listMCPServers();
        for (const raw of globalServers) {
          addServer(rawToMCPServer(raw));
        }
      }

      // Load project-specific servers
      for (const projectPath of projectPaths) {
        try {
          const projectServers = await listMCPServers(projectPath);
          for (const raw of projectServers) {
            addServer(rawToMCPServer(raw));
          }
        } catch (error) {
          devLog.error(`Error loading MCP servers from ${projectPath}:`, error);
        }
      }

      // Track new items by comparing with previously seen IDs
      let seenIds: string[] = [];
      try {
        seenIds = await getStorageItem<string[]>(MCP_SEEN_KEY) || [];
      } catch {
        seenIds = [];
      }
      const seenSet = new Set(seenIds);
      const newCount = allServers.filter(s => !seenSet.has(s.id)).length;

      // Update seen IDs with all current server IDs
      const updatedSeenIds = Array.from(new Set([...seenIds, ...allServers.map(s => s.id)]));
      await setStorageItem(MCP_SEEN_KEY, updatedSeenIds);

      setServers(allServers);
      return { total: allServers.length, newCount };
    } catch (error) {
      devLog.error('Failed to load MCP servers:', error);
      showToast('error', `Failed to load MCP servers: ${error}`);
      return { total: 0, newCount: 0 };
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  const addServer = useCallback(async (server: MCPServer, projectPath?: string) => {
    try {
      const rawConfig = mcpServerToRawConfig(server);
      await addMCPServerCmd(server.scope, server.name, rawConfig, projectPath);

      // Add to local state
      setServers(prev => {
        // Remove any existing server with the same name and scope
        const filtered = prev.filter(
          s => !(s.name === server.name && s.scope === server.scope)
        );
        return [...filtered, server];
      });

      showToast('success', `Added MCP server "${server.name}"`);
    } catch (error) {
      devLog.error('Failed to add MCP server:', error);
      showToast('error', `Failed to add MCP server: ${error}`);
      throw error;
    }
  }, [showToast]);

  const updateServer = useCallback(async (server: MCPServer, oldServer: MCPServer, projectPath?: string) => {
    try {
      // If name changed, remove the old entry first to avoid duplicates
      if (oldServer.name !== server.name) {
        try {
          await removeMCPServerCmd(oldServer.scope, oldServer.name, projectPath);
        } catch (removeError) {
          devLog.warn('Failed to remove old MCP server entry:', removeError);
        }
      }

      const rawConfig = mcpServerToRawConfig(server);
      await addMCPServerCmd(server.scope, server.name, rawConfig, projectPath);

      // Update local state - filter by old server ID
      setServers(prev => {
        const filtered = prev.filter(s => s.id !== oldServer.id);
        return [...filtered, server];
      });

      showToast('success', `Updated MCP server "${server.name}"`);
    } catch (error) {
      devLog.error('Failed to update MCP server:', error);
      showToast('error', `Failed to update MCP server: ${error}`);
      throw error;
    }
  }, [showToast]);

  const removeServer = useCallback(async (
    name: string,
    scope: MCPScope,
    projectPath?: string
  ) => {
    try {
      await removeMCPServerCmd(scope, name, projectPath);

      // Remove from local state
      const id = createMCPServerId(name, scope);
      setServers(prev => prev.filter(s => s.id !== id));

      showToast('success', `Removed MCP server "${name}"`);
    } catch (error) {
      devLog.error('Failed to remove MCP server:', error);
      showToast('error', `Failed to remove MCP server: ${error}`);
      throw error;
    }
  }, [showToast]);

  const toggleFavorite = useCallback((server: MCPServer) => {
    setServers(prev =>
      prev.map(s =>
        s.id === server.id ? { ...s, isFavorite: !s.isFavorite } : s
      )
    );
  }, []);

  const getServerById = useCallback((id: string): MCPServer | undefined => {
    return serversRef.current.find(s => s.id === id);
  }, []);

  const getServerByName = useCallback((
    name: string,
    scope: MCPScope
  ): MCPServer | undefined => {
    const id = createMCPServerId(name, scope);
    return serversRef.current.find(s => s.id === id);
  }, []);

  return {
    servers,
    serversRef,
    isLoading,
    loadServers,
    addServer,
    updateServer,
    removeServer,
    toggleFavorite,
    getServerById,
    getServerByName,
  };
}
