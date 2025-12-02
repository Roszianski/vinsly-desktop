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
