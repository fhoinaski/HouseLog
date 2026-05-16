export type CredentialIntegrationConfig = Record<string, unknown> | null | undefined;

export type SplitCredentialIntegrationConfigResult = {
  publicConfig: Record<string, unknown> | null;
  secretPlaintext: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function splitCredentialIntegrationConfig(
  config: CredentialIntegrationConfig
): SplitCredentialIntegrationConfigResult {
  if (!isRecord(config)) {
    return { publicConfig: null, secretPlaintext: null };
  }

  const publicConfig: Record<string, unknown> = {};
  let secretPlaintext: string | null = null;

  for (const [key, value] of Object.entries(config)) {
    if (key === 'password') {
      if (typeof value === 'string' && value.trim().length > 0) {
        secretPlaintext = value;
      }
      continue;
    }
    publicConfig[key] = value;
  }

  return {
    publicConfig: Object.keys(publicConfig).length > 0 ? publicConfig : null,
    secretPlaintext,
  };
}

export function sanitizeCredentialIntegrationConfig(
  config: CredentialIntegrationConfig
): Record<string, unknown> | null {
  return splitCredentialIntegrationConfig(config).publicConfig;
}

export function hasCredentialIntegrationSecret(
  encryptedSecret: string | null | undefined,
  config: CredentialIntegrationConfig
): boolean {
  if (typeof encryptedSecret === 'string' && encryptedSecret.length > 0) return true;
  return splitCredentialIntegrationConfig(config).secretPlaintext !== null;
}
