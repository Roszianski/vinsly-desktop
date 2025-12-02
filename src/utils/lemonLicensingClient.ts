export interface LemonLicenseValidationResult {
  valid: boolean;
  error: string | null;
  status?: string;
}

function getLemonApiBaseUrl(): string {
  const raw = (import.meta.env.VITE_LEMON_LICENSE_API_BASE as string | undefined) ?? 'https://api.lemonsqueezy.com';
  return raw.replace(/\/+$/, '');
}

function getLemonApiKey(): string {
  const env = import.meta.env as Record<string, unknown>;
  const primaryKey = env.VITE_LEMON_LICENSE_API_KEY as string | undefined;
  const testKey = env.VITE_LEMON_LICENSE_API_KEY_TEST as string | undefined;
  const isDev = Boolean(env.DEV);

  const resolvedKey =
    (isDev && testKey) ? testKey : (primaryKey ?? testKey);

  if (!resolvedKey) {
    throw new Error('Set VITE_LEMON_LICENSE_API_KEY (and optionally VITE_LEMON_LICENSE_API_KEY_TEST for dev builds).');
  }

  return resolvedKey;
}

export async function validateLicenseWithLemon(licenseKey: string): Promise<LemonLicenseValidationResult> {
  const baseUrl = getLemonApiBaseUrl();
  const apiKey = getLemonApiKey();
  const trimmedKey = licenseKey.trim();

  const response = await fetch(`${baseUrl}/v1/licenses/validate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      license_key: trimmedKey
    })
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    // Log error details without exposing sensitive data
    console.error('[Lemon] licence validation failed', {
      status: response.status,
      statusText: response.statusText,
      errorCode: payload?.error ?? 'unknown'
    });
    const code = payload?.error ?? 'request_failed';
    return { valid: false, error: code ?? 'request_failed' };
  }

  const valid = Boolean(payload?.valid);
  const status = payload?.license_key?.status as string | undefined;

  return {
    valid,
    error: valid ? null : (payload?.error ?? 'invalid'),
    status
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
}

export async function activateLicenseWithLemon(
  licenseKey: string,
  instanceName: string
): Promise<LemonLicenseActivationResult> {
  const baseUrl = getLemonApiBaseUrl();
  const apiKey = getLemonApiKey();
  const trimmedKey = licenseKey.trim();

  const response = await fetch(`${baseUrl}/v1/licenses/activate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      license_key: trimmedKey,
      instance_name: instanceName
    })
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    console.error('[Lemon] license activation failed', {
      status: response.status,
      statusText: response.statusText,
      errorCode: payload?.error ?? 'unknown'
    });
    const code = payload?.error ?? 'request_failed';
    return { activated: false, error: code ?? 'request_failed' };
  }

  const activated = Boolean(payload?.activated);

  return {
    activated,
    error: activated ? null : (payload?.error ?? 'activation_failed'),
    instance: payload?.instance,
    licenseKey: payload?.license_key
  };
}

export interface LemonLicenseDeactivationResult {
  deactivated: boolean;
  error: string | null;
}

export async function deactivateLicenseWithLemon(
  licenseKey: string,
  instanceId: string
): Promise<LemonLicenseDeactivationResult> {
  const baseUrl = getLemonApiBaseUrl();
  const apiKey = getLemonApiKey();
  const trimmedKey = licenseKey.trim();

  const response = await fetch(`${baseUrl}/v1/licenses/deactivate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      license_key: trimmedKey,
      instance_id: instanceId
    })
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    console.error('[Lemon] license deactivation failed', {
      status: response.status,
      statusText: response.statusText,
      errorCode: payload?.error ?? 'unknown'
    });
    const code = payload?.error ?? 'request_failed';
    return { deactivated: false, error: code ?? 'request_failed' };
  }

  const deactivated = Boolean(payload?.deactivated);

  return {
    deactivated,
    error: deactivated ? null : (payload?.error ?? 'deactivation_failed')
  };
}
