import type { Bindings } from './types';

const REQUIRED_PRODUCTION_VARS: ReadonlyArray<keyof Bindings> = ['APP_ORIGIN', 'API_ORIGIN'];

export function validateProductionConfig(env: Bindings): void {
  if (env.ENVIRONMENT !== 'production') return;

  const missing = REQUIRED_PRODUCTION_VARS.filter((key) => {
    const value = env[key];
    return !value || (typeof value === 'string' && value.trim() === '');
  });

  if (missing.length > 0) {
    throw new Error(
      `[startup] Variáveis obrigatórias ausentes em production: ${missing.join(', ')}. ` +
        `Configure custom domain same-site antes do deploy (ver docs/TECH_DEBT_REGISTER.md TD-013).`
    );
  }
}
