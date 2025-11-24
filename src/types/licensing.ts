export interface LicenseInfo {
  licenseKey: string;
  email: string;
  status: 'active' | 'expired' | 'revoked';
  lastChecked: string;
  token: string;
  deviceFingerprint: string;
  maxDevices: number;
}
