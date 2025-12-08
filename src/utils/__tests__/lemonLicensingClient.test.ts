import {
  validateLicenseWithLemon,
  activateLicenseWithLemon,
  deactivateLicenseWithLemon,
} from '../lemonLicensingClient';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Helper to create mock responses
function createMockResponse(data: object, ok = true, status = 200): Response {
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    json: () => Promise.resolve(data),
    headers: new Headers(),
    redirected: false,
    type: 'basic' as ResponseType,
    url: '',
    clone: () => createMockResponse(data, ok, status),
    body: null,
    bodyUsed: false,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    blob: () => Promise.resolve(new Blob()),
    formData: () => Promise.resolve(new FormData()),
    text: () => Promise.resolve(JSON.stringify(data)),
    bytes: () => Promise.resolve(new Uint8Array()),
  } as Response;
}

describe('lemonLicensingClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('validateLicenseWithLemon', () => {
    it('returns valid result for valid license', async () => {
      mockFetch.mockResolvedValue(createMockResponse({
        valid: true,
        license_key: {
          id: 123,
          status: 'active',
          activation_limit: 5,
          activation_usage: 1,
        },
        meta: {
          store_id: 1,
          product_id: 2,
          variant_id: 3,
          product_name: 'Test Product',
          variant_name: 'Standard',
          customer_name: 'John Doe',
          customer_email: 'john@example.com',
        },
      }));

      const result = await validateLicenseWithLemon('test-license-key');

      expect(result.valid).toBe(true);
      expect(result.error).toBeNull();
      expect(result.licenseKey?.status).toBe('active');
      expect(result.meta?.customer_email).toBe('john@example.com');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.lemonsqueezy.com/v1/licenses/validate',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/x-www-form-urlencoded',
          }),
        })
      );
    });

    it('includes instance_id when provided', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ valid: true }));

      await validateLicenseWithLemon('test-key', 'instance-123');

      const callArgs = mockFetch.mock.calls[0];
      const body = callArgs[1].body as URLSearchParams;
      expect(body.get('instance_id')).toBe('instance-123');
    });

    it('trims whitespace from license key', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ valid: true }));

      await validateLicenseWithLemon('  test-key  ');

      const callArgs = mockFetch.mock.calls[0];
      const body = callArgs[1].body as URLSearchParams;
      expect(body.get('license_key')).toBe('test-key');
    });

    it('returns invalid result for invalid license', async () => {
      mockFetch.mockResolvedValue(createMockResponse({
        valid: false,
        error: 'License key not found',
      }));

      const result = await validateLicenseWithLemon('invalid-key');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('License key not found');
    });

    it('handles HTTP error responses', async () => {
      mockFetch.mockResolvedValue(createMockResponse(
        { error: 'Unauthorized' },
        false,
        401
      ));

      const result = await validateLicenseWithLemon('test-key');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Unauthorized');
    });

    it('handles network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network failure'));

      const resultPromise = validateLicenseWithLemon('test-key');

      // Fast-forward through all retries
      for (let i = 0; i < 4; i++) {
        await jest.advanceTimersByTimeAsync(15000);
      }

      const result = await resultPromise;

      expect(result.valid).toBe(false);
      expect(result.error).toBe('network_error');
    });

    it('handles timeout errors', async () => {
      // Create an AbortError to simulate timeout
      const abortError = new Error('Aborted');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValue(abortError);

      const resultPromise = validateLicenseWithLemon('test-key');

      // Fast-forward through all retries
      for (let i = 0; i < 4; i++) {
        await jest.advanceTimersByTimeAsync(15000);
      }

      const result = await resultPromise;

      expect(result.valid).toBe(false);
      expect(result.error).toBe('timeout');
    });

    it('handles malformed JSON response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.reject(new Error('Invalid JSON')),
      } as Response);

      const result = await validateLicenseWithLemon('test-key');

      expect(result.valid).toBe(false);
    });
  });

  describe('activateLicenseWithLemon', () => {
    it('returns success for successful activation', async () => {
      mockFetch.mockResolvedValue(createMockResponse({
        activated: true,
        instance: {
          id: 'inst-123',
          name: 'My Device',
          created_at: '2024-01-01T00:00:00Z',
        },
        license_key: {
          id: 456,
          status: 'active',
          activation_limit: 5,
          activation_usage: 2,
        },
        meta: {
          product_name: 'Test Product',
        },
      }));

      const result = await activateLicenseWithLemon('test-key', 'My Device');

      expect(result.activated).toBe(true);
      expect(result.error).toBeNull();
      expect(result.instance?.id).toBe('inst-123');
      expect(result.instance?.name).toBe('My Device');
      expect(result.licenseKey?.activation_usage).toBe(2);
    });

    it('sends correct request body', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ activated: true }));

      await activateLicenseWithLemon('my-license', 'Device Name');

      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[0]).toBe('https://api.lemonsqueezy.com/v1/licenses/activate');
      const body = callArgs[1].body as URLSearchParams;
      expect(body.get('license_key')).toBe('my-license');
      expect(body.get('instance_name')).toBe('Device Name');
    });

    it('returns failure when activation limit reached', async () => {
      mockFetch.mockResolvedValue(createMockResponse(
        { activated: false, error: 'Activation limit reached' },
        false,
        400
      ));

      const result = await activateLicenseWithLemon('test-key', 'Device');

      expect(result.activated).toBe(false);
      expect(result.error).toBe('Activation limit reached');
    });

    it('handles network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network failure'));

      const resultPromise = activateLicenseWithLemon('test-key', 'Device');

      // Fast-forward through all retries
      for (let i = 0; i < 4; i++) {
        await jest.advanceTimersByTimeAsync(15000);
      }

      const result = await resultPromise;

      expect(result.activated).toBe(false);
      expect(result.error).toBe('network_error');
    });
  });

  describe('deactivateLicenseWithLemon', () => {
    it('returns success for successful deactivation', async () => {
      mockFetch.mockResolvedValue(createMockResponse({
        deactivated: true,
      }));

      const result = await deactivateLicenseWithLemon('test-key', 'instance-123');

      expect(result.deactivated).toBe(true);
      expect(result.error).toBeNull();
    });

    it('sends correct request body', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ deactivated: true }));

      await deactivateLicenseWithLemon('my-license', 'inst-456');

      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[0]).toBe('https://api.lemonsqueezy.com/v1/licenses/deactivate');
      const body = callArgs[1].body as URLSearchParams;
      expect(body.get('license_key')).toBe('my-license');
      expect(body.get('instance_id')).toBe('inst-456');
    });

    it('returns failure for invalid instance', async () => {
      mockFetch.mockResolvedValue(createMockResponse(
        { deactivated: false, error: 'Instance not found' },
        false,
        404
      ));

      const result = await deactivateLicenseWithLemon('test-key', 'bad-instance');

      expect(result.deactivated).toBe(false);
      expect(result.error).toBe('Instance not found');
    });

    it('handles network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const resultPromise = deactivateLicenseWithLemon('test-key', 'instance-123');

      // Fast-forward through all retries
      for (let i = 0; i < 4; i++) {
        await jest.advanceTimersByTimeAsync(15000);
      }

      const result = await resultPromise;

      expect(result.deactivated).toBe(false);
      expect(result.error).toBe('network_error');
    });
  });

  describe('retry behavior', () => {
    it('retries on server errors (5xx)', async () => {
      mockFetch
        .mockResolvedValueOnce(createMockResponse({}, false, 503))
        .mockResolvedValueOnce(createMockResponse({}, false, 502))
        .mockResolvedValueOnce(createMockResponse({ valid: true }));

      const resultPromise = validateLicenseWithLemon('test-key');

      // Advance through retry delays
      await jest.advanceTimersByTimeAsync(1000); // First retry
      await jest.advanceTimersByTimeAsync(2000); // Second retry

      const result = await resultPromise;

      expect(result.valid).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('does not retry on client errors (4xx)', async () => {
      mockFetch.mockResolvedValue(createMockResponse(
        { error: 'Invalid license' },
        false,
        400
      ));

      const result = await validateLicenseWithLemon('test-key');

      expect(result.valid).toBe(false);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('uses exponential backoff', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const resultPromise = validateLicenseWithLemon('test-key');

      // First attempt fails immediately
      // First retry after 1000ms
      await jest.advanceTimersByTimeAsync(1000);
      // Second retry after 2000ms (doubled)
      await jest.advanceTimersByTimeAsync(2000);
      // Third retry after 4000ms (doubled again)
      await jest.advanceTimersByTimeAsync(4000);
      // Give extra time for final timeout
      await jest.advanceTimersByTimeAsync(15000);

      const result = await resultPromise;

      expect(result.valid).toBe(false);
      // Initial + 3 retries = 4 total calls
      expect(mockFetch).toHaveBeenCalledTimes(4);
    });
  });
});
