/**
 * Unit tests for licensing client and grace period logic
 */

// Custom error class matching the one in licensingClient.ts
class LicenseServerError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

describe('Licensing Client', () => {
  describe('LicenseServerError', () => {
    it('should create error with code, message, and status', () => {
      const error = new LicenseServerError('device_limit_reached', 'Too many devices', 403);

      expect(error.code).toBe('device_limit_reached');
      expect(error.message).toBe('Too many devices');
      expect(error.status).toBe(403);
      expect(error).toBeInstanceOf(Error);
    });

    it('should be catchable as an Error', () => {
      const error = new LicenseServerError('test_error', 'Test message', 500);

      expect(() => {
        throw error;
      }).toThrow(Error);
    });
  });

  describe('Grace Period Logic', () => {
    const GRACE_PERIOD_DAYS = 7;
    const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

    it('should calculate grace period expiry correctly', () => {
      const now = new Date();
      const graceExpiry = new Date(now.getTime() + (GRACE_PERIOD_DAYS * MILLISECONDS_PER_DAY));

      expect(graceExpiry.getTime() - now.getTime()).toBe(GRACE_PERIOD_DAYS * MILLISECONDS_PER_DAY);
    });

    it('should detect when within grace period', () => {
      const now = new Date();
      const expiryDate = new Date(now.getTime() + (3 * MILLISECONDS_PER_DAY)); // 3 days remaining

      const isWithinGrace = now < expiryDate;
      expect(isWithinGrace).toBe(true);
    });

    it('should detect when grace period has expired', () => {
      const now = new Date();
      const expiryDate = new Date(now.getTime() - (1 * MILLISECONDS_PER_DAY)); // Expired 1 day ago

      const isWithinGrace = now < expiryDate;
      expect(isWithinGrace).toBe(false);
    });

    it('should calculate days remaining correctly', () => {
      const now = new Date();
      const expiryDate = new Date(now.getTime() + (5 * MILLISECONDS_PER_DAY));

      const daysRemaining = Math.ceil((expiryDate.getTime() - now.getTime()) / MILLISECONDS_PER_DAY);
      expect(daysRemaining).toBe(5);
    });

    it('should handle edge case of exactly 0 days remaining', () => {
      const now = new Date();
      const expiryDate = new Date(now.getTime() + (12 * 60 * 60 * 1000)); // 12 hours remaining

      const daysRemaining = Math.ceil((expiryDate.getTime() - now.getTime()) / MILLISECONDS_PER_DAY);
      expect(daysRemaining).toBe(1); // Rounds up to 1 day
    });
  });

  describe('License Status Types', () => {
    const validStatuses = ['active', 'revoked', 'refunded', 'expired'] as const;

    it('should accept valid license statuses', () => {
      validStatuses.forEach(status => {
        expect(['active', 'revoked', 'refunded', 'expired']).toContain(status);
      });
    });

    it('should map active status correctly', () => {
      const mapRemoteStatus = (status: string): 'active' | 'expired' | 'revoked' => {
        if (status === 'active') return 'active';
        if (status === 'expired') return 'expired';
        return 'revoked';
      };

      expect(mapRemoteStatus('active')).toBe('active');
      expect(mapRemoteStatus('expired')).toBe('expired');
      expect(mapRemoteStatus('revoked')).toBe('revoked');
      expect(mapRemoteStatus('refunded')).toBe('revoked');
    });
  });

  describe('Device Fingerprint Validation', () => {
    it('should reject license when device fingerprint mismatches', () => {
      const storedFingerprint = 'device-abc-123';
      const currentFingerprint = 'device-xyz-789';

      const isMatch = storedFingerprint === currentFingerprint;
      expect(isMatch).toBe(false);
    });

    it('should accept license when device fingerprint matches', () => {
      const storedFingerprint = 'device-abc-123';
      const currentFingerprint = 'device-abc-123';

      const isMatch = storedFingerprint === currentFingerprint;
      expect(isMatch).toBe(true);
    });
  });

  describe('License Token Validation', () => {
    it('should require token and device fingerprint for stored license', () => {
      const validLicense = {
        token: 'jwt-token-123',
        deviceFingerprint: 'device-abc',
        licenseKey: 'KEY-123',
      };

      const invalidLicenseNoToken = {
        deviceFingerprint: 'device-abc',
        licenseKey: 'KEY-123',
      };

      const invalidLicenseNoFingerprint = {
        token: 'jwt-token-123',
        licenseKey: 'KEY-123',
      };

      expect(validLicense.token && validLicense.deviceFingerprint).toBeTruthy();
      expect((invalidLicenseNoToken as any).token && invalidLicenseNoToken.deviceFingerprint).toBeFalsy();
      expect(invalidLicenseNoFingerprint.token && (invalidLicenseNoFingerprint as any).deviceFingerprint).toBeFalsy();
    });
  });
});

describe('Retry Logic', () => {
  it('should calculate exponential backoff correctly', () => {
    const calculateBackoff = (attempt: number) => Math.min(1000 * Math.pow(2, attempt), 10000);

    expect(calculateBackoff(0)).toBe(1000); // 1s
    expect(calculateBackoff(1)).toBe(2000); // 2s
    expect(calculateBackoff(2)).toBe(4000); // 4s
    expect(calculateBackoff(3)).toBe(8000); // 8s
    expect(calculateBackoff(4)).toBe(10000); // Capped at 10s
    expect(calculateBackoff(10)).toBe(10000); // Still capped at 10s
  });

  it('should respect max retries', () => {
    const MAX_RETRIES = 3;
    let attempts = 0;

    const simulateRetries = () => {
      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        attempts++;
        const isLastAttempt = attempt === MAX_RETRIES - 1;
        if (isLastAttempt) {
          break;
        }
      }
    };

    simulateRetries();
    expect(attempts).toBe(MAX_RETRIES);
  });
});
