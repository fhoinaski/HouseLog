import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Bindings } from '../lib/types';

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

vi.mock('../lib/handover-issue', () => ({
  buildHandoverPackageHash: vi.fn(async () => 'raw-package-hash'),
  buildHandoverPackageSnapshot: vi.fn(() => ({ generatedAt: '2026-05-15T12:00:00.000Z' })),
  buildPublicAccessUrl: vi.fn((_appUrl: string, token: string) => `http://localhost/handover/${token}`),
  canIssueHandoverPackage: vi.fn(() => ({ allowed: true })),
  canRevokeHandoverPackage: vi.fn(() => ({ allowed: true })),
  generatePublicAccessToken: vi.fn(async () => ({
    token: 'raw-public-token',
    tokenHash: 'raw-token-hash',
  })),
}));

import { getDb } from '../db/client';
import { writeAuditLog } from '../lib/audit';
import handoverPackagesRoute from './handover-packages';

type PackageRow = {
  id: string;
  tenant_id: string;
  property_id: string;
  title: string;
  description: string | null;
  type: 'handover';
  status: 'ready_to_issue' | 'issued';
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

const basePackage: PackageRow = {
  id: 'package-1',
  tenant_id: 'tenant-1',
  property_id: 'property-1',
  title: 'Dossie de entrega',
  description: null,
  type: 'handover',
  status: 'ready_to_issue',
  version: 1,
  prepared_by: 'user-1',
  reviewed_by: null,
  approved_by: null,
  approved_at: null,
  completed_at: null,
  summary_document_id: null,
  notes: null,
  created_at: '2026-05-15T10:00:00.000Z',
  updated_at: null,
  deleted_at: null,
  issued_at: null,
  issued_by: null,
  accepted_at: null,
  accepted_by_name: null,
  accepted_by_email: null,
  revoked_at: null,
  revoked_by: null,
  revoke_reason: null,
  expires_at: null,
  public_access_token_hash: null,
  snapshot_json: null,
  package_hash: null,
};

function buildEnv(): Bindings {
  return {
    DB: {} as D1Database,
    STORAGE: {} as R2Bucket,
    KV: {} as KVNamespace,
    QUEUE: {} as Queue,
    DOCUMENT_INGESTION_QUEUE: {} as Queue,
    AI: {} as Ai,
    JWT_SECRET: 'test-secret-key-minimum-32-chars-ok',
    CORS_ORIGINS: 'http://localhost:3000',
    ENVIRONMENT: 'test',
    R2_PUBLIC_URL: 'https://assets.example.com',
    RESEND_API_KEY: 'test-key',
    APP_URL: 'http://localhost',
  };
}

function buildApp() {
  const app = new Hono<{ Bindings: Bindings }>();
  app.route('/properties/:propertyId/handover-packages', handoverPackagesRoute);
  return app;
}

function makeDb() {
  const issuedPackage: PackageRow = {
    ...basePackage,
    status: 'issued',
    issued_at: '2026-05-15T12:00:00.000Z',
    issued_by: 'user-1',
    expires_at: '2026-06-15T12:00:00.000Z',
    public_access_token_hash: 'raw-token-hash',
    package_hash: 'raw-package-hash',
    snapshot_json: { generatedAt: '2026-05-15T12:00:00.000Z' },
  };
  const property = {
    id: 'property-1',
    name: 'Apartamento Jardim',
    type: 'apt',
    address: 'Rua A',
    city: 'Sao Paulo',
    areaM2: 120,
    yearBuilt: 2020,
    structure: 'alvenaria',
    floors: 1,
    healthScore: 90,
    ownerId: 'user-1',
    managerId: null,
  };
  const selectResponses: unknown[][] = [
    [{ id: 'property-1' }],
    [{ id: 'property-1', ownerId: 'user-1', managerId: null }],
    [basePackage],
    [property],
    [basePackage],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [issuedPackage],
  ];

  return {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => selectResponses.shift() ?? []),
          orderBy: vi.fn(async () => selectResponses.shift() ?? []),
        })),
        orderBy: vi.fn(async () => selectResponses.shift() ?? []),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(async () => undefined),
      })),
    })),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /properties/:propertyId/handover-packages/:id/issue audit', () => {
  it('cria link publico e registra audit log sem token ou hash', async () => {
    vi.mocked(getDb).mockReturnValue(makeDb() as never);

    const res = await buildApp().fetch(
      new Request('http://localhost/properties/property-1/handover-packages/package-1/issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.30' },
        body: JSON.stringify({ expires_at: '2026-06-15T12:00:00.000Z' }),
      }),
      buildEnv()
    );

    expect(res.status).toBe(200);
    expect(vi.mocked(writeAuditLog)).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        tenantId: 'tenant-1',
        propertyId: 'property-1',
        entityType: 'handover_package',
        entityId: 'package-1',
        action: 'handover_package_issued',
        actorId: 'user-1',
        actorIp: '203.0.113.30',
      })
    );
    const [, opts] = vi.mocked(writeAuditLog).mock.calls[0]!;
    expect(opts.newData).toMatchObject({
      public_link_created: true,
      status: 'issued',
    });
    const auditPayload = JSON.stringify(opts);
    expect(auditPayload).not.toContain('raw-public-token');
    expect(auditPayload).not.toContain('raw-token-hash');
    expect(auditPayload).not.toContain('raw-package-hash');
    expect(auditPayload).not.toContain('public_access_token_hash');
    expect(auditPayload).not.toContain('package_hash');
  });
});
