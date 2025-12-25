import { useState, useCallback, useEffect } from 'react';
import { MCPServer, MCPAuthStatus } from '../types/mcp';
import {
  getMCPAuthStatus,
  revokeMCPOAuth,
  openOAuthUrl,
} from '../utils/tauriCommands';
import { devLog } from '../utils/devLogger';

export interface UseMCPAuthOptions {
  servers: MCPServer[];
  enabled?: boolean;
}

export interface UseMCPAuthResult {
  authStatus: Record<string, MCPAuthStatus>;
  isCheckingAuth: boolean;
  checkAuthStatus: (serverName: string) => Promise<MCPAuthStatus>;
  checkAllAuthStatus: () => Promise<void>;
  startOAuth: (server: MCPServer, authUrl: string) => Promise<void>;
  revokeAuth: (serverName: string) => Promise<void>;
  getAuthStatus: (serverId: string) => MCPAuthStatus;
}

export function useMCPAuth(options: UseMCPAuthOptions): UseMCPAuthResult {
  const { servers, enabled = true } = options;
  const [authStatus, setAuthStatus] = useState<Record<string, MCPAuthStatus>>({});
  const [isCheckingAuth, setIsCheckingAuth] = useState(false);

  const checkAuthStatus = useCallback(async (serverName: string): Promise<MCPAuthStatus> => {
    try {
      const status = await getMCPAuthStatus(serverName);
      const authStatus = status as MCPAuthStatus;
      setAuthStatus(prev => ({
        ...prev,
        [serverName]: authStatus,
      }));
      return authStatus;
    } catch (error) {
      devLog.error(`Failed to check auth status for ${serverName}:`, error);
      setAuthStatus(prev => ({
        ...prev,
        [serverName]: 'error',
      }));
      return 'error';
    }
  }, []);

  const checkAllAuthStatus = useCallback(async () => {
    if (servers.length === 0) return;
    setIsCheckingAuth(true);

    try {
      // Only check HTTP/SSE servers (stdio doesn't use OAuth)
      const httpServers = servers.filter(s => s.type === 'http' || s.type === 'sse');
      await Promise.all(httpServers.map(server => checkAuthStatus(server.name)));
    } finally {
      setIsCheckingAuth(false);
    }
  }, [servers, checkAuthStatus]);

  // Check auth status on mount
  useEffect(() => {
    if (!enabled || servers.length === 0) return;
    void checkAllAuthStatus();
  }, [enabled, servers.length, checkAllAuthStatus]);

  const startOAuth = useCallback(async (server: MCPServer, authUrl: string) => {
    setAuthStatus(prev => ({
      ...prev,
      [server.name]: 'pending',
    }));

    try {
      // Open the OAuth URL in the default browser
      await openOAuthUrl(authUrl);
      // Note: The actual token storage would happen after the OAuth callback
      // This is a simplified flow - full implementation would need a callback handler
    } catch (error) {
      devLog.error(`Failed to start OAuth for ${server.name}:`, error);
      setAuthStatus(prev => ({
        ...prev,
        [server.name]: 'error',
      }));
    }
  }, []);

  const revokeAuth = useCallback(async (serverName: string) => {
    try {
      await revokeMCPOAuth(serverName);
      setAuthStatus(prev => ({
        ...prev,
        [serverName]: 'none',
      }));
    } catch (error) {
      devLog.error(`Failed to revoke auth for ${serverName}:`, error);
    }
  }, []);

  const getAuthStatus = useCallback((serverId: string): MCPAuthStatus => {
    // Extract server name from ID (format: "scope:name")
    const parts = serverId.split(':');
    const serverName = parts.length > 1 ? parts.slice(1).join(':') : serverId;
    return authStatus[serverName] ?? 'none';
  }, [authStatus]);

  return {
    authStatus,
    isCheckingAuth,
    checkAuthStatus,
    checkAllAuthStatus,
    startOAuth,
    revokeAuth,
    getAuthStatus,
  };
}
