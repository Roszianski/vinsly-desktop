import { Pool } from 'pg';
import crypto from 'crypto';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  // eslint-disable-next-line no-console
  console.warn('[license-server] DATABASE_URL is not set. Database calls will fail until configured.');
}

export const pool = new Pool({
  connectionString
});

export type LicenseStatus = 'active' | 'revoked' | 'refunded' | 'expired';

export interface LicenseRow {
  id: number;
  customer_id: number;
  lemon_license_id: string | null;
  license_key_hash: string;
  status: LicenseStatus;
  max_devices: number;
}

export interface DeviceRow {
  id: number;
  license_id: number;
  device_fingerprint: string;
  platform: string;
  first_activated_at: string;
  last_seen_at: string;
  revoked: boolean;
}

export function hashLicenseKey(licenseKey: string): string {
  return crypto.createHash('sha256').update(licenseKey.trim()).digest('hex');
}

export async function findLicenseByPlainKey(licenseKey: string): Promise<LicenseRow | null> {
  const hashed = hashLicenseKey(licenseKey);
  const result = await pool.query<LicenseRow>(
    'SELECT * FROM licenses WHERE license_key_hash = $1 LIMIT 1',
    [hashed]
  );
  return result.rows[0] ?? null;
}

export async function listActiveDevicesForLicense(licenseId: number): Promise<DeviceRow[]> {
  const result = await pool.query<DeviceRow>(
    'SELECT * FROM devices WHERE license_id = $1 AND revoked = FALSE',
    [licenseId]
  );
  return result.rows;
}

export async function findDeviceForLicense(
  licenseId: number,
  fingerprint: string
): Promise<DeviceRow | null> {
  const result = await pool.query<DeviceRow>(
    'SELECT * FROM devices WHERE license_id = $1 AND device_fingerprint = $2 LIMIT 1',
    [licenseId, fingerprint]
  );
  return result.rows[0] ?? null;
}

export async function upsertDevice(
  licenseId: number,
  fingerprint: string,
  platform: string
): Promise<DeviceRow> {
  const result = await pool.query<DeviceRow>(
    `INSERT INTO devices (license_id, device_fingerprint, platform)
     VALUES ($1, $2, $3)
     ON CONFLICT (license_id, device_fingerprint)
     DO UPDATE SET last_seen_at = NOW(), platform = EXCLUDED.platform
     RETURNING *`,
    [licenseId, fingerprint, platform]
  );
  return result.rows[0];
}

export async function updateDeviceLastSeen(id: number): Promise<void> {
  await pool.query('UPDATE devices SET last_seen_at = NOW() WHERE id = $1', [id]);
}

