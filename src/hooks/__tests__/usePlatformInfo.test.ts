import { renderHook } from '@testing-library/react';
import { usePlatformInfo } from '../usePlatformInfo';

const originalNavigator = global.navigator;

describe('usePlatformInfo', () => {
  afterEach(() => {
    Object.defineProperty(window, 'navigator', {
      value: originalNavigator,
      writable: false,
      configurable: true,
    });
    Object.defineProperty(global, 'navigator', {
      value: originalNavigator,
      writable: false,
      configurable: true,
    });
  });

  const mockNavigator = (platform: string, platformVersion: string, userAgent: string) => {
    const mockNav = {
      userAgent,
      platform,
      userAgentData: { platform, platformVersion },
    };
    Object.defineProperty(window, 'navigator', {
      value: mockNav,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(global, 'navigator', {
      value: mockNav,
      writable: true,
      configurable: true,
    });
  };

  test('detects mac platform and major version', () => {
    mockNavigator('MacIntel', '14.3.0', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_3_0)');
    const { result } = renderHook(() => usePlatformInfo());
    expect(result.current.isMacLike).toBe(true);
    expect(result.current.platformIdentifier).toBe('mac');
    expect(result.current.macOSMajorVersion).toBe(14);
  });

  test('detects non-mac platform', () => {
    mockNavigator('Win32', '10.0.0', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
    const { result } = renderHook(() => usePlatformInfo());
    expect(result.current.isMacLike).toBe(false);
    expect(result.current.platformIdentifier).toBe('win');
    expect(result.current.macOSMajorVersion).toBeNull();
  });
});
