import { describe, expect, it } from 'vitest';
import { buildCorsOriginHandler, getAllowedCorsOrigins } from './cors';

describe('CORS origin policy', () => {
  it('allows an allowlisted production origin', () => {
    const origin = buildCorsOriginHandler({
      ENVIRONMENT: 'production',
      CORS_ORIGINS: 'https://house-log.vercel.app',
    });

    expect(origin('https://house-log.vercel.app')).toBe('https://house-log.vercel.app');
  });

  it('blocks an unknown production origin', () => {
    const origin = buildCorsOriginHandler({
      ENVIRONMENT: 'production',
      CORS_ORIGINS: 'https://house-log.vercel.app',
    });

    expect(origin('https://evil.example')).toBeNull();
  });

  it('does not allow wildcard in production', () => {
    const origin = buildCorsOriginHandler({
      ENVIRONMENT: 'production',
      CORS_ORIGINS: '*',
    });

    expect(origin('https://house-log.vercel.app')).toBeNull();
    expect(origin('*')).toBeNull();
    expect(Array.from(getAllowedCorsOrigins({ ENVIRONMENT: 'production', CORS_ORIGINS: '*' }))).not.toContain('*');
  });

  it('fails closed when production origins are empty', () => {
    const origin = buildCorsOriginHandler({
      ENVIRONMENT: 'production',
      CORS_ORIGINS: '',
    });

    expect(origin('https://house-log.vercel.app')).toBeNull();
  });

  it('allows localhost in development', () => {
    const origin = buildCorsOriginHandler({
      ENVIRONMENT: 'development',
      CORS_ORIGINS: '',
    });

    expect(origin('http://localhost:3000')).toBe('http://localhost:3000');
    expect(origin('http://127.0.0.1:3000')).toBe('http://127.0.0.1:3000');
  });

  it('does not reflect arbitrary development origins', () => {
    const origin = buildCorsOriginHandler({
      ENVIRONMENT: 'development',
      CORS_ORIGINS: '*',
    });

    expect(origin('https://unknown-preview.vercel.app')).toBeNull();
  });
});
