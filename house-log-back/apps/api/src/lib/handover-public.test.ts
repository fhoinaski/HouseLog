import { describe, expect, it } from 'vitest';
import { hashPublicHandoverToken, resolvePublicHandoverPackage } from './handover-public';

const snapshot = {
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
    status: 'issued' as const,
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

const validRow = {
  id: 'package-1',
  property_id: 'property-1',
  title: 'Dossie de entrega',
  description: 'Entrega final da unidade',
  issuer_name: 'Eng. Maria Silva',
  issuer_role: 'Responsavel pela entrega',
  responsible_name: 'Eng. Maria Silva',
  company_name: 'Construtora Horizonte',
  type: 'handover',
  status: 'issued' as const,
  version: 3,
  issued_at: '2026-05-09T10:05:00.000Z',
  accepted_at: null,
  revoked_at: null,
  expires_at: '2026-06-09T10:05:00.000Z',
  created_at: '2026-05-09T10:05:00.000Z',
  updated_at: '2026-05-09T10:10:00.000Z',
  snapshot_json: snapshot,
};

describe('hashPublicHandoverToken', () => {
  it('gera hash hex estável e opaco para o token público', async () => {
    const hashA = await hashPublicHandoverToken('token-publico');
    const hashB = await hashPublicHandoverToken('token-publico');
    const hashC = await hashPublicHandoverToken('token-diferente');

    expect(hashA).toHaveLength(64);
    expect(hashA).toBe(hashB);
    expect(hashA).not.toBe(hashC);
  });
});

describe('resolvePublicHandoverPackage', () => {
  it('retorna pacote público válido', () => {
    const result = resolvePublicHandoverPackage(validRow);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.package.id).toBe('package-1');
      expect(result.package.snapshot_json.property.name).toBe('Apartamento Jardim');
      expect(result.package.status).toBe('issued');
      expect(result.package.issuerName).toBe('Eng. Maria Silva');
      expect(result.package.responsibleName).toBe('Eng. Maria Silva');
      expect(result.package.companyName).toBe('Construtora Horizonte');
    }
  });

  it('bloqueia token inválido', () => {
    expect(resolvePublicHandoverPackage(null)).toEqual({ ok: false, status: 404, code: 'NOT_FOUND' });
  });

  it('bloqueia pacote vencido', () => {
    expect(
      resolvePublicHandoverPackage({
        ...validRow,
        expires_at: '2026-01-01T00:00:00.000Z',
      })
    ).toEqual({ ok: false, status: 410, code: 'LINK_EXPIRED' });
  });

  it('bloqueia pacote marcado como expirado', () => {
    expect(
      resolvePublicHandoverPackage({
        ...validRow,
        status: 'expired',
      })
    ).toEqual({ ok: false, status: 410, code: 'LINK_EXPIRED' });
  });

  it('bloqueia pacote revogado', () => {
    expect(
      resolvePublicHandoverPackage({
        ...validRow,
        revoked_at: '2026-05-10T00:00:00.000Z',
      })
    ).toEqual({ ok: false, status: 410, code: 'PACKAGE_REVOKED' });
  });

  it('nao expõe tenantId', () => {
    const result = resolvePublicHandoverPackage(validRow);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Object.keys(result.package)).not.toContain('tenant_id');
    }
  });

  it('nao expõe token hash', () => {
    const result = resolvePublicHandoverPackage(validRow);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.package).not.toHaveProperty('publicAccessTokenHash');
      expect(Object.keys(result.package)).not.toContain('publicAccessTokenHash');
      expect(result.package).not.toHaveProperty('public_access_token_hash');
      expect(Object.keys(result.package)).not.toContain('public_access_token_hash');
    }
  });

  it('nao expoe packageHash', () => {
    const result = resolvePublicHandoverPackage(validRow);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.package).not.toHaveProperty('packageHash');
      expect(result.package).not.toHaveProperty('package_hash');
      expect(Object.keys(result.package)).not.toContain('packageHash');
      expect(Object.keys(result.package)).not.toContain('package_hash');
    }
  });

  it('nao expõe R2 key ou URL privada', () => {
    const result = resolvePublicHandoverPackage(validRow);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.package).not.toHaveProperty('r2_key');
      expect(result.package).not.toHaveProperty('file_url');
      expect(Object.keys(result.package)).not.toContain('r2_key');
      expect(Object.keys(result.package)).not.toContain('file_url');
    }
  });

  it('usa snapshot_json e nao dados vivos', () => {
    const result = resolvePublicHandoverPackage({
      ...validRow,
      snapshot_json: {
        ...snapshot,
        property: {
          ...snapshot.property,
          name: 'Snapshot final',
        },
      },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.package.snapshot_json.property.name).toBe('Snapshot final');
      expect(result.package.snapshot_json.package.status).toBe('issued');
    }
  });
});
