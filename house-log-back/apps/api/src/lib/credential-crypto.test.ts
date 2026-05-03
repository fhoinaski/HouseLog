import { describe, expect, it } from 'vitest';
import { encryptSecret, decryptSecret, isEncrypted, getCredentialKey } from './credential-crypto';

const RAW_KEY = 'test-secret-key-at-least-32-bytes-long!';

describe('credential-crypto', () => {
  it('roundtrip: encrypt then decrypt returns original plaintext', async () => {
    const plaintext = 'my-super-secret-password';
    const ct = await encryptSecret(plaintext, RAW_KEY);
    const result = await decryptSecret(ct, RAW_KEY);
    expect(result).toBe(plaintext);
  });

  it('encrypted value starts with v1: prefix', async () => {
    const ct = await encryptSecret('test', RAW_KEY);
    expect(ct).toMatch(/^v1:/);
  });

  it('isEncrypted detects v1: prefix', async () => {
    const ct = await encryptSecret('test', RAW_KEY);
    expect(isEncrypted(ct)).toBe(true);
    expect(isEncrypted('plaintext-no-prefix')).toBe(false);
    expect(isEncrypted('')).toBe(false);
  });

  it('each encryption produces different ciphertext due to random IV', async () => {
    const ct1 = await encryptSecret('same', RAW_KEY);
    const ct2 = await encryptSecret('same', RAW_KEY);
    expect(ct1).not.toBe(ct2);
  });

  it('decryption fails with wrong key', async () => {
    const ct = await encryptSecret('secret', RAW_KEY);
    await expect(decryptSecret(ct, 'completely-different-key-value')).rejects.toThrow();
  });

  it('decryption fails with tampered ciphertext', async () => {
    const ct = await encryptSecret('secret', RAW_KEY);
    const tampered = ct.slice(0, -4) + 'XXXX';
    await expect(decryptSecret(tampered, RAW_KEY)).rejects.toThrow();
  });

  it('decryption fails with invalid format — no colons', async () => {
    await expect(decryptSecret('notvalid', RAW_KEY)).rejects.toThrow('Invalid ciphertext format');
  });

  it('decryption fails with wrong version prefix', async () => {
    await expect(decryptSecret('v2:abc:def', RAW_KEY)).rejects.toThrow('Invalid ciphertext format');
  });

  it('handles unicode secrets correctly', async () => {
    const secret = 'pässwörd-with-ünïcödé-€-日本語';
    const ct = await encryptSecret(secret, RAW_KEY);
    expect(await decryptSecret(ct, RAW_KEY)).toBe(secret);
  });

  it('handles empty string secret', async () => {
    const ct = await encryptSecret('', RAW_KEY);
    expect(await decryptSecret(ct, RAW_KEY)).toBe('');
  });
});

describe('getCredentialKey', () => {
  const LONG_KEY = 'a'.repeat(32); // exactly 32 chars — minimum accepted length

  it('prefers CREDENTIALS_ENCRYPTION_KEY over JWT_SECRET', () => {
    expect(
      getCredentialKey({ CREDENTIALS_ENCRYPTION_KEY: LONG_KEY, JWT_SECRET: 'jwt-secret' })
    ).toBe(LONG_KEY);
  });

  it('falls back to JWT_SECRET with domain suffix in development', () => {
    expect(
      getCredentialKey({ JWT_SECRET: 'jwt-secret', ENVIRONMENT: 'development' })
    ).toBe('jwt-secret::houselog-cred-v1');
  });

  it('falls back to JWT_SECRET when no ENVIRONMENT is set (local default)', () => {
    expect(
      getCredentialKey({ JWT_SECRET: 'jwt-secret' })
    ).toBe('jwt-secret::houselog-cred-v1');
  });

  it('fallback key differs from raw JWT_SECRET', () => {
    const fallback = getCredentialKey({ JWT_SECRET: 'myjwt' });
    expect(fallback).not.toBe('myjwt');
  });

  it('throws in production when CREDENTIALS_ENCRYPTION_KEY is absent', () => {
    expect(() =>
      getCredentialKey({ JWT_SECRET: 'jwt-secret', ENVIRONMENT: 'production' })
    ).toThrow('CREDENTIALS_ENCRYPTION_KEY must be set in production');
  });

  it('throws in production when CREDENTIALS_ENCRYPTION_KEY is empty string', () => {
    expect(() =>
      getCredentialKey({ CREDENTIALS_ENCRYPTION_KEY: '', JWT_SECRET: 'jwt-secret', ENVIRONMENT: 'production' })
    ).toThrow('CREDENTIALS_ENCRYPTION_KEY must be set in production');
  });

  it('throws when dedicated key is shorter than 32 characters', () => {
    expect(() =>
      getCredentialKey({ CREDENTIALS_ENCRYPTION_KEY: 'short-key', JWT_SECRET: 'jwt' })
    ).toThrow('CREDENTIALS_ENCRYPTION_KEY must be at least 32 characters');
  });

  it('accepts dedicated key of exactly 32 characters', () => {
    expect(getCredentialKey({ CREDENTIALS_ENCRYPTION_KEY: LONG_KEY, JWT_SECRET: 'jwt' })).toBe(LONG_KEY);
  });

  it('accepts dedicated key longer than 32 characters', () => {
    const longKey = 'x'.repeat(64);
    expect(getCredentialKey({ CREDENTIALS_ENCRYPTION_KEY: longKey, JWT_SECRET: 'jwt' })).toBe(longKey);
  });
});
