import { describe, expect, it } from 'vitest';
import {
  hasCredentialIntegrationSecret,
  sanitizeCredentialIntegrationConfig,
  splitCredentialIntegrationConfig,
} from './credential-integration';

describe('credential-integration', () => {
  it('separa password do restante do integration_config', () => {
    expect(
      splitCredentialIntegrationConfig({
        host: '192.168.0.10',
        username: 'admin',
        password: 'super-secret',
      })
    ).toEqual({
      publicConfig: {
        host: '192.168.0.10',
        username: 'admin',
      },
      secretPlaintext: 'super-secret',
    });
  });

  it('sanitiza integration_config removendo password legado', () => {
    expect(
      sanitizeCredentialIntegrationConfig({
        host: 'controller.local',
        username: 'house-log',
        password: 'legacy-plain',
      })
    ).toEqual({
      host: 'controller.local',
      username: 'house-log',
    });
  });

  it('identifica segredo de integracao por coluna dedicada ou legado em JSON', () => {
    expect(hasCredentialIntegrationSecret('v1:abc:def', null)).toBe(true);
    expect(hasCredentialIntegrationSecret(null, { password: 'legacy-plain' })).toBe(true);
    expect(hasCredentialIntegrationSecret(null, { host: 'controller.local' })).toBe(false);
  });
});
