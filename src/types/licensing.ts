export interface LicenseInfo {
  licenseKey: string;
  email?: string;
  status: 'active' | 'expired' | 'revoked';
  lastChecked: string;
  instanceId: string;        // From Lemon Squeezy activation
  instanceName: string;       // Device name shown in LS dashboard
  activationLimit: number;    // Max number of devices
  activationUsage: number;    // Current number of active devices
  lastValidated?: string;    // ISO timestamp of last successful API validation
}
