jest.mock('@tauri-apps/api/core', () => ({
  invoke: jest.fn(),
  isTauri: () => true,
}));

import { invoke } from '@tauri-apps/api/core';
import {
  activateLicenseWithLemon,
  deactivateLicenseWithLemon,
  validateLicenseWithLemon,
} from '../lemonLicensingClient';

const mockedInvoke = invoke as unknown as jest.Mock;

describe('lemonLicensingClient (tauri invoke)', () => {
  beforeEach(() => {
    mockedInvoke.mockReset();
    global.fetch = jest.fn();
  });

  test('validate uses invoke with camelCase args', async () => {
    mockedInvoke.mockResolvedValue({
      valid: true,
      error: null,
      status: 'active',
      meta: null,
      licenseKey: null,
    });

    await validateLicenseWithLemon('  test-key  ', 'inst-123');

    expect(mockedInvoke).toHaveBeenCalledWith(
      'lemon_validate_license',
      expect.objectContaining({
        licenseKey: 'test-key',
        license_key: 'test-key',
        instanceId: 'inst-123',
        instance_id: 'inst-123',
      })
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('activate uses invoke with camelCase args', async () => {
    mockedInvoke.mockResolvedValue({
      activated: true,
      error: null,
      instance: { id: 'inst-1', name: 'Device', created_at: '2024-01-01T00:00:00Z' },
    });

    await activateLicenseWithLemon('test-key', 'My Device');

    expect(mockedInvoke).toHaveBeenCalledWith(
      'lemon_activate_license',
      expect.objectContaining({
        licenseKey: 'test-key',
        license_key: 'test-key',
        instanceName: 'My Device',
        instance_name: 'My Device',
      })
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('deactivate uses invoke with camelCase args', async () => {
    mockedInvoke.mockResolvedValue({
      deactivated: true,
      error: null,
    });

    await deactivateLicenseWithLemon('test-key', 'inst-123');

    expect(mockedInvoke).toHaveBeenCalledWith(
      'lemon_deactivate_license',
      expect.objectContaining({
        licenseKey: 'test-key',
        license_key: 'test-key',
        instanceId: 'inst-123',
        instance_id: 'inst-123',
      })
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

