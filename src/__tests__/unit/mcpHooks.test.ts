/**
 * Unit tests for MCP servers and Hooks parsing/validation
 */

import {
  MCPScope,
  MCPServerType,
  MCPServer,
  MCPServerConfig,
  createMCPServerId,
  parseMCPServerId,
  inferMCPServerType,
  configToMCPServer,
  mcpServerToConfig,
  validateMCPServer,
  getMCPScopeDisplayName,
  getMCPConfigPath,
} from '../../types/mcp';

import {
  HookEventType,
  HookScope,
  Hook,
  HookConfig,
  createHookId,
  parseHookId,
  configToHook,
  hookToConfig,
  validateHook,
  getHookEventDisplayName,
  getHookEventDescription,
  getHookScopeDisplayName,
  getHookConfigPath,
  getHookEnvVariables,
  HOOK_ENV_VARIABLES,
} from '../../types/hooks';

describe('MCP Server Types', () => {
  describe('createMCPServerId', () => {
    it('should create ID with scope prefix', () => {
      expect(createMCPServerId('github', 'user')).toBe('user:github');
      expect(createMCPServerId('postgres', 'project')).toBe('project:postgres');
      expect(createMCPServerId('custom', 'local')).toBe('local:custom');
    });

    it('should handle names with special characters', () => {
      expect(createMCPServerId('my-server', 'user')).toBe('user:my-server');
      expect(createMCPServerId('server_v2', 'project')).toBe('project:server_v2');
    });
  });

  describe('parseMCPServerId', () => {
    it('should parse valid IDs', () => {
      expect(parseMCPServerId('user:github')).toEqual({
        scope: 'user',
        name: 'github',
      });
      expect(parseMCPServerId('project:postgres')).toEqual({
        scope: 'project',
        name: 'postgres',
      });
    });

    it('should handle names with colons', () => {
      expect(parseMCPServerId('user:server:v2')).toEqual({
        scope: 'user',
        name: 'server:v2',
      });
    });

    it('should return null for invalid IDs', () => {
      expect(parseMCPServerId('invalidid')).toBeNull();
      expect(parseMCPServerId('')).toBeNull();
    });
  });

  describe('inferMCPServerType', () => {
    it('should return explicit type if provided', () => {
      expect(inferMCPServerType({ type: 'stdio' })).toBe('stdio');
      expect(inferMCPServerType({ type: 'http' })).toBe('http');
      expect(inferMCPServerType({ type: 'sse' })).toBe('sse');
    });

    it('should infer stdio from command', () => {
      expect(inferMCPServerType({ command: 'npx -y @mcp/server' })).toBe('stdio');
    });

    it('should infer http from url', () => {
      expect(inferMCPServerType({ url: 'https://server.com/mcp' })).toBe('http');
    });

    it('should default to http when no hints available', () => {
      expect(inferMCPServerType({})).toBe('http');
    });
  });

  describe('configToMCPServer', () => {
    it('should convert config to full MCPServer', () => {
      const config: MCPServerConfig = {
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@mcp/server-github'],
        env: { GITHUB_TOKEN: 'xxx' },
      };

      const server = configToMCPServer('github', config, 'user', '~/.claude/mcp.json');

      expect(server.id).toBe('user:github');
      expect(server.name).toBe('github');
      expect(server.type).toBe('stdio');
      expect(server.command).toBe('npx');
      expect(server.args).toEqual(['-y', '@mcp/server-github']);
      expect(server.env).toEqual({ GITHUB_TOKEN: 'xxx' });
      expect(server.scope).toBe('user');
      expect(server.sourcePath).toBe('~/.claude/mcp.json');
      expect(server.enabled).toBe(true);
    });

    it('should handle http servers', () => {
      const config: MCPServerConfig = {
        type: 'http',
        url: 'https://api.example.com/mcp',
        headers: { Authorization: 'Bearer xxx' },
      };

      const server = configToMCPServer('custom', config, 'project', '/project/.mcp.json', false);

      expect(server.type).toBe('http');
      expect(server.url).toBe('https://api.example.com/mcp');
      expect(server.headers).toEqual({ Authorization: 'Bearer xxx' });
      expect(server.enabled).toBe(false);
    });
  });

  describe('mcpServerToConfig', () => {
    it('should convert stdio server to config', () => {
      const server: MCPServer = {
        id: 'user:github',
        name: 'github',
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@mcp/server'],
        env: { TOKEN: 'xxx' },
        scope: 'user',
        sourcePath: '~/.claude/mcp.json',
        enabled: true,
      };

      const config = mcpServerToConfig(server);

      expect(config.type).toBe('stdio');
      expect(config.command).toBe('npx');
      expect(config.args).toEqual(['-y', '@mcp/server']);
      expect(config.env).toEqual({ TOKEN: 'xxx' });
      expect(config.url).toBeUndefined();
    });

    it('should convert http server to config', () => {
      const server: MCPServer = {
        id: 'user:custom',
        name: 'custom',
        type: 'http',
        url: 'https://api.example.com',
        headers: { 'X-API-Key': 'key' },
        scope: 'user',
        sourcePath: '~/.claude/mcp.json',
        enabled: true,
      };

      const config = mcpServerToConfig(server);

      expect(config.type).toBe('http');
      expect(config.url).toBe('https://api.example.com');
      expect(config.headers).toEqual({ 'X-API-Key': 'key' });
      expect(config.command).toBeUndefined();
    });

    it('should omit empty arrays and objects', () => {
      const server: MCPServer = {
        id: 'user:minimal',
        name: 'minimal',
        type: 'stdio',
        command: 'node',
        args: [],
        env: {},
        scope: 'user',
        sourcePath: '~/.claude/mcp.json',
        enabled: true,
      };

      const config = mcpServerToConfig(server);

      expect(config.args).toBeUndefined();
      expect(config.env).toBeUndefined();
    });
  });

  describe('validateMCPServer', () => {
    it('should pass for valid stdio server', () => {
      const server: Partial<MCPServer> = {
        name: 'github',
        type: 'stdio',
        command: 'npx -y @mcp/server',
      };

      expect(validateMCPServer(server)).toEqual([]);
    });

    it('should pass for valid http server', () => {
      const server: Partial<MCPServer> = {
        name: 'custom',
        type: 'http',
        url: 'https://api.example.com/mcp',
      };

      expect(validateMCPServer(server)).toEqual([]);
    });

    it('should require name', () => {
      const server: Partial<MCPServer> = {
        type: 'http',
        url: 'https://api.example.com',
      };

      const errors = validateMCPServer(server);
      expect(errors).toContain('Server name is required');
    });

    it('should validate name format', () => {
      const server: Partial<MCPServer> = {
        name: 'invalid name!',
        type: 'http',
        url: 'https://api.example.com',
      };

      const errors = validateMCPServer(server);
      expect(errors.some(e => e.includes('letters, numbers, hyphens'))).toBe(true);
    });

    it('should require command for stdio', () => {
      const server: Partial<MCPServer> = {
        name: 'test',
        type: 'stdio',
      };

      const errors = validateMCPServer(server);
      expect(errors).toContain('Command is required for stdio servers');
    });

    it('should require url for http', () => {
      const server: Partial<MCPServer> = {
        name: 'test',
        type: 'http',
      };

      const errors = validateMCPServer(server);
      expect(errors).toContain('URL is required for HTTP/SSE servers');
    });

    it('should validate url format', () => {
      const server: Partial<MCPServer> = {
        name: 'test',
        type: 'http',
        url: 'not-a-url',
      };

      const errors = validateMCPServer(server);
      expect(errors).toContain('Invalid URL format');
    });

    it('should allow environment variable placeholders in url', () => {
      const server: Partial<MCPServer> = {
        name: 'test',
        type: 'http',
        url: 'https://${API_HOST}/mcp',
      };

      const errors = validateMCPServer(server);
      expect(errors).toEqual([]);
    });
  });

  describe('getMCPScopeDisplayName', () => {
    it('should return display names', () => {
      expect(getMCPScopeDisplayName('user')).toBe('User (Global)');
      expect(getMCPScopeDisplayName('project')).toBe('Project');
      expect(getMCPScopeDisplayName('local')).toBe('Local');
    });
  });

  describe('getMCPConfigPath', () => {
    it('should return correct paths', () => {
      expect(getMCPConfigPath('user')).toBe('~/.claude/mcp.json');
      expect(getMCPConfigPath('project', '/my/project')).toBe('/my/project/.mcp.json');
      expect(getMCPConfigPath('local', '/my/project')).toBe('/my/project/.claude/settings.local.json');
    });
  });
});

describe('Hook Types', () => {
  describe('createHookId', () => {
    it('should create ID without index', () => {
      expect(createHookId('my-hook', 'user')).toBe('user:my-hook');
    });

    it('should create ID with index', () => {
      expect(createHookId('my-hook', 'user', 0)).toBe('user:my-hook:0');
      expect(createHookId('my-hook', 'project', 5)).toBe('project:my-hook:5');
    });
  });

  describe('parseHookId', () => {
    it('should parse ID without index', () => {
      expect(parseHookId('user:my-hook')).toEqual({
        scope: 'user',
        name: 'my-hook',
        index: undefined,
      });
    });

    it('should parse ID with index', () => {
      expect(parseHookId('user:my-hook:3')).toEqual({
        scope: 'user',
        name: 'my-hook',
        index: 3,
      });
    });

    it('should return null for invalid IDs', () => {
      expect(parseHookId('invalid')).toBeNull();
    });
  });

  describe('configToHook', () => {
    it('should convert config to Hook', () => {
      const config: HookConfig = {
        type: 'command',
        matcher: 'Bash',
        command: 'echo "test"',
        timeout: 5000,
      };

      const hook = configToHook(config, 'PreToolUse', 'bash-guard', 'user', '~/.claude/settings.json', 0);

      expect(hook.id).toBe('user:bash-guard:0');
      expect(hook.name).toBe('bash-guard');
      expect(hook.eventType).toBe('PreToolUse');
      expect(hook.executionType).toBe('command');
      expect(hook.matcher).toBe('Bash');
      expect(hook.command).toBe('echo "test"');
      expect(hook.timeout).toBe(5000);
      expect(hook.scope).toBe('user');
      expect(hook.enabled).toBe(true);
    });
  });

  describe('hookToConfig', () => {
    it('should convert Hook to config', () => {
      const hook: Hook = {
        id: 'user:test:0',
        name: 'test',
        eventType: 'PostToolUse',
        executionType: 'command',
        matcher: 'Write',
        command: 'echo "done"',
        timeout: 10000,
        scope: 'user',
        sourcePath: '~/.claude/settings.json',
        enabled: true,
      };

      const config = hookToConfig(hook);

      expect(config.type).toBe('command');
      expect(config.matcher).toBe('Write');
      expect(config.command).toBe('echo "done"');
      expect(config.timeout).toBe(10000);
    });

    it('should omit optional fields when not present', () => {
      const hook: Hook = {
        id: 'user:minimal:0',
        name: 'minimal',
        eventType: 'Stop',
        executionType: 'command',
        command: 'cleanup.sh',
        scope: 'user',
        sourcePath: '~/.claude/settings.json',
        enabled: true,
      };

      const config = hookToConfig(hook);

      expect(config.matcher).toBeUndefined();
      expect(config.timeout).toBeUndefined();
    });
  });

  describe('validateHook', () => {
    it('should pass for valid hook', () => {
      const hook: Partial<Hook> = {
        name: 'my-hook',
        eventType: 'PreToolUse',
        executionType: 'command',
        command: 'echo "test"',
      };

      expect(validateHook(hook)).toEqual([]);
    });

    it('should require name', () => {
      const hook: Partial<Hook> = {
        eventType: 'PreToolUse',
        executionType: 'command',
        command: 'echo "test"',
      };

      const errors = validateHook(hook);
      expect(errors).toContain('Hook name is required');
    });

    it('should validate name format', () => {
      const hook: Partial<Hook> = {
        name: 'invalid name!',
        eventType: 'PreToolUse',
        executionType: 'command',
        command: 'echo "test"',
      };

      const errors = validateHook(hook);
      expect(errors.some(e => e.includes('letters, numbers, hyphens'))).toBe(true);
    });

    it('should require type', () => {
      const hook: Partial<Hook> = {
        name: 'test',
        executionType: 'command',
        command: 'echo "test"',
      };

      const errors = validateHook(hook);
      expect(errors).toContain('Event type is required');
    });

    it('should require command for command-type hooks', () => {
      const hook: Partial<Hook> = {
        name: 'test',
        eventType: 'PreToolUse',
        executionType: 'command',
      };

      const errors = validateHook(hook);
      expect(errors).toContain('Command is required for command-type hooks');
    });

    it('should validate matcher as regex', () => {
      const hook: Partial<Hook> = {
        name: 'test',
        eventType: 'PreToolUse',
        executionType: 'command',
        command: 'echo "test"',
        matcher: '[invalid regex',
      };

      const errors = validateHook(hook);
      expect(errors).toContain('Invalid matcher pattern (must be valid regex)');
    });

    it('should accept valid regex matchers', () => {
      const hook: Partial<Hook> = {
        name: 'test',
        eventType: 'PreToolUse',
        executionType: 'command',
        command: 'echo "test"',
        matcher: 'Bash|Write|Edit',
      };

      expect(validateHook(hook)).toEqual([]);
    });

    it('should validate timeout is positive', () => {
      const hook: Partial<Hook> = {
        name: 'test',
        eventType: 'PreToolUse',
        executionType: 'command',
        command: 'echo "test"',
        timeout: -100,
      };

      const errors = validateHook(hook);
      expect(errors).toContain('Timeout must be a positive number');
    });
  });

  describe('getHookEventDisplayName', () => {
    it('should return display names', () => {
      expect(getHookEventDisplayName('PreToolUse')).toBe('Before Tool Use');
      expect(getHookEventDisplayName('PostToolUse')).toBe('After Tool Use');
      expect(getHookEventDisplayName('Notification')).toBe('On Notification');
      expect(getHookEventDisplayName('Stop')).toBe('Session Stop');
      expect(getHookEventDisplayName('SubagentStop')).toBe('Subagent Stop');
    });
  });

  describe('getHookEventDescription', () => {
    it('should return descriptions for all types', () => {
      const types: HookEventType[] = ['PreToolUse', 'PostToolUse', 'Notification', 'Stop', 'SubagentStop'];
      types.forEach(type => {
        expect(getHookEventDescription(type).length).toBeGreaterThan(0);
      });
    });
  });

  describe('getHookEnvVariables', () => {
    it('should return env variables for PreToolUse', () => {
      const vars = getHookEnvVariables('PreToolUse');
      expect(vars).toContain('TOOL_NAME');
      expect(vars).toContain('TOOL_INPUT');
      expect(vars).toContain('SESSION_ID');
    });

    it('should return env variables for PostToolUse', () => {
      const vars = getHookEnvVariables('PostToolUse');
      expect(vars).toContain('TOOL_OUTPUT');
      expect(vars).toContain('TOOL_RESULT');
    });

    it('should return env variables for Notification', () => {
      const vars = getHookEnvVariables('Notification');
      expect(vars).toContain('MESSAGE');
    });

    it('should return env variables for Stop', () => {
      const vars = getHookEnvVariables('Stop');
      expect(vars).toContain('STOP_REASON');
    });

    it('should return env variables for SubagentStop', () => {
      const vars = getHookEnvVariables('SubagentStop');
      expect(vars).toContain('SUBAGENT_ID');
      expect(vars).toContain('SUBAGENT_RESULT');
    });
  });

  describe('getHookScopeDisplayName', () => {
    it('should return display names', () => {
      expect(getHookScopeDisplayName('user')).toBe('User (Global)');
      expect(getHookScopeDisplayName('project')).toBe('Project');
      expect(getHookScopeDisplayName('local')).toBe('Local');
    });
  });

  describe('getHookConfigPath', () => {
    it('should return correct paths', () => {
      expect(getHookConfigPath('user')).toBe('~/.claude/settings.json');
      expect(getHookConfigPath('project', '/my/project')).toBe('/my/project/.claude/settings.json');
      expect(getHookConfigPath('local', '/my/project')).toBe('/my/project/.claude/settings.local.json');
    });
  });
});
