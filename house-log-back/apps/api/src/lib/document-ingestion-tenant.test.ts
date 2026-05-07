import { describe, expect, it } from 'vitest';
import { canAccessDocumentForIngestion, canCreateIngestionJob } from './document-ingestion-tenant';

// ── canAccessDocumentForIngestion ─────────────────────────────────────────────

const validDocAccess = {
  activeTenantId: 'tenant-a',
  documentTenantId: 'tenant-a',
  documentPropertyId: 'prop-a',
  requestedPropertyId: 'prop-a',
  documentDeletedAt: null,
};

describe('canAccessDocumentForIngestion', () => {
  it('permite criar job para documento valido no mesmo tenant e property', () => {
    expect(canAccessDocumentForIngestion(validDocAccess)).toEqual({ allowed: true });
  });

  it('retorna 404 para documento inexistente (documentTenantId null)', () => {
    expect(
      canAccessDocumentForIngestion({ ...validDocAccess, documentTenantId: null })
    ).toEqual({ allowed: false, status: 404, code: 'NOT_FOUND' });
  });

  it('retorna 404 para documento de outro tenant', () => {
    expect(
      canAccessDocumentForIngestion({ ...validDocAccess, documentTenantId: 'tenant-b' })
    ).toEqual({ allowed: false, status: 404, code: 'NOT_FOUND' });
  });

  it('retorna 404 para documento de outro property', () => {
    expect(
      canAccessDocumentForIngestion({ ...validDocAccess, documentPropertyId: 'prop-b' })
    ).toEqual({ allowed: false, status: 404, code: 'NOT_FOUND' });
  });

  it('retorna 404 para documento soft-deleted', () => {
    expect(
      canAccessDocumentForIngestion({ ...validDocAccess, documentDeletedAt: '2025-01-01T00:00:00Z' })
    ).toEqual({ allowed: false, status: 404, code: 'NOT_FOUND' });
  });

  it('retorna 400 quando nao ha tenant ativo', () => {
    expect(
      canAccessDocumentForIngestion({ ...validDocAccess, activeTenantId: null })
    ).toEqual({ allowed: false, status: 400, code: 'TENANT_REQUIRED' });
  });

  it('nao expoe documento de tenant legado com tenant_id null', () => {
    expect(
      canAccessDocumentForIngestion({ ...validDocAccess, documentTenantId: null })
    ).toEqual({ allowed: false, status: 404, code: 'NOT_FOUND' });
  });

  it('bloqueia acesso mesmo com documentPropertyId correto se tenant divergir', () => {
    expect(
      canAccessDocumentForIngestion({
        activeTenantId: 'tenant-a',
        documentTenantId: 'tenant-b',
        documentPropertyId: 'prop-a',
        requestedPropertyId: 'prop-a',
        documentDeletedAt: null,
      })
    ).toEqual({ allowed: false, status: 404, code: 'NOT_FOUND' });
  });
});

// ── canCreateIngestionJob ─────────────────────────────────────────────────────

describe('canCreateIngestionJob', () => {
  it('permite criar job quando nao ha job ativo', () => {
    expect(canCreateIngestionJob({ existingActiveJobId: null })).toEqual({ allowed: true });
  });

  it('permite criar job quando anterior esta completed, failed ou cancelled (existingActiveJobId null)', () => {
    expect(canCreateIngestionJob({ existingActiveJobId: undefined })).toEqual({ allowed: true });
  });

  it('impede job duplicado quando ja existe job com status ativo', () => {
    expect(canCreateIngestionJob({ existingActiveJobId: 'job_active_123' })).toEqual({
      allowed: false,
      status: 409,
      code: 'ACTIVE_JOB_EXISTS',
    });
  });

  it('impede job duplicado para qualquer id de job ativo nao nulo', () => {
    expect(canCreateIngestionJob({ existingActiveJobId: 'job_queued_xyz' })).toEqual({
      allowed: false,
      status: 409,
      code: 'ACTIVE_JOB_EXISTS',
    });
  });
});
