import { describe, expect, it } from 'vitest';
import { validateProductionConfig } from './env-validation';
import { getAllowedCorsOrigins } from './cors';
import type { Bindings } from './types';

function makeEnv(overrides: Partial<Bindings> = {}): Bindings {
  return {
    DB: {} as D1Database,
    STORAGE: {} as R2Bucket,
    KV: {} as KVNamespace,
    QUEUE: {} as Queue,
    DOCUMENT_INGESTION_QUEUE: {} as Queue,
    AI: {} as Ai,
    JWT_SECRET: 'test-secret',
    CORS_ORIGINS: 'https://app.houselog.app',
    RESEND_API_KEY: 'test-key',
    APP_URL: 'https://app.houselog.app',
    R2_PUBLIC_URL: 'https://pub.r2.dev',
    ENVIRONMENT: 'production',
    R2_BUCKET_NAME: 'houselog-assets',
    APP_ORIGIN: 'https://app.houselog.app',
    API_ORIGIN: 'https://api.houselog.app',
    ...overrides,
  };
}

describe('validateProductionConfig', () => {
  it('não lança em development mesmo sem APP_ORIGIN e API_ORIGIN', () => {
    const env = makeEnv({ ENVIRONMENT: 'development', APP_ORIGIN: undefined, API_ORIGIN: undefined });
    expect(() => validateProductionConfig(env)).not.toThrow();
  });

  it('não lança em staging mesmo sem APP_ORIGIN e API_ORIGIN', () => {
    const env = makeEnv({ ENVIRONMENT: 'staging', APP_ORIGIN: undefined, API_ORIGIN: undefined });
    expect(() => validateProductionConfig(env)).not.toThrow();
  });

  it('não lança em production quando APP_ORIGIN e API_ORIGIN estão definidos', () => {
    const env = makeEnv({
      ENVIRONMENT: 'production',
      APP_ORIGIN: 'https://app.houselog.app',
      API_ORIGIN: 'https://api.houselog.app',
    });
    expect(() => validateProductionConfig(env)).not.toThrow();
  });

  it('lança em production quando APP_ORIGIN está ausente', () => {
    const env = makeEnv({ ENVIRONMENT: 'production', APP_ORIGIN: undefined });
    expect(() => validateProductionConfig(env)).toThrow('APP_ORIGIN');
  });

  it('lança em production quando API_ORIGIN está ausente', () => {
    const env = makeEnv({ ENVIRONMENT: 'production', API_ORIGIN: undefined });
    expect(() => validateProductionConfig(env)).toThrow('API_ORIGIN');
  });

  it('lança em production quando ambos APP_ORIGIN e API_ORIGIN estão ausentes', () => {
    const env = makeEnv({ ENVIRONMENT: 'production', APP_ORIGIN: undefined, API_ORIGIN: undefined });
    expect(() => validateProductionConfig(env)).toThrow(/APP_ORIGIN.*API_ORIGIN|API_ORIGIN.*APP_ORIGIN/);
  });

  it('lança em production quando APP_ORIGIN é string vazia', () => {
    const env = makeEnv({ ENVIRONMENT: 'production', APP_ORIGIN: '   ' });
    expect(() => validateProductionConfig(env)).toThrow('APP_ORIGIN');
  });

  it('mensagem de erro menciona TD-013', () => {
    const env = makeEnv({ ENVIRONMENT: 'production', APP_ORIGIN: undefined, API_ORIGIN: undefined });
    expect(() => validateProductionConfig(env)).toThrow('TD-013');
  });
});

describe('getAllowedCorsOrigins — integração com APP_ORIGIN', () => {
  it('inclui APP_ORIGIN no allowlist automaticamente', () => {
    const origins = getAllowedCorsOrigins({
      CORS_ORIGINS: 'https://house-log.vercel.app',
      APP_ORIGIN: 'https://app.houselog.app',
      ENVIRONMENT: 'production',
    });
    expect(origins.has('https://app.houselog.app')).toBe(true);
  });

  it('inclui CORS_ORIGINS existentes além de APP_ORIGIN', () => {
    const origins = getAllowedCorsOrigins({
      CORS_ORIGINS: 'https://house-log.vercel.app',
      APP_ORIGIN: 'https://app.houselog.app',
      ENVIRONMENT: 'production',
    });
    expect(origins.has('https://house-log.vercel.app')).toBe(true);
    expect(origins.has('https://app.houselog.app')).toBe(true);
  });

  it('não inclui wildcard mesmo se APP_ORIGIN for "*"', () => {
    const origins = getAllowedCorsOrigins({
      APP_ORIGIN: '*',
      ENVIRONMENT: 'production',
    });
    expect(origins.has('*')).toBe(false);
  });

  it('não duplica APP_ORIGIN se já estiver em CORS_ORIGINS', () => {
    const origins = getAllowedCorsOrigins({
      CORS_ORIGINS: 'https://app.houselog.app',
      APP_ORIGIN: 'https://app.houselog.app',
      ENVIRONMENT: 'production',
    });
    // Set garante unicidade — teste que não há erro e contagem é 1
    expect(origins.size).toBe(1);
  });

  it('adiciona localhost em non-production mesmo sem CORS_ORIGINS', () => {
    const origins = getAllowedCorsOrigins({
      APP_ORIGIN: 'http://localhost:3000',
      ENVIRONMENT: 'development',
    });
    expect(origins.has('http://localhost:3000')).toBe(true);
    expect(origins.has('http://127.0.0.1:3000')).toBe(true);
  });

  it('não adiciona localhost em production', () => {
    const origins = getAllowedCorsOrigins({
      CORS_ORIGINS: 'https://app.houselog.app',
      APP_ORIGIN: 'https://app.houselog.app',
      ENVIRONMENT: 'production',
    });
    expect(origins.has('http://localhost:3000')).toBe(false);
    expect(origins.has('http://127.0.0.1:3000')).toBe(false);
  });
});
