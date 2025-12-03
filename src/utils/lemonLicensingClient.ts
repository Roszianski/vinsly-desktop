/**
 * Lemon Squeezy License API Client
 *
 * The License API is separate from the main Lemon Squeezy API and does NOT require authentication.
 * It uses form-encoded data (not JSON).
 *
 * Docs: https://docs.lemonsqueezy.com/api/license-api
 */

const LICENSE_API_BASE = 'https://api.lemonsqueezy.com/v1/licenses';

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
    const response = await fetch(`${LICENSE_API_BASE}/validate`, {
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
    return {
      valid: false,
      error: 'network_error',
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
    const response = await fetch(`${LICENSE_API_BASE}/activate`, {
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
    return {
      activated: false,
      error: 'network_error',
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
    const response = await fetch(`${LICENSE_API_BASE}/deactivate`, {
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
    return {
      deactivated: false,
      error: 'network_error',
    };
  }
}
