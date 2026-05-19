import { describe, expect, it } from 'vitest';
import { resolveJwtSecret, signJwt, verifyJwt } from './jwt';

describe('resolveJwtSecret', () => {
  it('falls back to a deterministic dev secret when JWT_SECRET is missing', () => {
    expect(resolveJwtSecret({ ENVIRONMENT: 'development' })).toBe('houselog-dev-jwt-secret');
    expect(resolveJwtSecret({ JWT_SECRET: '   ', ENVIRONMENT: 'development' })).toBe('houselog-dev-jwt-secret');
  });

  it('requires JWT_SECRET in production', () => {
    expect(() => resolveJwtSecret({ ENVIRONMENT: 'production' })).toThrow('JWT_SECRET must be configured in production');
  });
});

describe('JWT fallback secret', () => {
  it('can sign and verify with the dev fallback secret', async () => {
    const secret = resolveJwtSecret({ ENVIRONMENT: 'development' });
    const token = await signJwt({ sub: 'user-1', email: 'test@example.com', role: 'owner' }, secret, 60);
    const payload = await verifyJwt(token, secret);

    expect(payload.sub).toBe('user-1');
    expect(payload.email).toBe('test@example.com');
    expect(payload.role).toBe('owner');
  });
});
