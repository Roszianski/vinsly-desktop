export type RemoteLicenseStatus = 'active' | 'revoked' | 'refunded' | 'expired';

// Timeout and retry constants
const HEARTBEAT_TIMEOUT_MS = 10000; // 10 seconds
const ACTIVATE_TIMEOUT_MS = 15000; // 15 seconds
const MAX_RETRIES = 3;

export interface ActivateLicensePayload {
  licenseKey: string;
  deviceFingerprint: string;
  platform: string;
  appVersion?: string;
}

export interface ActivateLicenseResult {
  token: string;
  licenseStatus: RemoteLicenseStatus;
  maxDevices: number;
}

export interface HeartbeatPayload {
  token: string;
  deviceFingerprint: string;
  appVersion?: string;
}

export class LicenseServerError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function getBaseUrl(): string {
  const raw = (import.meta.env.VITE_LICENSE_SERVER_URL as string | undefined) ?? 'http://localhost:4000';
  const baseUrl = raw.replace(/\/+$/, '');

  // In production, enforce HTTPS
  if (import.meta.env.PROD && !baseUrl.startsWith('https://')) {
    throw new Error('License server must use HTTPS in production');
  }

  return baseUrl;
}

/**
 * Fetch with timeout support
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Retry logic with exponential backoff
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = MAX_RETRIES
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      const isLastAttempt = attempt === maxRetries - 1;

      if (isLastAttempt) {
        throw error;
      }

      // Calculate exponential backoff delay (1s, 2s, 4s, ...)
      const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
      console.log(`Request failed (attempt ${attempt + 1}/${maxRetries}), retrying in ${delay}ms...`, error.message);

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw new Error('Max retries exceeded');
}

async function handleResponse(res: Response): Promise<any> {
  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const body = isJson ? await res.json() : await res.text();

  if (res.ok) {
    return body;
  }

  const code = (isJson && body && typeof body.error === 'string') ? body.error : 'unknown_error';
  const message =
    (isJson && body && typeof body.message === 'string')
      ? body.message
      : 'Licence server error';

  throw new LicenseServerError(code, message, res.status);
}

export async function activateLicense(payload: ActivateLicensePayload): Promise<ActivateLicenseResult> {
  return retryWithBackoff(async () => {
    const baseUrl = getBaseUrl();
    const response = await fetchWithTimeout(
      `${baseUrl}/api/license/activate`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      },
      ACTIVATE_TIMEOUT_MS
    );
    const data = await handleResponse(response);
    return {
      token: data.token,
      licenseStatus: data.licenseStatus as RemoteLicenseStatus,
      maxDevices: data.maxDevices
    };
  });
}

export async function sendHeartbeat(payload: HeartbeatPayload): Promise<void> {
  return retryWithBackoff(async () => {
    const baseUrl = getBaseUrl();
    const response = await fetchWithTimeout(
      `${baseUrl}/api/license/heartbeat`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      },
      HEARTBEAT_TIMEOUT_MS
    );
    await handleResponse(response);
  });
}
