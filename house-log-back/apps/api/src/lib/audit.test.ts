import { describe, expect, it } from 'vitest';
import { canReadTenantAuditLog, canQueryAuditLog, isValidAuditDateParam, sanitizeAuditData } from './audit';

describe('audit log tenant scope and minimization', () => {
  it('redacts secrets, ciphertext and private file keys', () => {
    expect(
      sanitizeAuditData({
        label: 'Wi-Fi',
        secret: 'plain-secret',
        ciphertext: 'encrypted',
        fileUrl: 'documents/property-a/manual.pdf',
        nested: {
          refreshTokenHash: 'hash',
          ok: true,
        },
      })
    ).toEqual({
      label: 'Wi-Fi',
      secret: '[REDACTED]',
      ciphertext: '[REDACTED]',
      fileUrl: '[REDACTED]',
      nested: {
        refreshTokenHash: '[REDACTED]',
        ok: true,
      },
    });
  });

  it('wraps primitive audit data without leaking shape errors', () => {
    expect(sanitizeAuditData('login')).toEqual({ value: 'login' });
  });

  it('blocks audit reads without active tenant', () => {
    expect(canReadTenantAuditLog({ activeTenantId: null, auditTenantId: 'tenant-a' })).toEqual({
      allowed: false,
      status: 400,
      code: 'TENANT_REQUIRED',
    });
  });

  it('blocks tenant A from reading tenant B audit entries', () => {
    expect(canReadTenantAuditLog({ activeTenantId: 'tenant-a', auditTenantId: 'tenant-b' })).toEqual({
      allowed: false,
      status: 404,
      code: 'NOT_FOUND',
    });
  });

  it('does not expose legacy null-tenant audit entries', () => {
    expect(canReadTenantAuditLog({ activeTenantId: 'tenant-a', auditTenantId: null })).toEqual({
      allowed: false,
      status: 404,
      code: 'NOT_FOUND',
    });
  });

  it('allows audit reads in the active tenant', () => {
    expect(canReadTenantAuditLog({ activeTenantId: 'tenant-a', auditTenantId: 'tenant-a' })).toEqual({
      allowed: true,
    });
  });
});

describe('sanitizeAuditData — redação de campos sensíveis adicionais', () => {
  it('redacta token, password, r2Key e mediaKey', () => {
    expect(
      sanitizeAuditData({
        name: 'item',
        token: 'abc123',
        password: 'hunter2',
        r2Key: 'media/property/file.jpg',
        mediaKey: 'media/x',
      })
    ).toEqual({
      name: 'item',
      token: '[REDACTED]',
      password: '[REDACTED]',
      r2Key: '[REDACTED]',
      mediaKey: '[REDACTED]',
    });
  });

  it('retorna null para entrada null', () => {
    expect(sanitizeAuditData(null)).toBeNull();
  });

  it('retorna null para entrada undefined', () => {
    expect(sanitizeAuditData(undefined)).toBeNull();
  });
});

describe('isValidAuditDateParam — validação de parâmetros de data', () => {
  it('aceita data ISO simples YYYY-MM-DD', () => {
    expect(isValidAuditDateParam('2025-05-04')).toBe(true);
  });

  it('aceita datetime completo YYYY-MM-DD HH:MM:SS', () => {
    expect(isValidAuditDateParam('2025-05-04 12:30:00')).toBe(true);
  });

  it('aceita formato ISO 8601 com T', () => {
    expect(isValidAuditDateParam('2025-05-04T12:30:00Z')).toBe(true);
  });

  it('rejeita string arbitrária (not-a-date)', () => {
    expect(isValidAuditDateParam('not-a-date')).toBe(false);
  });

  it('rejeita string vazia', () => {
    expect(isValidAuditDateParam('')).toBe(false);
  });

  it('rejeita formato DD/MM/YYYY', () => {
    expect(isValidAuditDateParam('04/05/2025')).toBe(false);
  });

  it('rejeita timestamp unix numérico como string', () => {
    expect(isValidAuditDateParam('1746355800')).toBe(false);
  });
});

describe('canQueryAuditLog — controle de acesso por tenantRole', () => {
  it('permite acesso para owner', () => {
    expect(canQueryAuditLog({ tenantRole: 'owner' })).toEqual({ allowed: true });
  });

  it('permite acesso para manager', () => {
    expect(canQueryAuditLog({ tenantRole: 'manager' })).toEqual({ allowed: true });
  });

  it('bloqueia provider (403)', () => {
    expect(canQueryAuditLog({ tenantRole: 'provider' })).toEqual({
      allowed: false, status: 403, code: 'FORBIDDEN',
    });
  });

  it('bloqueia temp_provider (403)', () => {
    expect(canQueryAuditLog({ tenantRole: 'temp_provider' })).toEqual({
      allowed: false, status: 403, code: 'FORBIDDEN',
    });
  });

  it('bloqueia quando tenantRole é null (sem tenant ativo)', () => {
    expect(canQueryAuditLog({ tenantRole: null })).toEqual({
      allowed: false, status: 403, code: 'FORBIDDEN',
    });
  });
});
