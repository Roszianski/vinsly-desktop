import { useCallback, useState, useRef } from 'react';
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

export interface UseMCPServersResult {
  servers: MCPServer[];
  serversRef: React.RefObject<MCPServer[]>;
  isLoading: boolean;
  loadServers: (projectPath?: string) => Promise<void>;
  addServer: (server: MCPServer, projectPath?: string) => Promise<void>;
  updateServer: (server: MCPServer, projectPath?: string) => Promise<void>;
  removeServer: (name: string, scope: MCPScope, projectPath?: string) => Promise<void>;
  toggleFavorite: (server: MCPServer) => void;
  getServerById: (id: string) => MCPServer | undefined;
  getServerByName: (name: string, scope: MCPScope) => MCPServer | undefined;
}

export function useMCPServers({ showToast }: UseMCPServersOptions): UseMCPServersResult {
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const serversRef = useRef<MCPServer[]>([]);

  // Keep ref in sync with state
  serversRef.current = servers;

  const loadServers = useCallback(async (projectPath?: string) => {
    setIsLoading(true);
    try {
      const rawServers = await listMCPServers(projectPath);
      const mcpServers = rawServers.map(rawToMCPServer);
      setServers(mcpServers);
    } catch (error) {
      console.error('Failed to load MCP servers:', error);
      showToast('error', `Failed to load MCP servers: ${error}`);
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
      console.error('Failed to add MCP server:', error);
      showToast('error', `Failed to add MCP server: ${error}`);
      throw error;
    }
  }, [showToast]);

  const updateServer = useCallback(async (server: MCPServer, projectPath?: string) => {
    try {
      const rawConfig = mcpServerToRawConfig(server);
      // Remove old and add new (in case name changed)
      await addMCPServerCmd(server.scope, server.name, rawConfig, projectPath);

      // Update local state
      setServers(prev => {
        const filtered = prev.filter(s => s.id !== server.id);
        return [...filtered, server];
      });

      showToast('success', `Updated MCP server "${server.name}"`);
    } catch (error) {
      console.error('Failed to update MCP server:', error);
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
      console.error('Failed to remove MCP server:', error);
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
