import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import handoverPackagesRoute from './handover-packages';
import { getDb } from '../db/client';
import { writeAuditLog } from '../lib/audit';

const authState = vi.hoisted(() => ({
  userId: 'user-1',
  userRole: 'owner',
  tenantId: 'tenant-1',
  tenantRole: 'owner',
  propertyAccess: true,
}));

vi.mock('../db/client', () => ({
  getDb: vi.fn(),
}));

vi.mock('../lib/audit', () => ({
  writeAuditLog: vi.fn(async () => undefined),
}));

vi.mock('../middleware/auth', () => ({
  authMiddleware: async (
    c: { set: (key: string, value: string) => void },
    next: () => Promise<void>
  ) => {
    c.set('userId', authState.userId);
    c.set('userRole', authState.userRole);
    await next();
  },
  resolveTenant: async (
    c: { set: (key: string, value: string) => void },
    next: () => Promise<void>
  ) => {
    c.set('tenantId', authState.tenantId);
    c.set('tenantRole', authState.tenantRole);
    await next();
  },
  assertPropertyAccess: vi.fn(async () => authState.propertyAccess),
}));

type PackageRow = {
  id: string;
  tenant_id: string;
  property_id: string;
  title: string;
  description: string | null;
  type: 'handover';
  status: 'issued' | 'accepted' | 'revoked' | 'draft';
  version: number;
  prepared_by: string;
  reviewed_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  completed_at: string | null;
  summary_document_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
  issued_at: string | null;
  issued_by: string | null;
  accepted_at: string | null;
  accepted_by_name: string | null;
  accepted_by_email: string | null;
  revoked_at: string | null;
  revoked_by: string | null;
  revoke_reason: string | null;
  expires_at: string | null;
  public_access_token_hash: string | null;
  snapshot_json: Record<string, unknown> | null;
  package_hash: string | null;
};

type RevokeDb = {
  updateValues: Array<Record<string, unknown>>;
  select: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
};

const basePackage: PackageRow = {
  id: 'package-1',
  tenant_id: 'tenant-1',
  property_id: 'property-1',
  title: 'Dossie de entrega',
  description: null,
  type: 'handover',
  status: 'issued',
  version: 1,
  prepared_by: 'user-1',
  reviewed_by: null,
  approved_by: null,
  approved_at: null,
  completed_at: null,
  summary_document_id: null,
  notes: null,
  created_at: '2026-05-09T10:00:00.000Z',
  updated_at: null,
  deleted_at: null,
  issued_at: '2026-05-09T10:05:00.000Z',
  issued_by: 'user-1',
  accepted_at: null,
  accepted_by_name: null,
  accepted_by_email: null,
  revoked_at: null,
  revoked_by: null,
  revoke_reason: null,
  expires_at: '2026-06-09T10:05:00.000Z',
  public_access_token_hash: 'raw-token-hash',
  snapshot_json: { generatedAt: '2026-05-09T10:00:00.000Z' },
  package_hash: 'raw-package-hash',
};

function buildEnv() {
  return { DB: {}, APP_URL: 'https://app.houselog.local' };
}

function buildApp() {
  const app = new Hono();
  app.route('/properties/:propertyId/handover-packages', handoverPackagesRoute);
  return app;
}

function createDb(input: {
  propertyExists?: boolean;
  packageRow?: PackageRow | null;
  propertyOwnerId?: string;
  propertyManagerId?: string | null;
}): RevokeDb {
  const updateValues: Array<Record<string, unknown>> = [];
  const packageRow = input.packageRow === undefined ? basePackage : input.packageRow;
  const revokedPackage = packageRow
    ? {
        ...packageRow,
        status: 'revoked' as const,
        revoked_at: '2026-05-11T10:00:00.000Z',
        revoked_by: 'user-1',
        revoke_reason: 'Erro no pacote emitido',
        updated_at: '2026-05-11T10:00:00.000Z',
      }
    : null;
  const selectResponses: unknown[][] = [
    input.propertyExists === false ? [] : [{ id: 'property-1' }],
    [{ id: 'property-1', ownerId: input.propertyOwnerId ?? 'user-1', managerId: input.propertyManagerId ?? null }],
    packageRow ? [packageRow] : [],
    revokedPackage ? [revokedPackage] : [],
  ];

  const db: RevokeDb = {
    updateValues,
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => selectResponses.shift() ?? []),
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn((values: Record<string, unknown>) => {
        updateValues.push(values);
        return {
          where: vi.fn(async () => undefined),
        };
      }),
    })),
  };
  return db;
}

function revokeRequest() {
  return new Request('http://localhost/properties/property-1/handover-packages/package-1/revoke', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'CF-Connecting-IP': '203.0.113.20',
    },
    body: JSON.stringify({ revokeReason: 'Erro no pacote emitido' }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  authState.userId = 'user-1';
  authState.userRole = 'owner';
  authState.tenantId = 'tenant-1';
  authState.tenantRole = 'owner';
  authState.propertyAccess = true;
});

describe('POST /properties/:propertyId/handover-packages/:packageId/revoke', () => {
  it('revoga pacote issued', async () => {
    const db = createDb({});
    vi.mocked(getDb).mockReturnValue(db as never);

    const response = await buildApp().fetch(revokeRequest(), buildEnv());
    const body = (await response.json()) as { package: PackageRow };

    expect(response.status).toBe(200);
    expect(body.package.status).toBe('revoked');
    expect(db.updateValues[0]).toMatchObject({
      status: 'revoked',
      revokedBy: 'user-1',
      revokeReason: 'Erro no pacote emitido',
    });
  });

  it('revoga pacote accepted', async () => {
    const db = createDb({
      packageRow: {
        ...basePackage,
        status: 'accepted',
        accepted_at: '2026-05-10T10:00:00.000Z',
      },
    });
    vi.mocked(getDb).mockReturnValue(db as never);

    const response = await buildApp().fetch(revokeRequest(), buildEnv());

    expect(response.status).toBe(200);
    expect(db.updateValues[0]?.status).toBe('revoked');
  });

  it('bloqueia pacote de outro tenant', async () => {
    const db = createDb({ propertyExists: false });
    vi.mocked(getDb).mockReturnValue(db as never);

    const response = await buildApp().fetch(revokeRequest(), buildEnv());

    expect(response.status).toBe(404);
    expect(db.updateValues).toHaveLength(0);
  });

  it('bloqueia pacote de outro property', async () => {
    const db = createDb({ packageRow: null });
    vi.mocked(getDb).mockReturnValue(db as never);

    const response = await buildApp().fetch(revokeRequest(), buildEnv());

    expect(response.status).toBe(404);
    expect(db.updateValues).toHaveLength(0);
  });

  it('bloqueia usuario sem permissao', async () => {
    authState.userId = 'provider-1';
    authState.userRole = 'provider';
    authState.tenantRole = 'provider';
    const db = createDb({ propertyOwnerId: 'owner-1', propertyManagerId: 'manager-1' });
    vi.mocked(getDb).mockReturnValue(db as never);

    const response = await buildApp().fetch(revokeRequest(), buildEnv());
    const body = (await response.json()) as { code: string };

    expect(response.status).toBe(403);
    expect(body.code).toBe('FORBIDDEN');
    expect(db.updateValues).toHaveLength(0);
  });

  it('bloqueia pacote ja revogado', async () => {
    const db = createDb({
      packageRow: {
        ...basePackage,
        status: 'revoked',
        revoked_at: '2026-05-10T10:00:00.000Z',
      },
    });
    vi.mocked(getDb).mockReturnValue(db as never);

    const response = await buildApp().fetch(revokeRequest(), buildEnv());
    const body = (await response.json()) as { code: string };

    expect(response.status).toBe(409);
    expect(body.code).toBe('CONFLICT');
    expect(db.updateValues).toHaveLength(0);
  });

  it('salva dados de revogacao e registra audit log sem hashes', async () => {
    const db = createDb({});
    vi.mocked(getDb).mockReturnValue(db as never);

    const response = await buildApp().fetch(revokeRequest(), buildEnv());

    expect(response.status).toBe(200);
    expect(db.updateValues[0]).toMatchObject({
      status: 'revoked',
      revokedBy: 'user-1',
      revokeReason: 'Erro no pacote emitido',
    });
    expect(db.updateValues[0]?.revokedAt).toEqual(expect.any(String));
    expect(writeAuditLog).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      tenantId: 'tenant-1',
      propertyId: 'property-1',
      entityType: 'handover_package',
      entityId: 'package-1',
      action: 'handover_package_revoked',
      actorId: 'user-1',
      actorIp: '203.0.113.20',
    }));
    const auditPayload = JSON.stringify(vi.mocked(writeAuditLog).mock.calls);
    expect(auditPayload).not.toContain('raw-token-hash');
    expect(auditPayload).not.toContain('raw-package-hash');
    expect(auditPayload).not.toContain('public_access_token_hash');
    expect(auditPayload).not.toContain('package_hash');
  });
});
