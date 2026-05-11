import { beforeEach, describe, expect, it, vi } from 'vitest';
import publicHandover from './public-handover';
import { getDb } from '../db/client';
import { writeAuditLog } from '../lib/audit';
import type { Bindings } from '../lib/types';

vi.mock('../db/client', () => ({
  getDb: vi.fn(),
}));

vi.mock('../lib/audit', () => ({
  writeAuditLog: vi.fn(),
}));

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

type PublicHandoverRow = {
  id: string;
  tenant_id?: string;
  property_id: string;
  title: string;
  description: string | null;
  issuer_name: string | null;
  issuer_role: string | null;
  responsible_name: string | null;
  company_name: string | null;
  type: string;
  status: 'issued' | 'accepted' | 'revoked' | 'expired' | 'draft' | 'in_review' | 'ready_to_issue';
  version: number;
  issued_at: string | null;
  accepted_at: string | null;
  revoked_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string | null;
  snapshot_json: typeof snapshot;
};

function createDb(row: PublicHandoverRow | null) {
  const updateValues: Array<Record<string, unknown>> = [];
  const updateWhere = vi.fn(async () => undefined);
  const updateSet = vi.fn((values: Record<string, unknown>) => {
    updateValues.push(values);
    return { where: updateWhere };
  });
  const query = {
    leftJoin: vi.fn(() => query),
    where: vi.fn(() => ({
      limit: vi.fn(async () => (row ? [row] : [])),
    })),
  };

  return {
    select: vi.fn(() => ({
      from: vi.fn(() => query),
    })),
    update: vi.fn(() => ({
      set: updateSet,
    })),
    updateValues,
    updateWhere,
  };
}

function buildEnv() {
  return {
    DB: {} as D1Database,
  } as Bindings;
}

function buildIssuedRow(overrides: Partial<PublicHandoverRow> = {}): PublicHandoverRow {
  return {
    id: 'package-1',
    tenant_id: 'tenant-1',
    property_id: 'property-1',
    title: 'Dossie de entrega',
    description: 'Entrega final da unidade',
    issuer_name: 'Eng. Maria Silva',
    issuer_role: 'Responsavel pela entrega',
    responsible_name: 'Eng. Maria Silva',
    company_name: 'Construtora Horizonte',
    type: 'handover',
    status: 'issued',
    version: 3,
    issued_at: '2026-05-09T10:05:00.000Z',
    accepted_at: null,
    revoked_at: null,
    expires_at: '2026-06-09T10:05:00.000Z',
    created_at: '2026-05-09T10:05:00.000Z',
    updated_at: '2026-05-09T10:10:00.000Z',
    snapshot_json: snapshot,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /public/handover/:token', () => {
  it('retorna pacote público válido sem expor campos internos', async () => {
    const row: PublicHandoverRow = {
      id: 'package-1',
      property_id: 'property-1',
      title: 'Dossie de entrega',
      description: 'Entrega final da unidade',
      issuer_name: 'Eng. Maria Silva',
      issuer_role: 'Responsavel pela entrega',
      responsible_name: 'Eng. Maria Silva',
      company_name: 'Construtora Horizonte',
      type: 'handover',
      status: 'issued',
      version: 3,
      issued_at: '2026-05-09T10:05:00.000Z',
      accepted_at: null,
      revoked_at: null,
      expires_at: '2026-06-09T10:05:00.000Z',
      created_at: '2026-05-09T10:05:00.000Z',
      updated_at: '2026-05-09T10:10:00.000Z',
      snapshot_json: snapshot,
    };

    vi.mocked(getDb).mockReturnValue(createDb(row) as never);

    const response = await publicHandover.fetch(new Request('http://localhost/handover/token-publico'), buildEnv());
    const body = (await response.json()) as { package: Record<string, unknown> };

    expect(response.status).toBe(200);
    expect(body.package.id).toBe('package-1');
    expect(body.package.property_id).toBe('property-1');
    expect(body.package.snapshot_json).toMatchObject({
      property: { name: 'Apartamento Jardim' },
      package: { status: 'issued' },
    });
    expect(body.package.issuerName).toBe('Eng. Maria Silva');
    expect(body.package.responsibleName).toBe('Eng. Maria Silva');
    expect(body.package.companyName).toBe('Construtora Horizonte');
    expect(body.package).not.toHaveProperty('tenant_id');
    expect(body.package).not.toHaveProperty('public_access_token_hash');
    expect(body.package).not.toHaveProperty('package_hash');
    expect(body.package).not.toHaveProperty('r2_key');
  });

  it('retorna pacote aceito com o mesmo DTO público', async () => {
    const row: PublicHandoverRow = {
      id: 'package-1',
      property_id: 'property-1',
      title: 'Dossie de entrega',
      description: 'Entrega final da unidade',
      issuer_name: 'Eng. Maria Silva',
      issuer_role: 'Responsavel pela entrega',
      responsible_name: 'Eng. Maria Silva',
      company_name: 'Construtora Horizonte',
      type: 'handover',
      status: 'accepted',
      version: 3,
      issued_at: '2026-05-09T10:05:00.000Z',
      accepted_at: '2026-05-10T09:00:00.000Z',
      revoked_at: null,
      expires_at: '2026-06-09T10:05:00.000Z',
      created_at: '2026-05-09T10:05:00.000Z',
      updated_at: '2026-05-10T09:00:00.000Z',
      snapshot_json: snapshot,
    };

    vi.mocked(getDb).mockReturnValue(createDb(row) as never);

    const response = await publicHandover.fetch(new Request('http://localhost/handover/token-aceito'), buildEnv());
    const body = (await response.json()) as { package: Record<string, unknown> };

    expect(response.status).toBe(200);
    expect(body.package.status).toBe('accepted');
    expect(body.package.snapshot_json).toMatchObject({
      package: { status: 'issued' },
    });
  });

  it('bloqueia token inexistente', async () => {
    vi.mocked(getDb).mockReturnValue(createDb(null) as never);

    const response = await publicHandover.fetch(new Request('http://localhost/handover/token-invalido'), buildEnv());
    const body = (await response.json()) as { error: string; code: string };

    expect(response.status).toBe(404);
    expect(body).toEqual({ error: 'Pacote nao encontrado', code: 'NOT_FOUND' });
  });

  it('bloqueia pacote vencido', async () => {
    vi.mocked(getDb).mockReturnValue(
      createDb({
        id: 'package-1',
        property_id: 'property-1',
        title: 'Dossie de entrega',
        description: null,
        issuer_name: null,
        issuer_role: null,
        responsible_name: null,
        company_name: null,
        type: 'handover',
        status: 'issued',
        version: 3,
        issued_at: '2026-05-09T10:05:00.000Z',
        accepted_at: null,
        revoked_at: null,
        expires_at: '2026-01-01T00:00:00.000Z',
        created_at: '2026-05-09T10:05:00.000Z',
        updated_at: null,
        snapshot_json: snapshot,
      }) as never
    );

    const response = await publicHandover.fetch(new Request('http://localhost/handover/token-expirado'), buildEnv());
    const body = (await response.json()) as { error: string; code: string };

    expect(response.status).toBe(410);
    expect(body).toEqual({ error: 'Link expirado', code: 'LINK_EXPIRED' });
  });

  it('bloqueia pacote revogado', async () => {
    vi.mocked(getDb).mockReturnValue(
      createDb({
        id: 'package-1',
        property_id: 'property-1',
        title: 'Dossie de entrega',
        description: null,
        issuer_name: null,
        issuer_role: null,
        responsible_name: null,
        company_name: null,
        type: 'handover',
        status: 'accepted',
        version: 3,
        issued_at: '2026-05-09T10:05:00.000Z',
        accepted_at: '2026-05-10T09:00:00.000Z',
        revoked_at: '2026-05-11T09:00:00.000Z',
        expires_at: '2026-06-09T10:05:00.000Z',
        created_at: '2026-05-09T10:05:00.000Z',
        updated_at: '2026-05-10T09:00:00.000Z',
        snapshot_json: snapshot,
      }) as never
    );

    const response = await publicHandover.fetch(new Request('http://localhost/handover/token-revogado'), buildEnv());
    const body = (await response.json()) as { error: string; code: string };

    expect(response.status).toBe(410);
    expect(body).toEqual({ error: 'Pacote revogado', code: 'PACKAGE_REVOKED' });
  });

  it('usa snapshot_json e nao dados vivos', async () => {
    const liveSnapshot = {
      ...snapshot,
      property: {
        ...snapshot.property,
        name: 'Snapshot final',
      },
    };

    vi.mocked(getDb).mockReturnValue(
      createDb({
        id: 'package-1',
        property_id: 'property-1',
        title: 'Dossie de entrega',
        description: null,
        issuer_name: null,
        issuer_role: null,
        responsible_name: null,
        company_name: null,
        type: 'handover',
        status: 'accepted',
        version: 3,
        issued_at: '2026-05-09T10:05:00.000Z',
        accepted_at: '2026-05-10T09:00:00.000Z',
        revoked_at: null,
        expires_at: '2026-06-09T10:05:00.000Z',
        created_at: '2026-05-09T10:05:00.000Z',
        updated_at: '2026-05-10T09:00:00.000Z',
        snapshot_json: liveSnapshot,
      }) as never
    );

    const response = await publicHandover.fetch(new Request('http://localhost/handover/token-snapshot'), buildEnv());
    const body = (await response.json()) as { package: { snapshot_json: { property: { name: string } } } };

    expect(response.status).toBe(200);
    expect(body.package.snapshot_json.property.name).toBe('Snapshot final');
  });
});

describe('POST /public/handover/:token/accept', () => {
  const validBody = {
    acceptedByName: 'Maria Silva',
    acceptedByEmail: 'maria@exemplo.com',
    acceptanceNotes: 'Recebido em boas condicoes.',
    acceptedTerms: true,
  };

  function acceptRequest(body: Record<string, unknown>) {
    return new Request('http://localhost/handover/token-publico/accept', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'CF-Connecting-IP': '203.0.113.10',
      },
      body: JSON.stringify(body),
    });
  }

  it('aceita pacote valido e retorna DTO publico atualizado', async () => {
    const db = createDb(buildIssuedRow());
    vi.mocked(getDb).mockReturnValue(db as never);

    const response = await publicHandover.fetch(acceptRequest(validBody), buildEnv());
    const body = (await response.json()) as { package: Record<string, unknown> };

    expect(response.status).toBe(200);
    expect(body.package.status).toBe('accepted');
    expect(body.package.accepted_at).toEqual(expect.any(String));
    expect(body.package).not.toHaveProperty('tenant_id');
    expect(body.package).not.toHaveProperty('public_access_token_hash');
    expect(body.package).not.toHaveProperty('package_hash');
    expect(body.package).not.toHaveProperty('r2_key');
    expect(db.updateValues[0]).toMatchObject({
      status: 'accepted',
      acceptedByName: 'Maria Silva',
      acceptedByEmail: 'maria@exemplo.com',
      acceptanceNotes: 'Recebido em boas condicoes.',
    });
    expect(writeAuditLog).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      tenantId: 'tenant-1',
      propertyId: 'property-1',
      entityType: 'handover_package',
      entityId: 'package-1',
      action: 'handover_package_public_accepted',
      actorId: null,
      actorIp: '203.0.113.10',
    }));
  });

  it('exige acceptedTerms verdadeiro', async () => {
    vi.mocked(getDb).mockReturnValue(createDb(buildIssuedRow()) as never);

    const response = await publicHandover.fetch(acceptRequest({
      ...validBody,
      acceptedTerms: false,
    }), buildEnv());
    const body = (await response.json()) as { code: string };

    expect(response.status).toBe(422);
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  it('valida email', async () => {
    vi.mocked(getDb).mockReturnValue(createDb(buildIssuedRow()) as never);

    const response = await publicHandover.fetch(acceptRequest({
      ...validBody,
      acceptedByEmail: 'email-invalido',
    }), buildEnv());
    const body = (await response.json()) as { code: string };

    expect(response.status).toBe(422);
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  it('rejeita token invalido sem revelar existencia', async () => {
    vi.mocked(getDb).mockReturnValue(createDb(null) as never);

    const response = await publicHandover.fetch(acceptRequest(validBody), buildEnv());
    const body = (await response.json()) as { error: string; code: string };

    expect(response.status).toBe(404);
    expect(body).toEqual({ error: 'Pacote nao encontrado', code: 'NOT_FOUND' });
  });

  it('rejeita link expirado com codigo seguro', async () => {
    vi.mocked(getDb).mockReturnValue(createDb(buildIssuedRow({
      expires_at: '2026-01-01T00:00:00.000Z',
    })) as never);

    const response = await publicHandover.fetch(acceptRequest(validBody), buildEnv());
    const body = (await response.json()) as { error: string; code: string };

    expect(response.status).toBe(410);
    expect(body).toEqual({ error: 'Link expirado', code: 'LINK_EXPIRED' });
  });

  it('rejeita pacote revogado com codigo seguro', async () => {
    vi.mocked(getDb).mockReturnValue(createDb(buildIssuedRow({
      revoked_at: '2026-05-11T10:00:00.000Z',
    })) as never);

    const response = await publicHandover.fetch(acceptRequest(validBody), buildEnv());
    const body = (await response.json()) as { error: string; code: string };

    expect(response.status).toBe(410);
    expect(body).toEqual({ error: 'Pacote revogado', code: 'PACKAGE_REVOKED' });
  });

  it('rejeita pacote ja aceito', async () => {
    vi.mocked(getDb).mockReturnValue(createDb(buildIssuedRow({
      status: 'accepted',
      accepted_at: '2026-05-10T09:00:00.000Z',
    })) as never);

    const response = await publicHandover.fetch(acceptRequest(validBody), buildEnv());
    const body = (await response.json()) as { error: string; code: string };

    expect(response.status).toBe(409);
    expect(body).toEqual({ error: 'Entrega digital ja aceita', code: 'PACKAGE_ALREADY_ACCEPTED' });
  });

  it('nao aceita tenantId no body', async () => {
    vi.mocked(getDb).mockReturnValue(createDb(buildIssuedRow()) as never);

    const response = await publicHandover.fetch(acceptRequest({
      ...validBody,
      tenantId: 'tenant-1',
    }), buildEnv());

    expect(response.status).toBe(422);
  });

  it('nao aceita acceptedAt no body', async () => {
    vi.mocked(getDb).mockReturnValue(createDb(buildIssuedRow()) as never);

    const response = await publicHandover.fetch(acceptRequest({
      ...validBody,
      acceptedAt: '2026-05-11T00:00:00.000Z',
    }), buildEnv());

    expect(response.status).toBe(422);
  });

  it('registra aceite no pacote sem alterar snapshot_json', async () => {
    const db = createDb(buildIssuedRow());
    vi.mocked(getDb).mockReturnValue(db as never);

    const response = await publicHandover.fetch(acceptRequest(validBody), buildEnv());
    const body = (await response.json()) as { package: { snapshot_json: typeof snapshot } };

    expect(response.status).toBe(200);
    expect(db.updateValues[0]).toMatchObject({
      status: 'accepted',
      acceptedByName: 'Maria Silva',
      acceptedByEmail: 'maria@exemplo.com',
      acceptanceNotes: 'Recebido em boas condicoes.',
    });
    expect(db.updateValues[0]).not.toHaveProperty('snapshotJson');
    expect(body.package.snapshot_json).toMatchObject(snapshot);
  });
});
