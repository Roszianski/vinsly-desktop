export type RemoteLicenseStatus = 'active' | 'revoked' | 'refunded' | 'expired';

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
  return raw.replace(/\/+$/, '');
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
  const baseUrl = getBaseUrl();
  const response = await fetch(`${baseUrl}/api/license/activate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  const data = await handleResponse(response);
  return {
    token: data.token,
    licenseStatus: data.licenseStatus as RemoteLicenseStatus,
    maxDevices: data.maxDevices
  };
}

export async function sendHeartbeat(payload: HeartbeatPayload): Promise<void> {
  const baseUrl = getBaseUrl();
  const response = await fetch(`${baseUrl}/api/license/heartbeat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  await handleResponse(response);
}
