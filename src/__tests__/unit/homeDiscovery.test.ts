/**
 * Unit tests for home directory discovery and scan logic
 */

import {
  discoverHomeDirectories,
  invalidateHomeDiscoveryCache,
  cancelHomeDiscovery,
  DEFAULT_HOME_DISCOVERY_DEPTH,
} from '../../utils/homeDiscovery';

// Mock the Tauri commands
jest.mock('../../utils/tauriCommands', () => ({
  discoverProjectDirectories: jest.fn(),
}));

import { discoverProjectDirectories } from '../../utils/tauriCommands';

const mockDiscoverProjectDirectories = discoverProjectDirectories as jest.MockedFunction<typeof discoverProjectDirectories>;

describe('Home Discovery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    invalidateHomeDiscoveryCache();
    cancelHomeDiscovery();
  });

  describe('DEFAULT_HOME_DISCOVERY_DEPTH', () => {
    it('should have a reasonable default depth', () => {
      expect(DEFAULT_HOME_DISCOVERY_DEPTH).toBe(12);
      expect(DEFAULT_HOME_DISCOVERY_DEPTH).toBeGreaterThan(0);
    });
  });

  describe('discoverHomeDirectories', () => {
    it('should call discoverProjectDirectories with default options', async () => {
      mockDiscoverProjectDirectories.mockResolvedValue(['/home/user/project1', '/home/user/project2']);

      const result = await discoverHomeDirectories();

      expect(mockDiscoverProjectDirectories).toHaveBeenCalledWith({
        maxDepth: DEFAULT_HOME_DISCOVERY_DEPTH,
        includeProtectedDirs: false,
      });
      expect(result).toEqual(['/home/user/project1', '/home/user/project2']);
    });

    it('should respect custom maxDepth option', async () => {
      mockDiscoverProjectDirectories.mockResolvedValue([]);

      await discoverHomeDirectories({ maxDepth: 5 });

      expect(mockDiscoverProjectDirectories).toHaveBeenCalledWith({
        maxDepth: 5,
        includeProtectedDirs: false,
      });
    });

    it('should enforce minimum depth of 1', async () => {
      mockDiscoverProjectDirectories.mockResolvedValue([]);

      await discoverHomeDirectories({ maxDepth: 0 });

      expect(mockDiscoverProjectDirectories).toHaveBeenCalledWith({
        maxDepth: 1,
        includeProtectedDirs: false,
      });
    });

    it('should handle negative depth by using minimum', async () => {
      mockDiscoverProjectDirectories.mockResolvedValue([]);

      await discoverHomeDirectories({ maxDepth: -5 });

      expect(mockDiscoverProjectDirectories).toHaveBeenCalledWith({
        maxDepth: 1,
        includeProtectedDirs: false,
      });
    });

    it('should pass includeProtectedDirs option', async () => {
      mockDiscoverProjectDirectories.mockResolvedValue([]);

      await discoverHomeDirectories({ includeProtectedDirs: true });

      expect(mockDiscoverProjectDirectories).toHaveBeenCalledWith({
        maxDepth: DEFAULT_HOME_DISCOVERY_DEPTH,
        includeProtectedDirs: true,
      });
    });

    it('should use cached results when available', async () => {
      const directories = ['/home/user/project1'];
      mockDiscoverProjectDirectories.mockResolvedValue(directories);

      // First call - should hit the backend
      const result1 = await discoverHomeDirectories();
      expect(result1).toEqual(directories);
      expect(mockDiscoverProjectDirectories).toHaveBeenCalledTimes(1);

      // Second call with same params - should use cache
      const result2 = await discoverHomeDirectories();
      expect(result2).toEqual(directories);
      expect(mockDiscoverProjectDirectories).toHaveBeenCalledTimes(1); // Still 1
    });

    it('should bypass cache with force option', async () => {
      const directories = ['/home/user/project1'];
      mockDiscoverProjectDirectories.mockResolvedValue(directories);

      // First call
      await discoverHomeDirectories();
      expect(mockDiscoverProjectDirectories).toHaveBeenCalledTimes(1);

      // Second call with force - should hit backend again
      await discoverHomeDirectories({ force: true });
      expect(mockDiscoverProjectDirectories).toHaveBeenCalledTimes(2);
    });

    it('should return copy of cached directories to prevent mutation', async () => {
      const directories = ['/home/user/project1'];
      mockDiscoverProjectDirectories.mockResolvedValue(directories);

      const result1 = await discoverHomeDirectories();
      const result2 = await discoverHomeDirectories();

      // Results should be equal but not the same reference
      expect(result1).toEqual(result2);

      // Mutating one should not affect the other
      result1.push('/modified');
      const result3 = await discoverHomeDirectories();
      expect(result3).not.toContain('/modified');
    });
  });

  describe('invalidateHomeDiscoveryCache', () => {
    it('should clear cached results', async () => {
      mockDiscoverProjectDirectories.mockResolvedValue(['/project1']);

      // Populate cache
      await discoverHomeDirectories();
      expect(mockDiscoverProjectDirectories).toHaveBeenCalledTimes(1);

      // Invalidate and call again
      invalidateHomeDiscoveryCache();
      await discoverHomeDirectories();
      expect(mockDiscoverProjectDirectories).toHaveBeenCalledTimes(2);
    });
  });

  describe('cancelHomeDiscovery', () => {
    it('should cancel in-flight discovery', async () => {
      // Create a promise that we can control
      let resolveDiscovery: (value: string[]) => void;
      const discoveryPromise = new Promise<string[]>(resolve => {
        resolveDiscovery = resolve;
      });
      mockDiscoverProjectDirectories.mockReturnValue(discoveryPromise);

      // Start discovery but don't await
      const resultPromise = discoverHomeDirectories();

      // Cancel while in-flight
      cancelHomeDiscovery();

      // Resolve the original promise
      resolveDiscovery!(['/project1']);

      // The result should still resolve
      const result = await resultPromise;
      expect(result).toEqual(['/project1']);

      // But a new call should start fresh
      mockDiscoverProjectDirectories.mockResolvedValue(['/project2']);
      const result2 = await discoverHomeDirectories();
      expect(result2).toEqual(['/project2']);
    });
  });

  describe('Abort Signal Support', () => {
    it('should reject immediately if signal is already aborted', async () => {
      const controller = new AbortController();
      controller.abort();

      await expect(
        discoverHomeDirectories({ signal: controller.signal })
      ).rejects.toThrow('aborted');
    });

    it('should reject when signal is aborted during discovery', async () => {
      const controller = new AbortController();

      // Create a slow promise
      let resolveDiscovery: (value: string[]) => void;
      mockDiscoverProjectDirectories.mockReturnValue(
        new Promise(resolve => {
          resolveDiscovery = resolve;
        })
      );

      const resultPromise = discoverHomeDirectories({ signal: controller.signal });

      // Abort while in-flight
      controller.abort();

      // The result should be rejected
      await expect(resultPromise).rejects.toThrow();

      // Clean up
      resolveDiscovery!([]);
    });
  });
});

describe('Scan Settings', () => {
  describe('Path Normalization', () => {
    it('should normalize paths with trailing slashes', () => {
      const normalize = (path: string) => path.replace(/\/+$/, '');

      expect(normalize('/home/user/')).toBe('/home/user');
      expect(normalize('/home/user///')).toBe('/home/user');
      expect(normalize('/home/user')).toBe('/home/user');
    });

    it('should convert backslashes to forward slashes', () => {
      const normalize = (path: string) => path.replace(/\\/g, '/');

      expect(normalize('C:\\Users\\test')).toBe('C:/Users/test');
      expect(normalize('/home/user')).toBe('/home/user');
    });
  });

  describe('Directory Validation', () => {
    it('should filter empty paths', () => {
      const paths = ['/valid/path', '', '  ', '/another/valid'];
      const filtered = paths.filter(p => p && p.trim().length > 0);

      expect(filtered).toEqual(['/valid/path', '/another/valid']);
    });

    it('should deduplicate paths', () => {
      const paths = ['/path1', '/path2', '/path1', '/path3', '/path2'];
      const unique = Array.from(new Set(paths));

      expect(unique).toEqual(['/path1', '/path2', '/path3']);
    });
  });
});
