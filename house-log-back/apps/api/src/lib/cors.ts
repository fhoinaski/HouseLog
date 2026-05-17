export type CorsEnvironment = {
  CORS_ORIGINS?: string;
  CORS_ORIGIN?: string;
  APP_ORIGIN?: string;
  ENVIRONMENT?: string;
};

const LOCAL_DEV_ORIGINS = ['http://localhost:3000', 'http://127.0.0.1:3000'] as const;

function parseConfiguredOrigins(env: CorsEnvironment): string[] {
  const configured = env.CORS_ORIGINS ?? env.CORS_ORIGIN ?? '';
  const fromList = configured
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0 && origin !== '*');

  if (env.APP_ORIGIN && env.APP_ORIGIN.trim() !== '' && env.APP_ORIGIN !== '*') {
    fromList.push(env.APP_ORIGIN.trim());
  }

  return fromList;
}

export function getAllowedCorsOrigins(env: CorsEnvironment): Set<string> {
  const allowlist = new Set(parseConfiguredOrigins(env));

  if (env.ENVIRONMENT !== 'production') {
    for (const origin of LOCAL_DEV_ORIGINS) {
      allowlist.add(origin);
    }
  }

  return allowlist;
}

export function buildCorsOriginHandler(env: CorsEnvironment): (origin: string) => string | null {
  const allowlist = getAllowedCorsOrigins(env);

  return (origin) => {
    if (!origin) return null;
    return allowlist.has(origin) ? origin : null;
  };
}
