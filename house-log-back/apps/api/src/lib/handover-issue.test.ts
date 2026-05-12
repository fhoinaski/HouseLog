import { describe, expect, it } from 'vitest';
import {
  buildHandoverPackageHash,
  buildHandoverPackageSnapshot,
  buildPublicAccessUrl,
  canIssueHandoverPackage,
  canRevokeHandoverPackage,
  generatePublicAccessToken,
} from './handover-issue';

const baseSnapshotInput = {
  generatedAt: '2026-05-09T10:00:00.000Z',
  property: {
    id: 'property-1',
    name: 'Apartamento Jardim',
    type: 'apt',
    address: 'Rua A, 123',
    city: 'Sao Paulo',
    areaM2: 120,
    yearBuilt: 2018,
    structure: 'alvenaria',
    floors: 1,
    healthScore: 87,
  },
  package: {
    id: 'package-1',
    title: 'Dossie de entrega',
    type: 'handover',
    version: 3,
    status: 'ready_to_issue' as const,
  },
  rooms: [
    { id: 'room-1', name: 'Sala', type: 'living', floor: 0, areaM2: 24 },
  ],
  documents: [
    { id: 'doc-1', title: 'Manual do condominio', type: 'manual', issueDate: '2025-01-10', expiryDate: null },
  ],
  technicalSystems: [
    { id: 'sys-1', name: 'Quadro eletrico', type: 'electrical', status: 'active', locationSummary: 'Hall', lastInspectionAt: '2026-04-01' },
  ],
  inventoryItems: [
    { id: 'item-1', name: 'Kit chaves', category: 'other', roomId: 'room-1', quantity: 1, unit: 'un', warrantyUntil: null },
  ],
  warranties: [
    { id: 'war-1', title: 'Garantia da porta', warrantyType: 'material', status: 'active', startDate: '2025-01-01', endDate: '2027-01-01', providerName: 'Fornecedor X' },
  ],
  maintenanceSchedules: [
    { id: 'mnt-1', title: 'Inspecao preventiva', systemType: 'electrical', responsible: 'Tech Co', frequency: '6m', lastDone: '2026-02-01', nextDue: '2026-08-01', autoCreateOs: true },
  ],
  checklistItems: [
    { id: 'chk-1', title: 'Conferir documentos', category: 'documents', status: 'pending', required: true, condition: null, completedAt: null, roomId: null, documentId: 'doc-1', inventoryItemId: null, serviceOrderId: null },
  ],
};

describe('canIssueHandoverPackage', () => {
  it('permite emissao para tenant owner com pacote pronto', () => {
    expect(
      canIssueHandoverPackage({
        tenantId: 'tenant-1',
        tenantRole: 'owner',
        userId: 'user-1',
        userRole: 'owner',
        propertyOwnerId: 'user-1',
        propertyManagerId: null,
        packageStatus: 'ready_to_issue',
        issuedAt: null,
        revokedAt: null,
        acceptedAt: null,
        publicAccessTokenHash: null,
      })
    ).toEqual({ allowed: true });
  });

  it('permite emissao para tenant manager com pacote pronto', () => {
    expect(
      canIssueHandoverPackage({
        tenantId: 'tenant-1',
        tenantRole: 'manager',
        userId: 'user-2',
        userRole: 'owner',
        propertyOwnerId: 'owner-1',
        propertyManagerId: 'user-2',
        packageStatus: 'ready_to_issue',
        issuedAt: null,
        revokedAt: null,
        acceptedAt: null,
        publicAccessTokenHash: null,
      })
    ).toEqual({ allowed: true });
  });

  it('permite emissao para admin com pacote pronto', () => {
    expect(
      canIssueHandoverPackage({
        tenantId: 'tenant-1',
        tenantRole: 'owner',
        userId: 'admin-1',
        userRole: 'admin',
        propertyOwnerId: 'owner-1',
        propertyManagerId: 'manager-1',
        packageStatus: 'ready_to_issue',
        issuedAt: null,
        revokedAt: null,
        acceptedAt: null,
        publicAccessTokenHash: null,
      })
    ).toEqual({ allowed: true });
  });

  it('bloqueia provider', () => {
    expect(
      canIssueHandoverPackage({
        tenantId: 'tenant-1',
        tenantRole: 'provider',
        userId: 'provider-1',
        userRole: 'provider',
        propertyOwnerId: 'owner-1',
        propertyManagerId: 'manager-1',
        packageStatus: 'ready_to_issue',
        issuedAt: null,
        revokedAt: null,
        acceptedAt: null,
        publicAccessTokenHash: null,
      })
    ).toEqual({ allowed: false, status: 403, code: 'FORBIDDEN' });
  });

  it('bloqueia temp_provider', () => {
    expect(
      canIssueHandoverPackage({
        tenantId: 'tenant-1',
        tenantRole: 'manager',
        userId: 'provider-2',
        userRole: 'temp_provider',
        propertyOwnerId: 'owner-1',
        propertyManagerId: 'manager-1',
        packageStatus: 'ready_to_issue',
        issuedAt: null,
        revokedAt: null,
        acceptedAt: null,
        publicAccessTokenHash: null,
      })
    ).toEqual({ allowed: false, status: 403, code: 'FORBIDDEN' });
  });

  it('bloqueia sem tenant ativo', () => {
    expect(
      canIssueHandoverPackage({
        tenantId: null,
        tenantRole: null,
        userId: 'user-1',
        userRole: 'owner',
        propertyOwnerId: 'owner-1',
        propertyManagerId: null,
        packageStatus: 'ready_to_issue',
        issuedAt: null,
        revokedAt: null,
        acceptedAt: null,
        publicAccessTokenHash: null,
      })
    ).toEqual({ allowed: false, status: 400, code: 'TENANT_REQUIRED' });
  });

  it('bloqueia pacote em draft', () => {
    expect(
      canIssueHandoverPackage({
        tenantId: 'tenant-1',
        tenantRole: 'owner',
        userId: 'user-1',
        userRole: 'owner',
        propertyOwnerId: 'user-1',
        propertyManagerId: null,
        packageStatus: 'draft',
        issuedAt: null,
        revokedAt: null,
        acceptedAt: null,
        publicAccessTokenHash: null,
      })
    ).toEqual({ allowed: false, status: 409, code: 'CONFLICT' });
  });

  it('bloqueia pacote em review', () => {
    expect(
      canIssueHandoverPackage({
        tenantId: 'tenant-1',
        tenantRole: 'owner',
        userId: 'user-1',
        userRole: 'owner',
        propertyOwnerId: 'user-1',
        propertyManagerId: null,
        packageStatus: 'in_review',
        issuedAt: null,
        revokedAt: null,
        acceptedAt: null,
        publicAccessTokenHash: null,
      })
    ).toEqual({ allowed: false, status: 409, code: 'CONFLICT' });
  });

  it('bloqueia emissao repetida de pacote ja emitido', () => {
    expect(
      canIssueHandoverPackage({
        tenantId: 'tenant-1',
        tenantRole: 'owner',
        userId: 'user-1',
        userRole: 'owner',
        propertyOwnerId: 'user-1',
        propertyManagerId: null,
        packageStatus: 'issued',
        issuedAt: '2026-05-09T11:00:00.000Z',
        revokedAt: null,
        acceptedAt: null,
        publicAccessTokenHash: 'already-hashed',
      })
    ).toEqual({ allowed: false, status: 409, code: 'CONFLICT' });
  });
});

describe('canRevokeHandoverPackage', () => {
  const baseInput = {
    tenantId: 'tenant-1',
    tenantRole: 'owner' as const,
    userId: 'user-1',
    userRole: 'owner' as const,
    propertyOwnerId: 'user-1',
    propertyManagerId: null,
    packageStatus: 'issued' as const,
    issuedAt: '2026-05-09T10:05:00.000Z',
    revokedAt: null,
    publicAccessTokenHash: 'token-hash',
  };

  it('permite revogar pacote issued', () => {
    expect(canRevokeHandoverPackage(baseInput)).toEqual({ allowed: true });
  });

  it('permite revogar pacote accepted', () => {
    expect(canRevokeHandoverPackage({ ...baseInput, packageStatus: 'accepted' })).toEqual({ allowed: true });
  });

  it('bloqueia provider', () => {
    expect(canRevokeHandoverPackage({
      ...baseInput,
      tenantRole: 'provider',
      userRole: 'provider',
      userId: 'provider-1',
      propertyOwnerId: 'owner-1',
    })).toEqual({ allowed: false, status: 403, code: 'FORBIDDEN' });
  });

  it('bloqueia usuario sem permissao de gestao', () => {
    expect(canRevokeHandoverPackage({
      ...baseInput,
      tenantRole: 'provider',
      userRole: 'owner',
      userId: 'other-user',
      propertyOwnerId: 'owner-1',
      propertyManagerId: 'manager-1',
    })).toEqual({ allowed: false, status: 403, code: 'FORBIDDEN' });
  });

  it('bloqueia pacote draft', () => {
    expect(canRevokeHandoverPackage({ ...baseInput, packageStatus: 'draft', issuedAt: null, publicAccessTokenHash: null })).toEqual({
      allowed: false,
      status: 409,
      code: 'CONFLICT',
    });
  });

  it('bloqueia pacote ja revogado', () => {
    expect(canRevokeHandoverPackage({
      ...baseInput,
      packageStatus: 'revoked',
      revokedAt: '2026-05-10T00:00:00.000Z',
    })).toEqual({ allowed: false, status: 409, code: 'CONFLICT' });
  });
});

describe('snapshot and token helpers', () => {
  it('monta snapshot rico e estável com as seções esperadas', () => {
    const snapshot = buildHandoverPackageSnapshot(baseSnapshotInput);

    expect(snapshot.generatedAt).toBe(baseSnapshotInput.generatedAt);
    expect(snapshot.property.name).toBe('Apartamento Jardim');
    expect(snapshot.documents).toHaveLength(1);
    expect(snapshot.technicalSystems[0]?.name).toBe('Quadro eletrico');
    expect(snapshot.maintenanceSchedules[0]?.nextDue).toBe('2026-08-01');
    expect(snapshot.checklistItems[0]?.documentId).toBe('doc-1');
  });

  it('gera token publico opaco e hash separado', async () => {
    const { token, tokenHash } = await generatePublicAccessToken();

    expect(token).toHaveLength(48);
    expect(tokenHash).toHaveLength(64);
    expect(tokenHash).not.toBe(token);
  });

  it('gera URL publica de uso unico com o token embutido', () => {
    const url = buildPublicAccessUrl('https://app.houselog.local', 'token-abc');

    expect(url).toBe('https://app.houselog.local/handover/token-abc');
    expect(url).not.toContain('package-1');
    expect(url).not.toContain('hash');
  });

  it('gera hash deterministico do pacote para o mesmo snapshot', async () => {
    const snapshot = buildHandoverPackageSnapshot(baseSnapshotInput);
    const hashA = await buildHandoverPackageHash({
      packageId: 'package-1',
      version: 3,
      issuedAt: '2026-05-09T10:05:00.000Z',
      expiresAt: '2026-06-08T10:05:00.000Z',
      snapshotJson: snapshot,
    });
    const hashB = await buildHandoverPackageHash({
      packageId: 'package-1',
      version: 3,
      issuedAt: '2026-05-09T10:05:00.000Z',
      expiresAt: '2026-06-08T10:05:00.000Z',
      snapshotJson: snapshot,
    });

    expect(hashA).toHaveLength(64);
    expect(hashA).toBe(hashB);
  });
});
