import { useState, useCallback, useEffect, useRef } from 'react';
import { MCPServer, MCPServerStatus, MCPHealthResult } from '../types/mcp';
import { checkMCPServerHealth } from '../utils/tauriCommands';
import { devLog } from '../utils/devLogger';

const HEALTH_CHECK_INTERVAL = 60000; // 1 minute
const HEALTH_CHECK_TIMEOUT = 5000;   // 5 seconds

export interface UseMCPHealthOptions {
  servers: MCPServer[];
  enabled?: boolean;
  interval?: number;
}

export interface UseMCPHealthResult {
  serverHealth: Record<string, MCPHealthResult>;
  isChecking: boolean;
  checkHealth: (server: MCPServer) => Promise<MCPHealthResult>;
  checkAllHealth: () => Promise<void>;
  getStatus: (serverId: string) => MCPServerStatus;
  getHealthInfo: (serverId: string) => MCPHealthResult | undefined;
}

export function useMCPHealth(options: UseMCPHealthOptions): UseMCPHealthResult {
  const { servers, enabled = true, interval = HEALTH_CHECK_INTERVAL } = options;
  const [serverHealth, setServerHealth] = useState<Record<string, MCPHealthResult>>({});
  const [isChecking, setIsChecking] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const serversRef = useRef(servers);

  // Keep ref in sync
  serversRef.current = servers;

  const checkHealth = useCallback(async (server: MCPServer): Promise<MCPHealthResult> => {
    // Set status to checking
    setServerHealth(prev => ({
      ...prev,
      [server.id]: {
        serverName: server.name,
        status: 'checking',
        checkedAt: Date.now(),
      },
    }));

    try {
      const result = await checkMCPServerHealth(
        server.type,
        server.name,
        server.url,
        server.command,
        HEALTH_CHECK_TIMEOUT
      );

      const healthResult: MCPHealthResult = {
        serverName: result.server_name,
        status: result.status as MCPServerStatus,
        latencyMs: result.latency_ms ?? undefined,
        errorMessage: result.error_message ?? undefined,
        checkedAt: Date.now(),
      };

      setServerHealth(prev => ({
        ...prev,
        [server.id]: healthResult,
      }));

      return healthResult;
    } catch (error) {
      devLog.error(`Health check failed for ${server.name}:`, error);
      const healthResult: MCPHealthResult = {
        serverName: server.name,
        status: 'error',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        checkedAt: Date.now(),
      };

      setServerHealth(prev => ({
        ...prev,
        [server.id]: healthResult,
      }));

      return healthResult;
    }
  }, []);

  const checkAllHealth = useCallback(async () => {
    if (serversRef.current.length === 0) return;
    setIsChecking(true);

    try {
      // Check all servers in parallel
      await Promise.all(serversRef.current.map(server => checkHealth(server)));
    } finally {
      setIsChecking(false);
    }
  }, [checkHealth]);

  // Auto-check on mount and at interval
  useEffect(() => {
    if (!enabled || servers.length === 0) return;

    // Initial check
    void checkAllHealth();

    // Set up interval
    intervalRef.current = setInterval(() => {
      void checkAllHealth();
    }, interval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [enabled, servers.length, interval, checkAllHealth]);

  const getStatus = useCallback((serverId: string): MCPServerStatus => {
    return serverHealth[serverId]?.status ?? 'unknown';
  }, [serverHealth]);

  const getHealthInfo = useCallback((serverId: string): MCPHealthResult | undefined => {
    return serverHealth[serverId];
  }, [serverHealth]);

  return {
    serverHealth,
    isChecking,
    checkHealth,
    checkAllHealth,
    getStatus,
    getHealthInfo,
  };
}
