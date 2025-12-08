import { isPathSafe, isPathWithinBase } from '../pathHelpers';

describe('pathHelpers', () => {
  describe('isPathSafe', () => {
    it('should accept simple filenames', () => {
      expect(isPathSafe('agent.md')).toBe(true);
      expect(isPathSafe('my-agent.md')).toBe(true);
      expect(isPathSafe('agent_v2.md')).toBe(true);
    });

    it('should accept absolute POSIX paths', () => {
      expect(isPathSafe('/home/user/.claude/agents/agent.md')).toBe(true);
      expect(isPathSafe('/opt/project/.claude/agents/test.md')).toBe(true);
    });

    it('should accept absolute Windows paths', () => {
      expect(isPathSafe('C:\\Users\\user\\.claude\\agents\\agent.md')).toBe(true);
      expect(isPathSafe('D:\\Projects\\app\\.claude\\agents\\test.md')).toBe(true);
    });

    it('should accept tilde paths', () => {
      expect(isPathSafe('~/.claude/agents/agent.md')).toBe(true);
      expect(isPathSafe('~\\.claude\\agents\\agent.md')).toBe(true);
    });

    it('should accept relative paths without traversal', () => {
      expect(isPathSafe('.claude/agents/agent.md')).toBe(true);
      expect(isPathSafe('./agents/test.md')).toBe(true);
    });

    it('should reject paths with parent directory traversal', () => {
      expect(isPathSafe('../../../etc/passwd')).toBe(false);
      expect(isPathSafe('agents/../../secrets.txt')).toBe(false);
      expect(isPathSafe('/home/user/../admin/data')).toBe(false);
      expect(isPathSafe('./../outside')).toBe(false);
    });

    it('should reject paths starting with parent directory', () => {
      expect(isPathSafe('../agent.md')).toBe(false);
      expect(isPathSafe('..\\agent.md')).toBe(false);
      expect(isPathSafe('../')).toBe(false);
    });

    it('should reject paths ending with parent directory', () => {
      expect(isPathSafe('agents/..')).toBe(false);
      expect(isPathSafe('agents\\..')).toBe(false);
    });

    it('should reject empty or whitespace paths', () => {
      expect(isPathSafe('')).toBe(false);
      expect(isPathSafe('   ')).toBe(false);
      expect(isPathSafe('\t\n')).toBe(false);
    });

    it('should reject null or undefined', () => {
      expect(isPathSafe(null as any)).toBe(false);
      expect(isPathSafe(undefined as any)).toBe(false);
    });

    it('should reject paths with null bytes', () => {
      expect(isPathSafe('agent\0.md')).toBe(false);
      expect(isPathSafe('/path/to/\0/file')).toBe(false);
    });

    it('should reject non-string values', () => {
      expect(isPathSafe(123 as any)).toBe(false);
      expect(isPathSafe({} as any)).toBe(false);
      expect(isPathSafe([] as any)).toBe(false);
    });

    it('should handle mixed path separators', () => {
      expect(isPathSafe('folder/subfolder\\file.md')).toBe(true);
    });

    describe('UNC paths', () => {
      it('should accept valid UNC paths', () => {
        expect(isPathSafe('\\\\server\\share')).toBe(true);
        expect(isPathSafe('\\\\server\\share\\folder\\file.txt')).toBe(true);
        expect(isPathSafe('\\\\myserver\\myshare\\.claude\\agents\\agent.md')).toBe(true);
      });

      it('should accept long path syntax', () => {
        expect(isPathSafe('\\\\?\\C:\\Users\\user')).toBe(true);
        expect(isPathSafe('\\\\?\\D:\\Project\\file.md')).toBe(true);
      });

      it('should reject malformed UNC paths', () => {
        expect(isPathSafe('\\\\')).toBe(false);  // No server
        expect(isPathSafe('\\\\server')).toBe(false);  // No share
        expect(isPathSafe('\\\\')).toBe(false);  // Empty
      });
    });
  });

  describe('isPathWithinBase', () => {
    it('should accept paths within base directory', () => {
      expect(isPathWithinBase('/home/user/.claude/agents/agent.md', '/home/user/.claude')).toBe(true);
      expect(isPathWithinBase('/opt/project/subfolder/file.txt', '/opt/project')).toBe(true);
    });

    it('should accept paths equal to base directory', () => {
      expect(isPathWithinBase('/home/user/.claude', '/home/user/.claude')).toBe(true);
      expect(isPathWithinBase('/opt/project', '/opt/project')).toBe(true);
    });

    it('should reject paths outside base directory', () => {
      expect(isPathWithinBase('/home/admin/secret.txt', '/home/user/.claude')).toBe(false);
      expect(isPathWithinBase('/etc/passwd', '/home/user')).toBe(false);
    });

    it('should reject paths that start with similar prefix but are not children', () => {
      // /home/user-admin is not within /home/user
      expect(isPathWithinBase('/home/user-admin/file.txt', '/home/user')).toBe(false);
      expect(isPathWithinBase('/opt/project-backup/data', '/opt/project')).toBe(false);
    });

    it('should handle trailing slashes consistently', () => {
      expect(isPathWithinBase('/home/user/.claude/agents/', '/home/user/.claude')).toBe(true);
      expect(isPathWithinBase('/home/user/.claude/agents', '/home/user/.claude/')).toBe(true);
      expect(isPathWithinBase('/home/user/.claude/', '/home/user/.claude/')).toBe(true);
    });

    it('should handle Windows-style paths', () => {
      expect(isPathWithinBase('C:\\Users\\user\\.claude\\agents\\agent.md', 'C:\\Users\\user\\.claude')).toBe(true);
      expect(isPathWithinBase('D:\\Project\\file.txt', 'C:\\Users\\user')).toBe(false);
    });

    it('should normalize path separators for comparison', () => {
      expect(isPathWithinBase('C:/Users/user/.claude/agents/agent.md', 'C:\\Users\\user\\.claude')).toBe(true);
      expect(isPathWithinBase('/home/user\\.claude\\agents\\agent.md', '/home/user/.claude')).toBe(true);
    });
  });
});
