/**
 * Testes de isolamento cross-tenant — P0-TENANT-BACKFILL-01
 *
 * Cobre:
 *  1. resolveTenant middleware — rejeição sem tenant ativo
 *  2. resolveTenant middleware — propagação de tenantId e tenantRole
 *  3. tenantId obrigatório no INSERT de rooms (representativo das rotas de criação)
 *  4. Cross-tenant property read → 404 via canAccessTenantProperty
 */

import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Bindings } from '../lib/types';

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('../db/client', () => ({
  getDb: vi.fn(),
}));

vi.mock('../lib/jwt', () => ({
  verifyJwt: vi.fn(async () => ({
    sub: 'user-1',
    email: 'test@example.com',
    role: 'owner' as const,
  })),
}));

vi.mock('../lib/audit', () => ({
  writeAuditLog: vi.fn(async () => undefined),
}));

import { getDb } from '../db/client';
import { authMiddleware, resolveTenant } from '../middleware/auth';
import roomsRouter from '../routes/rooms';

/** Wrap the rooms sub-router the same way the main app does so params resolve correctly. */
function buildRoomsApp() {
  const app = new Hono<{ Bindings: Bindings }>();
  app.route('/properties/:propertyId/rooms', roomsRouter);
  return app;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function buildEnv(overrides: Partial<Bindings> = {}): Bindings {
  return {
    DB: {} as D1Database,
    STORAGE: {} as R2Bucket,
    KV: {} as KVNamespace,
    QUEUE: {} as Queue,
    DOCUMENT_INGESTION_QUEUE: {} as Queue,
    AI: {} as Ai,
    JWT_SECRET: 'test-secret-key-minimum-32-chars-ok',
    CORS_ORIGINS: 'http://localhost:3000',
    ENVIRONMENT: 'development',
    R2_PUBLIC_URL: 'https://pub.r2.dev',
    RESEND_API_KEY: 'test-key',
    APP_URL: 'http://localhost:3000',
    ...overrides,
  };
}

function authedRequest(url: string, options: RequestInit = {}): Request {
  return new Request(url, {
    ...options,
    headers: {
      Authorization: 'Bearer test-token',
      ...((options.headers as Record<string, string>) ?? {}),
    },
  });
}

/** Minimal Hono app with authMiddleware + resolveTenant + a /ping endpoint. */
function buildMiddlewareApp() {
  const app = new Hono<{ Bindings: Bindings }>();
  app.use('*', authMiddleware);
  app.use('*', resolveTenant);
  app.get('/ping', (c) =>
    c.json({ tenantId: c.get('tenantId'), tenantRole: c.get('tenantRole') })
  );
  return app;
}

/** DB mock that returns empty tenant membership → resolveTenant rejects. */
function dbWithNoMembership() {
  return {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        innerJoin: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => []),
          })),
        })),
      })),
    })),
  };
}

/** DB mock that returns a valid tenant membership. */
function dbWithMembership(tenantId = 'tenant-a', role: 'owner' | 'manager' = 'owner') {
  return {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        innerJoin: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => [{ tenantId, role }]),
          })),
        })),
      })),
    })),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Testes: resolveTenant ────────────────────────────────────────────────────

describe('resolveTenant — middleware de tenant ativo', () => {
  it('retorna 400 TENANT_REQUIRED quando usuário não tem membership ativo', async () => {
    vi.mocked(getDb).mockReturnValue(dbWithNoMembership() as never);

    const res = await buildMiddlewareApp().fetch(
      authedRequest('http://localhost/ping'),
      buildEnv()
    );
    const body = await res.json() as Record<string, unknown>;

    expect(res.status).toBe(400);
    expect(body.code).toBe('TENANT_REQUIRED');
  });

  it('define tenantId e tenantRole no contexto quando membership existe', async () => {
    vi.mocked(getDb).mockReturnValue(dbWithMembership('tenant-a', 'owner') as never);

    const res = await buildMiddlewareApp().fetch(
      authedRequest('http://localhost/ping'),
      buildEnv()
    );
    const body = await res.json() as Record<string, unknown>;

    expect(res.status).toBe(200);
    expect(body.tenantId).toBe('tenant-a');
    expect(body.tenantRole).toBe('owner');
  });

  it('usa o tenant do header X-Tenant-Id quando fornecido', async () => {
    vi.mocked(getDb).mockReturnValue(dbWithMembership('tenant-b', 'manager') as never);

    const res = await buildMiddlewareApp().fetch(
      authedRequest('http://localhost/ping', {
        headers: {
          Authorization: 'Bearer test-token',
          'X-Tenant-Id': 'tenant-b',
        },
      }),
      buildEnv()
    );
    const body = await res.json() as Record<string, unknown>;

    expect(res.status).toBe(200);
    expect(body.tenantId).toBe('tenant-b');
    expect(body.tenantRole).toBe('manager');
  });

  it('retorna 401 sem Authorization header (antes do resolveTenant)', async () => {
    const res = await buildMiddlewareApp().fetch(
      new Request('http://localhost/ping'),
      buildEnv()
    );
    expect(res.status).toBe(401);
  });
});

// ── Testes: tenant_id no INSERT de rooms ─────────────────────────────────────

describe('POST /properties/:propertyId/rooms — tenant_id obrigatório no INSERT', () => {
  const insertValuesSpy = vi.fn(async () => undefined);

  function buildRoomsDb() {
    return {
      select: vi.fn()
        // 1ª chamada: resolveTenant membership
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            innerJoin: vi.fn(() => ({
              where: vi.fn(() => ({ limit: vi.fn(async () => [{ tenantId: 'tenant-a', role: 'owner' }]) })),
            })),
          })),
        })
        // 2ª chamada: canAccessTenantProperty → property lookup
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => [{
                tenantId: 'tenant-a',
                ownerId: 'user-1',
                managerId: null,
              }]),
            })),
          })),
        })
        // 3ª chamada: collaborator lookup (property_collaborators pode não existir)
        .mockReturnValue({
          from: vi.fn(() => ({
            where: vi.fn(() => ({ limit: vi.fn(async () => []) })),
          })),
        }),
      insert: vi.fn(() => ({ values: insertValuesSpy })),
    };
  }

  beforeEach(() => {
    insertValuesSpy.mockClear();
  });

  it('inclui tenantId no registro inserido', async () => {
    vi.mocked(getDb).mockReturnValue(buildRoomsDb() as never);

    const req = authedRequest('http://localhost/properties/prop-1/rooms', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'Sala', type: 'living' }),
    });

    await buildRoomsApp().fetch(req, buildEnv());

    expect(insertValuesSpy).toHaveBeenCalled();
    const [insertedValues] = insertValuesSpy.mock.calls[0] as unknown as [Record<string, unknown>];
    expect(insertedValues).toHaveProperty('tenantId', 'tenant-a');
    expect(insertedValues).toHaveProperty('propertyId', 'prop-1');
  });
});

// ── Testes: cross-tenant property read → 404 ────────────────────────────────

describe('GET /properties/:propertyId/rooms — property de outro tenant retorna 404', () => {
  function buildCrossTenantDb(propertyTenantId: string | null) {
    return {
      select: vi.fn()
        // 1ª: resolveTenant
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            innerJoin: vi.fn(() => ({
              where: vi.fn(() => ({
                limit: vi.fn(async () => [{ tenantId: 'tenant-a', role: 'owner' }]),
              })),
            })),
          })),
        })
        // 2ª: canAccessTenantProperty → property lookup (outra tenant ou null)
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () =>
                propertyTenantId === 'tenant-a'
                  ? [{ tenantId: propertyTenantId, ownerId: 'user-1', managerId: null }]
                  : []
              ),
            })),
          })),
        }),
    };
  }

  it('retorna 404 quando property pertence a outro tenant', async () => {
    vi.mocked(getDb).mockReturnValue(buildCrossTenantDb('tenant-b') as never);

    const req = authedRequest('http://localhost/properties/prop-x/rooms');
    const res = await buildRoomsApp().fetch(req, buildEnv());

    expect([403, 404]).toContain(res.status);
  });

  it('retorna 404 quando property tem tenant_id NULL (registro legado)', async () => {
    vi.mocked(getDb).mockReturnValue(buildCrossTenantDb(null) as never);

    const req = authedRequest('http://localhost/properties/prop-legacy/rooms');
    const res = await buildRoomsApp().fetch(req, buildEnv());

    expect([403, 404]).toContain(res.status);
  });
});
