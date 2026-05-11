import { describe, expect, it, vi } from 'vitest';
import publicHandover from './public-handover';
import { getDb } from '../db/client';
import type { Bindings } from '../lib/types';

vi.mock('../db/client', () => ({
  getDb: vi.fn(),
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
  property_id: string;
  title: string;
  description: string | null;
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
  return {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => (row ? [row] : [])),
        })),
      })),
    })),
  };
}

function buildEnv() {
  return {
    DB: {} as D1Database,
  } as Bindings;
}

describe('GET /public/handover/:token', () => {
  it('retorna pacote público válido sem expor campos internos', async () => {
    const row: PublicHandoverRow = {
      id: 'package-1',
      property_id: 'property-1',
      title: 'Dossie de entrega',
      description: 'Entrega final da unidade',
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

    expect(response.status).toBe(404);
  });

  it('bloqueia pacote revogado', async () => {
    vi.mocked(getDb).mockReturnValue(
      createDb({
        id: 'package-1',
        property_id: 'property-1',
        title: 'Dossie de entrega',
        description: null,
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

    expect(response.status).toBe(404);
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