/**
 * Unit tests for updater flows and logic
 */

import { PendingUpdateDetails } from '../../types/updater';

describe('Updater Types', () => {
  describe('PendingUpdateDetails', () => {
    it('should accept valid update details', () => {
      const update: PendingUpdateDetails = {
        version: '1.2.3',
        notes: 'Bug fixes and improvements',
        date: '2025-01-15T10:30:00Z',
      };

      expect(update.version).toBe('1.2.3');
      expect(update.notes).toBe('Bug fixes and improvements');
      expect(update.date).toBe('2025-01-15T10:30:00Z');
    });

    it('should allow optional fields to be undefined', () => {
      const update: PendingUpdateDetails = {
        version: '2.0.0',
      };

      expect(update.version).toBe('2.0.0');
      expect(update.notes).toBeUndefined();
      expect(update.date).toBeUndefined();
    });
  });
});

describe('Updater Flow Logic', () => {
  describe('Version Comparison', () => {
    const parseVersion = (version: string): number[] => {
      return version.split('.').map(n => parseInt(n, 10) || 0);
    };

    const compareVersions = (a: string, b: string): number => {
      const partsA = parseVersion(a);
      const partsB = parseVersion(b);
      const maxLen = Math.max(partsA.length, partsB.length);

      for (let i = 0; i < maxLen; i++) {
        const numA = partsA[i] || 0;
        const numB = partsB[i] || 0;
        if (numA > numB) return 1;
        if (numA < numB) return -1;
      }
      return 0;
    };

    it('should correctly compare major versions', () => {
      expect(compareVersions('2.0.0', '1.0.0')).toBe(1);
      expect(compareVersions('1.0.0', '2.0.0')).toBe(-1);
      expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
    });

    it('should correctly compare minor versions', () => {
      expect(compareVersions('1.2.0', '1.1.0')).toBe(1);
      expect(compareVersions('1.1.0', '1.2.0')).toBe(-1);
      expect(compareVersions('1.2.0', '1.2.0')).toBe(0);
    });

    it('should correctly compare patch versions', () => {
      expect(compareVersions('1.0.2', '1.0.1')).toBe(1);
      expect(compareVersions('1.0.1', '1.0.2')).toBe(-1);
      expect(compareVersions('1.0.1', '1.0.1')).toBe(0);
    });

    it('should handle versions with different segment counts', () => {
      expect(compareVersions('1.0.0', '1.0')).toBe(0);
      expect(compareVersions('1.0.1', '1.0')).toBe(1);
      expect(compareVersions('1.0', '1.0.1')).toBe(-1);
    });

    it('should handle pre-release versions numerically', () => {
      expect(compareVersions('1.0.0', '1.0.0.1')).toBe(-1);
      expect(compareVersions('1.0.0.1', '1.0.0')).toBe(1);
    });
  });

  describe('Update Snooze Logic', () => {
    interface UpdateSnooze {
      version: string;
      until: string;
    }

    const isSnoozeActive = (snooze: UpdateSnooze | null, currentVersion: string): boolean => {
      if (!snooze) return false;
      if (snooze.version !== currentVersion) return false;
      return new Date(snooze.until) > new Date();
    };

    it('should return false when no snooze is set', () => {
      expect(isSnoozeActive(null, '1.0.0')).toBe(false);
    });

    it('should return false when snooze is for different version', () => {
      const snooze: UpdateSnooze = {
        version: '1.0.0',
        until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };

      expect(isSnoozeActive(snooze, '1.1.0')).toBe(false);
    });

    it('should return true when snooze is active for same version', () => {
      const snooze: UpdateSnooze = {
        version: '1.0.0',
        until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };

      expect(isSnoozeActive(snooze, '1.0.0')).toBe(true);
    });

    it('should return false when snooze has expired', () => {
      const snooze: UpdateSnooze = {
        version: '1.0.0',
        until: new Date(Date.now() - 1000).toISOString(),
      };

      expect(isSnoozeActive(snooze, '1.0.0')).toBe(false);
    });
  });

  describe('Update Notification Intervals', () => {
    const UPDATE_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hours

    const shouldCheckForUpdate = (lastCheckedAt: string | null): boolean => {
      if (!lastCheckedAt) return true;
      const lastCheck = new Date(lastCheckedAt).getTime();
      return Date.now() - lastCheck >= UPDATE_CHECK_INTERVAL_MS;
    };

    it('should check when never checked before', () => {
      expect(shouldCheckForUpdate(null)).toBe(true);
    });

    it('should not check if recently checked', () => {
      const recentCheck = new Date().toISOString();
      expect(shouldCheckForUpdate(recentCheck)).toBe(false);
    });

    it('should check if interval has passed', () => {
      const oldCheck = new Date(Date.now() - UPDATE_CHECK_INTERVAL_MS - 1000).toISOString();
      expect(shouldCheckForUpdate(oldCheck)).toBe(true);
    });

    it('should handle invalid dates gracefully', () => {
      // Invalid date will result in NaN, so Date.now() - NaN is NaN
      // NaN >= anything is false, so this returns false
      expect(shouldCheckForUpdate('invalid-date')).toBe(false);
    });
  });

  describe('Release Notes Parsing', () => {
    const parseReleaseNotes = (notes: string | undefined): string[] => {
      if (!notes) return [];
      return notes
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .filter(line => line.startsWith('-') || line.startsWith('*') || line.startsWith('•'));
    };

    it('should parse bullet points', () => {
      const notes = `
        - Fixed a critical bug
        - Added new feature
        - Improved performance
      `;

      const bullets = parseReleaseNotes(notes);
      expect(bullets).toHaveLength(3);
      expect(bullets[0]).toContain('Fixed');
    });

    it('should handle asterisk bullets', () => {
      const notes = `
        * Bug fix 1
        * Bug fix 2
      `;

      const bullets = parseReleaseNotes(notes);
      expect(bullets).toHaveLength(2);
    });

    it('should handle unicode bullets', () => {
      const notes = `
        • Enhancement 1
        • Enhancement 2
      `;

      const bullets = parseReleaseNotes(notes);
      expect(bullets).toHaveLength(2);
    });

    it('should return empty array for undefined notes', () => {
      expect(parseReleaseNotes(undefined)).toEqual([]);
    });

    it('should filter non-bullet lines', () => {
      const notes = `
        Version 1.2.3

        Changes:
        - Fixed bug
        - Added feature

        Thank you for using our app!
      `;

      const bullets = parseReleaseNotes(notes);
      expect(bullets).toHaveLength(2);
    });
  });

  describe('Auto-Update Settings', () => {
    interface AutoUpdateSettings {
      enabled: boolean;
      checkOnStartup: boolean;
      installAutomatically: boolean;
    }

    const DEFAULT_SETTINGS: AutoUpdateSettings = {
      enabled: true,
      checkOnStartup: true,
      installAutomatically: false,
    };

    it('should have sensible defaults', () => {
      expect(DEFAULT_SETTINGS.enabled).toBe(true);
      expect(DEFAULT_SETTINGS.checkOnStartup).toBe(true);
      expect(DEFAULT_SETTINGS.installAutomatically).toBe(false);
    });

    const shouldAutoInstall = (
      settings: AutoUpdateSettings,
      isCritical: boolean = false
    ): boolean => {
      if (!settings.enabled) return false;
      if (isCritical) return true; // Always install critical updates
      return settings.installAutomatically;
    };

    it('should not auto-install when disabled', () => {
      const settings: AutoUpdateSettings = { ...DEFAULT_SETTINGS, enabled: false };
      expect(shouldAutoInstall(settings)).toBe(false);
    });

    it('should not auto-install when installAutomatically is false', () => {
      expect(shouldAutoInstall(DEFAULT_SETTINGS)).toBe(false);
    });

    it('should auto-install when installAutomatically is true', () => {
      const settings: AutoUpdateSettings = { ...DEFAULT_SETTINGS, installAutomatically: true };
      expect(shouldAutoInstall(settings)).toBe(true);
    });

    it('should always install critical updates when enabled', () => {
      expect(shouldAutoInstall(DEFAULT_SETTINGS, true)).toBe(true);
    });
  });

  describe('Update State Machine', () => {
    type UpdateState = 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error';

    interface UpdateStateMachine {
      state: UpdateState;
      canCheck: () => boolean;
      canDownload: () => boolean;
      canInstall: () => boolean;
    }

    const createStateMachine = (initialState: UpdateState): UpdateStateMachine => {
      let state = initialState;

      return {
        get state() { return state; },
        canCheck: () => state === 'idle' || state === 'error',
        canDownload: () => state === 'available',
        canInstall: () => state === 'ready',
      };
    };

    it('should allow checking from idle state', () => {
      const machine = createStateMachine('idle');
      expect(machine.canCheck()).toBe(true);
    });

    it('should allow checking from error state', () => {
      const machine = createStateMachine('error');
      expect(machine.canCheck()).toBe(true);
    });

    it('should not allow checking while checking', () => {
      const machine = createStateMachine('checking');
      expect(machine.canCheck()).toBe(false);
    });

    it('should allow download when update available', () => {
      const machine = createStateMachine('available');
      expect(machine.canDownload()).toBe(true);
    });

    it('should allow install when ready', () => {
      const machine = createStateMachine('ready');
      expect(machine.canInstall()).toBe(true);
    });

    it('should not allow install when not ready', () => {
      const machine = createStateMachine('available');
      expect(machine.canInstall()).toBe(false);
    });
  });
});

describe('Updater Error Handling', () => {
  describe('Error Classification', () => {
    type UpdateErrorType = 'network' | 'signature' | 'disk' | 'permission' | 'unknown';

    const classifyError = (error: Error): UpdateErrorType => {
      const message = error.message.toLowerCase();
      if (message.includes('network') || message.includes('fetch') || message.includes('timeout')) {
        return 'network';
      }
      if (message.includes('signature') || message.includes('verify')) {
        return 'signature';
      }
      if (message.includes('disk') || message.includes('space') || message.includes('storage')) {
        return 'disk';
      }
      if (message.includes('permission') || message.includes('access')) {
        return 'permission';
      }
      return 'unknown';
    };

    it('should classify network errors', () => {
      expect(classifyError(new Error('Network request failed'))).toBe('network');
      expect(classifyError(new Error('Fetch timeout'))).toBe('network');
    });

    it('should classify signature errors', () => {
      expect(classifyError(new Error('Signature verification failed'))).toBe('signature');
    });

    it('should classify disk errors', () => {
      expect(classifyError(new Error('Not enough disk space'))).toBe('disk');
      expect(classifyError(new Error('Storage full'))).toBe('disk');
    });

    it('should classify permission errors', () => {
      expect(classifyError(new Error('Permission denied'))).toBe('permission');
      expect(classifyError(new Error('Access not allowed'))).toBe('permission');
    });

    it('should default to unknown', () => {
      expect(classifyError(new Error('Something went wrong'))).toBe('unknown');
    });
  });

  describe('Retry Logic', () => {
    const MAX_RETRIES = 3;

    const shouldRetry = (errorType: string, attempt: number): boolean => {
      if (attempt >= MAX_RETRIES) return false;
      // Only retry network errors
      return errorType === 'network';
    };

    it('should retry network errors', () => {
      expect(shouldRetry('network', 0)).toBe(true);
      expect(shouldRetry('network', 1)).toBe(true);
      expect(shouldRetry('network', 2)).toBe(true);
    });

    it('should not retry after max attempts', () => {
      expect(shouldRetry('network', 3)).toBe(false);
    });

    it('should not retry non-network errors', () => {
      expect(shouldRetry('signature', 0)).toBe(false);
      expect(shouldRetry('disk', 0)).toBe(false);
      expect(shouldRetry('permission', 0)).toBe(false);
    });
  });
});
