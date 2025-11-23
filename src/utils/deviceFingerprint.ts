import { getStorageItem, setStorageItem } from './storage';

const DEVICE_FINGERPRINT_KEY = 'vinsly-device-fingerprint';

export async function getOrCreateDeviceFingerprint(): Promise<string> {
  const existing = await getStorageItem<string>(DEVICE_FINGERPRINT_KEY);
  if (existing) {
    return existing;
  }

  let fingerprint: string;
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    fingerprint = crypto.randomUUID();
  } else {
    fingerprint = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  await setStorageItem(DEVICE_FINGERPRINT_KEY, fingerprint);
  return fingerprint;
}

