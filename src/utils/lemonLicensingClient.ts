/**
 * Lemon Squeezy License API Client
 *
 * The License API is separate from the main Lemon Squeezy API and does NOT require authentication.
 * It uses form-encoded data (not JSON).
 *
 * Docs: https://docs.lemonsqueezy.com/api/license-api
 */

const LICENSE_API_BASE = 'https://api.lemonsqueezy.com/v1/licenses';

// Network configuration
const REQUEST_TIMEOUT_MS = 15000; // 15 second timeout
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1000; // 1 second initial delay, doubles each retry

/**
 * Fetch with timeout support using AbortController.
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number = REQUEST_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Sleep utility for retry delays.
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch with retry logic and exponential backoff.
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries: number = MAX_RETRIES
): Promise<Response> {
  let lastError: Error | null = null;
  let delay = INITIAL_RETRY_DELAY_MS;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, options);
      // Don't retry on client errors (4xx), only on server errors (5xx) or network issues
      if (response.ok || (response.status >= 400 && response.status < 500)) {
        return response;
      }
      // Server error - will retry
      lastError = new Error(`Server error: ${response.status}`);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      // Check if it was an abort (timeout)
      if (lastError.name === 'AbortError') {
        lastError = new Error('Request timed out');
      }
    }

    // Don't sleep after the last attempt
    if (attempt < maxRetries) {
      await sleep(delay);
      delay *= 2; // Exponential backoff
    }
  }

  throw lastError ?? new Error('Request failed after retries');
}

export interface LemonLicenseValidationResult {
  valid: boolean;
  error: string | null;
  status?: string;
  meta?: {
    store_id: number;
    product_id: number;
    variant_id: number;
    product_name: string;
    variant_name: string;
    customer_name: string;
    customer_email: string;
  };
  licenseKey?: {
    id: number;
    status: string;
    activation_limit: number;
    activation_usage: number;
  };
}

export interface LemonLicenseActivationResult {
  activated: boolean;
  error: string | null;
  instance?: {
    id: string;
    name: string;
    created_at: string;
  };
  licenseKey?: {
    id: number;
    status: string;
    activation_limit: number;
    activation_usage: number;
  };
  meta?: {
    store_id: number;
    product_id: number;
    variant_id: number;
    product_name: string;
    variant_name: string;
    customer_name: string;
    customer_email: string;
  };
}

export interface LemonLicenseDeactivationResult {
  deactivated: boolean;
  error: string | null;
}

/**
 * Validate a license key with Lemon Squeezy.
 * Optionally validate a specific instance by providing instanceId.
 */
export async function validateLicenseWithLemon(
  licenseKey: string,
  instanceId?: string
): Promise<LemonLicenseValidationResult> {
  const trimmedKey = licenseKey.trim();

  const body = new URLSearchParams();
  body.append('license_key', trimmedKey);
  if (instanceId) {
    body.append('instance_id', instanceId);
  }

  try {
    const response = await fetchWithRetry(`${LICENSE_API_BASE}/validate`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body,
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      console.error('[Lemon] license validation failed', {
        status: response.status,
        statusText: response.statusText,
        error: payload?.error,
      });
      return {
        valid: false,
        error: payload?.error ?? 'request_failed',
      };
    }

    const valid = Boolean(payload?.valid);
    const status = payload?.license_key?.status as string | undefined;

    return {
      valid,
      error: valid ? null : (payload?.error ?? 'invalid'),
      status,
      meta: payload?.meta,
      licenseKey: payload?.license_key,
    };
  } catch (err) {
    console.error('[Lemon] license validation error', err);
    const errorMessage = err instanceof Error ? err.message : 'network_error';
    return {
      valid: false,
      error: errorMessage.includes('timed out') ? 'timeout' : 'network_error',
    };
  }
}

/**
 * Activate a license key with Lemon Squeezy.
 * Creates a new instance for the given device/installation.
 */
export async function activateLicenseWithLemon(
  licenseKey: string,
  instanceName: string
): Promise<LemonLicenseActivationResult> {
  const trimmedKey = licenseKey.trim();

  const body = new URLSearchParams();
  body.append('license_key', trimmedKey);
  body.append('instance_name', instanceName);

  try {
    const response = await fetchWithRetry(`${LICENSE_API_BASE}/activate`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body,
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      console.error('[Lemon] license activation failed', {
        status: response.status,
        statusText: response.statusText,
        error: payload?.error,
      });
      return {
        activated: false,
        error: payload?.error ?? 'request_failed',
      };
    }

    const activated = Boolean(payload?.activated);

    return {
      activated,
      error: activated ? null : (payload?.error ?? 'activation_failed'),
      instance: payload?.instance,
      licenseKey: payload?.license_key,
      meta: payload?.meta,
    };
  } catch (err) {
    console.error('[Lemon] license activation error', err);
    const errorMessage = err instanceof Error ? err.message : 'network_error';
    return {
      activated: false,
      error: errorMessage.includes('timed out') ? 'timeout' : 'network_error',
    };
  }
}

/**
 * Deactivate a license key instance with Lemon Squeezy.
 * This deactivates a specific instance, not the license key itself.
 */
export async function deactivateLicenseWithLemon(
  licenseKey: string,
  instanceId: string
): Promise<LemonLicenseDeactivationResult> {
  const trimmedKey = licenseKey.trim();

  const body = new URLSearchParams();
  body.append('license_key', trimmedKey);
  body.append('instance_id', instanceId);

  try {
    const response = await fetchWithRetry(`${LICENSE_API_BASE}/deactivate`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body,
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      console.error('[Lemon] license deactivation failed', {
        status: response.status,
        statusText: response.statusText,
        error: payload?.error,
      });
      return {
        deactivated: false,
        error: payload?.error ?? 'request_failed',
      };
    }

    const deactivated = Boolean(payload?.deactivated);

    return {
      deactivated,
      error: deactivated ? null : (payload?.error ?? 'deactivation_failed'),
    };
  } catch (err) {
    console.error('[Lemon] license deactivation error', err);
    const errorMessage = err instanceof Error ? err.message : 'network_error';
    return {
      deactivated: false,
      error: errorMessage.includes('timed out') ? 'timeout' : 'network_error',
    };
  }
}
