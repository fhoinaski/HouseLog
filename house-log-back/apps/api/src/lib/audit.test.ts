import { describe, expect, it } from 'vitest';
import { canReadTenantAuditLog, sanitizeAuditData } from './audit';

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
