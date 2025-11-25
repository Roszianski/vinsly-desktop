import { useEffect, useMemo, useState } from 'react';

export type PlatformIdentifier = 'mac' | 'win' | 'linux' | 'unknown';

const detectMacOSMajorVersion = (): number | null => {
  if (typeof navigator === 'undefined') {
    return null;
  }

  const uaData = (navigator as any).userAgentData;
  if (uaData?.platform && /mac/i.test(uaData.platform) && typeof uaData.platformVersion === 'string') {
    const parsed = parseInt(uaData.platformVersion.split('.')[0], 10);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  const userAgent = navigator.userAgent || '';
  const match = userAgent.match(/Mac OS X (\d+)[._](\d+)/i);
  if (!match) {
    return null;
  }

  const major = parseInt(match[1], 10);
  if (Number.isNaN(major)) {
    return null;
  }

  if (major === 10) {
    const minor = parseInt(match[2], 10);
    if (!Number.isNaN(minor) && minor >= 16) {
      return minor - 5;
    }
  }

  return major;
};

const getPlatformIdentifier = (): PlatformIdentifier => {
  if (typeof navigator === 'undefined') {
    return 'unknown';
  }
  const platformSource =
    ((navigator as any).userAgentData?.platform as string | undefined) ??
    navigator.platform ??
    navigator.userAgent ??
    '';
  const normalized = platformSource.toLowerCase();
  if (normalized.includes('mac')) {
    return 'mac';
  }
  if (normalized.includes('win')) {
    return 'win';
  }
  if (normalized.includes('linux')) {
    return 'linux';
  }
  return 'unknown';
};

export interface UsePlatformInfoResult {
  isMacLike: boolean;
  macOSMajorVersion: number | null;
  platformIdentifier: PlatformIdentifier;
}

export function usePlatformInfo(): UsePlatformInfoResult {
  const [isMacLike, setIsMacLike] = useState(false);
  const [macOSMajorVersion, setMacOSMajorVersion] = useState<number | null>(null);
  const platformIdentifier = useMemo(() => getPlatformIdentifier(), []);

  useEffect(() => {
    if (typeof navigator === 'undefined') {
      setIsMacLike(false);
      setMacOSMajorVersion(null);
      return;
    }
    const platform = (navigator as any).userAgentData?.platform || navigator.platform || '';
    const isMacPlatform = /mac|iphone|ipad|ipod/i.test(platform);
    setIsMacLike(isMacPlatform);
    setMacOSMajorVersion(isMacPlatform ? detectMacOSMajorVersion() : null);
  }, []);

  return {
    isMacLike,
    macOSMajorVersion,
    platformIdentifier,
  };
}
