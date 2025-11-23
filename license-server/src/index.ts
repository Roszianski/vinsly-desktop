import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import jwt from 'jsonwebtoken';
import {
  findDeviceForLicense,
  findLicenseByPlainKey,
  listActiveDevicesForLicense,
  LicenseStatus,
  updateDeviceLastSeen,
  upsertDevice
} from './db.js';

const app = express();

app.use(express.json());
app.use(cors());
app.use(morgan('dev'));

const PORT = process.env.PORT ?? 4000;
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  // eslint-disable-next-line no-console
  console.warn('[license-server] JWT_SECRET is not set. Tokens cannot be verified.');
}

interface ActivateRequestBody {
  licenseKey: string;
  deviceFingerprint: string;
  platform: string;
  appVersion?: string;
}

interface HeartbeatRequestBody {
  token: string;
  deviceFingerprint: string;
  appVersion?: string;
}

interface ActivationTokenPayload {
  licenseId: number;
  deviceId: number;
  exp: number;
}

function signActivationToken(payload: Omit<ActivationTokenPayload, 'exp'>): string {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured');
  }
  const expiresInSeconds = 60 * 60 * 24 * 7; // 7 days
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  return jwt.sign({ ...payload, exp }, JWT_SECRET);
}

function verifyActivationToken(token: string): ActivationTokenPayload {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured');
  }
  return jwt.verify(token, JWT_SECRET) as ActivationTokenPayload;
}

function mapStatus(status: string): LicenseStatus {
  if (status === 'active' || status === 'revoked' || status === 'refunded' || status === 'expired') {
    return status;
  }
  return 'revoked';
}

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/license/activate', async (req, res) => {
  const body = req.body as ActivateRequestBody;
  if (!body.licenseKey || !body.deviceFingerprint || !body.platform) {
    return res.status(400).json({ error: 'invalid_request' });
  }

  try {
    const license = await findLicenseByPlainKey(body.licenseKey);
    if (!license) {
      return res.status(400).json({ error: 'license_invalid' });
    }

    const status = mapStatus(license.status);
    if (status !== 'active') {
      return res.status(403).json({ error: 'license_revoked_or_refunded' });
    }

    const devices = await listActiveDevicesForLicense(license.id);
    const existingDevice = await findDeviceForLicense(license.id, body.deviceFingerprint);

    if (!existingDevice && devices.length >= license.max_devices) {
      return res.status(403).json({ error: 'device_limit_reached' });
    }

    const device = existingDevice
      ? await (async () => {
          await updateDeviceLastSeen(existingDevice.id);
          return existingDevice;
        })()
      : await upsertDevice(license.id, body.deviceFingerprint, body.platform);

    const token = signActivationToken({
      licenseId: license.id,
      deviceId: device.id
    });

    return res.json({
      token,
      licenseStatus: status,
      maxDevices: license.max_devices
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[license-server] activate error', error);
    return res.status(500).json({ error: 'internal_error' });
  }
});

app.post('/api/license/heartbeat', async (req, res) => {
  const body = req.body as HeartbeatRequestBody;
  if (!body.token || !body.deviceFingerprint) {
    return res.status(400).json({ error: 'invalid_request' });
  }

  try {
    const payload = verifyActivationToken(body.token);
    const device = await findDeviceForLicense(payload.licenseId, body.deviceFingerprint);
    if (!device || device.id !== payload.deviceId) {
      return res.status(403).json({ error: 'device_revoked' });
    }

    if (device.revoked) {
      return res.status(403).json({ error: 'device_revoked' });
    }

    await updateDeviceLastSeen(device.id);

    return res.json({
      ok: true,
      licenseStatus: 'active'
    });
  } catch (error: any) {
    if (error?.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'token_expired' });
    }
    // eslint-disable-next-line no-console
    console.error('[license-server] heartbeat error', error);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// Placeholder for a future Lemon Squeezy webhook handler.
app.post('/webhooks/lemon', (req, res) => {
  // In a future iteration this route will:
  // - Verify the webhook signature using LEMON_WEBHOOK_SECRET.
  // - Upsert customers and licenses based on Lemon Squeezy events.
  // For now it simply acknowledges receipt so the endpoint can be wired up later.
  // eslint-disable-next-line no-console
  console.log('[license-server] received Lemon webhook', req.body?.event ?? 'unknown');
  res.status(200).json({ ok: true });
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[license-server] listening on port ${PORT}`);
});

