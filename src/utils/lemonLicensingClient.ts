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
  const key = import.meta.env.VITE_LEMON_LICENSE_API_KEY as string | undefined;
  if (!key) {
    throw new Error('VITE_LEMON_LICENSE_API_KEY is not configured');
  }
  return key;
}

export async function validateLicenseWithLemon(licenseKey: string): Promise<LemonLicenseValidationResult> {
  const baseUrl = getLemonApiBaseUrl();
  const apiKey = getLemonApiKey();

  const response = await fetch(`${baseUrl}/v1/licenses/validate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      license_key: licenseKey.trim()
    })
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
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
