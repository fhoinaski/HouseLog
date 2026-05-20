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
import type { Bindings, Variables } from '../lib/types';
import { isUuidV4 } from '../lib/id';

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('../db/client', () => ({
  getDb: vi.fn(),
}));

vi.mock('../lib/jwt', () => ({
  resolveJwtSecret: vi.fn(() => 'test-secret-key-minimum-32-chars-ok'),
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
import propertiesRouter from '../routes/properties';

/** Wrap the rooms sub-router the same way the main app does so params resolve correctly. */
function buildRoomsApp() {
  const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();
  app.route('/properties/:propertyId/rooms', roomsRouter);
  return app;
}

function buildPropertiesApp() {
  const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();
  app.route('/properties', propertiesRouter);
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
  const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();
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
    expect(isUuidV4(String(insertedValues.id))).toBe(true);
  });
});

describe('POST /properties - novo imovel recebe UUID v4', () => {
  const insertValuesSpy = vi.fn(async () => undefined);

  beforeEach(() => {
    insertValuesSpy.mockClear();
  });

  it('gera id UUID v4 e usa tenantId do contexto autenticado', async () => {
    vi.mocked(getDb).mockReturnValue({
      select: vi.fn()
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            innerJoin: vi.fn(() => ({
              where: vi.fn(() => ({ limit: vi.fn(async () => [{ tenantId: 'tenant-a', role: 'owner' }]) })),
            })),
          })),
        })
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => [{
                id: 'prop-created',
                owner_id: 'user-1',
                manager_id: null,
                name: 'Casa',
                type: 'house',
                address: 'Rua A',
                city: 'Sao Paulo',
                area_m2: null,
                year_built: null,
                structure: null,
                floors: 1,
                cover_url: null,
                health_score: 100,
                created_at: new Date().toISOString(),
                deleted_at: null,
              }]),
            })),
          })),
        }),
      insert: vi.fn(() => ({ values: insertValuesSpy })),
    } as never);

    const res = await buildPropertiesApp().fetch(
      authedRequest('http://localhost/properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Casa',
          type: 'house',
          address: 'Rua A',
          city: 'Sao Paulo',
          floors: 1,
          tenantId: 'tenant-b',
        }),
      }),
      buildEnv()
    );

    expect(res.status).toBe(201);
    expect(insertValuesSpy).toHaveBeenCalledOnce();
    const [insertedValues] = insertValuesSpy.mock.calls[0] as unknown as [Record<string, unknown>];
    expect(insertedValues.tenantId).toBe('tenant-a');
    expect(isUuidV4(String(insertedValues.id))).toBe(true);
  });
});

// ── Testes: cross-tenant property read → 404 ────────────────────────────────

describe('GET/POST /properties/:propertyId/rooms — property de outro tenant retorna 404', () => {
  const insertValuesSpy = vi.fn(async () => undefined);

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
      insert: vi.fn(() => ({ values: insertValuesSpy })),
    };
  }

  beforeEach(() => {
    insertValuesSpy.mockClear();
  });

  it('retorna 404 quando property pertence a outro tenant', async () => {
    vi.mocked(getDb).mockReturnValue(buildCrossTenantDb('tenant-b') as never);

    const req = authedRequest('http://localhost/properties/prop-x/rooms');
    const res = await buildRoomsApp().fetch(req, buildEnv());

    expect(res.status).toBe(404);
  });

  it('retorna 404 quando property tem tenant_id NULL (registro legado)', async () => {
    vi.mocked(getDb).mockReturnValue(buildCrossTenantDb(null) as never);

    const req = authedRequest('http://localhost/properties/prop-legacy/rooms');
    const res = await buildRoomsApp().fetch(req, buildEnv());

    expect(res.status).toBe(404);
  });

  it('bloqueia POST e nao insere room quando property pertence a outro tenant', async () => {
    vi.mocked(getDb).mockReturnValue(buildCrossTenantDb('tenant-b') as never);

    const req = authedRequest('http://localhost/properties/prop-x/rooms', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'Sala', type: 'living' }),
    });
    const res = await buildRoomsApp().fetch(req, buildEnv());

    expect(res.status).toBe(404);
    expect(insertValuesSpy).not.toHaveBeenCalled();
  });
});

describe('PUT/DELETE /properties/:propertyId/rooms/:id - write scope estrito por property', () => {
  const updateWhereSpy = vi.fn(async (_whereExpression: unknown) => undefined);
  const updateSetSpy = vi.fn(() => ({ where: updateWhereSpy }));

  const oldRoom = {
    id: 'room-1',
    property_id: 'prop-1',
    name: 'Sala',
    type: 'living',
    floor: 0,
    area_m2: null,
    notes: null,
    created_at: '2026-05-16T00:00:00.000Z',
    deleted_at: null,
  };

  const updatedRoom = {
    ...oldRoom,
    name: 'Sala atualizada',
  };

  function limitedRows(rows: unknown[]) {
    return {
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => rows),
        })),
      })),
    };
  }

  function membershipRows() {
    return {
      from: vi.fn(() => ({
        innerJoin: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => [{ tenantId: 'tenant-a', role: 'owner' }]),
          })),
        })),
      })),
    };
  }

  function propertyRows(rows: unknown[]) {
    return limitedRows(rows);
  }

  function collaboratorRows() {
    return limitedRows([]);
  }

  function buildRoomsWriteDb(options: {
    propertyRows: unknown[];
    roomRows?: unknown[];
    updatedRows?: unknown[];
  }) {
    const select = vi.fn()
      .mockReturnValueOnce(membershipRows())
      .mockReturnValueOnce(propertyRows(options.propertyRows));

    if (options.propertyRows.length > 0) {
      select
        .mockReturnValueOnce(collaboratorRows())
        .mockReturnValueOnce(limitedRows(options.roomRows ?? []));

      if (options.updatedRows) {
        select.mockReturnValueOnce(limitedRows(options.updatedRows));
      }
    }

    return {
      select,
      update: vi.fn(() => ({ set: updateSetSpy })),
    };
  }

  function expressionTokens(value: unknown): string[] {
    if (value === null || typeof value !== 'object') return [];

    const record = value as Record<string, unknown>;
    const tokens: string[] = [];

    if (Array.isArray(record.queryChunks)) {
      for (const chunk of record.queryChunks) {
        tokens.push(...expressionTokens(chunk));
      }
    }

    if (typeof record.name === 'string' && typeof record.columnType === 'string') {
      tokens.push(record.name);
    }

    if (typeof record.value === 'string') {
      tokens.push(record.value);
    } else if (Array.isArray(record.value)) {
      tokens.push(...record.value.filter((item): item is string => typeof item === 'string'));
    }

    return tokens;
  }

  function expectRoomWriteScope(whereExpression: unknown) {
    expect(expressionTokens(whereExpression)).toEqual(
      expect.arrayContaining(['id', 'room-1', 'property_id', 'prop-1', 'tenant_id', 'tenant-a'])
    );
  }

  beforeEach(() => {
    updateWhereSpy.mockClear();
    updateSetSpy.mockClear();
  });

  it('PUT autorizado atualiza usando id + propertyId + tenantId', async () => {
    vi.mocked(getDb).mockReturnValue(buildRoomsWriteDb({
      propertyRows: [{ tenantId: 'tenant-a', ownerId: 'user-1', managerId: null }],
      roomRows: [oldRoom],
      updatedRows: [updatedRoom],
    }) as never);

    const res = await buildRoomsApp().fetch(
      authedRequest('http://localhost/properties/prop-1/rooms/room-1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Sala atualizada' }),
      }),
      buildEnv()
    );

    expect(res.status).toBe(200);
    expect(updateSetSpy).toHaveBeenCalledWith({ name: 'Sala atualizada' });
    expect(updateWhereSpy).toHaveBeenCalledOnce();
    expectRoomWriteScope(updateWhereSpy.mock.calls[0]?.[0]);
  });

  it('PUT cross-property retorna 404 e nao executa update', async () => {
    vi.mocked(getDb).mockReturnValue(buildRoomsWriteDb({
      propertyRows: [{ tenantId: 'tenant-a', ownerId: 'user-1', managerId: null }],
      roomRows: [],
    }) as never);

    const res = await buildRoomsApp().fetch(
      authedRequest('http://localhost/properties/prop-1/rooms/room-2', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Sala atualizada' }),
      }),
      buildEnv()
    );

    expect(res.status).toBe(404);
    expect(updateSetSpy).not.toHaveBeenCalled();
    expect(updateWhereSpy).not.toHaveBeenCalled();
  });

  it('DELETE autorizado remove usando id + propertyId + tenantId', async () => {
    vi.mocked(getDb).mockReturnValue(buildRoomsWriteDb({
      propertyRows: [{ tenantId: 'tenant-a', ownerId: 'user-1', managerId: null }],
      roomRows: [oldRoom],
    }) as never);

    const res = await buildRoomsApp().fetch(
      authedRequest('http://localhost/properties/prop-1/rooms/room-1', {
        method: 'DELETE',
      }),
      buildEnv()
    );

    expect(res.status).toBe(200);
    expect(updateSetSpy).toHaveBeenCalledWith({ deletedAt: expect.any(String) });
    expect(updateWhereSpy).toHaveBeenCalledOnce();
    expectRoomWriteScope(updateWhereSpy.mock.calls[0]?.[0]);
  });

  it('DELETE cross-property retorna 404 e nao executa update', async () => {
    vi.mocked(getDb).mockReturnValue(buildRoomsWriteDb({
      propertyRows: [{ tenantId: 'tenant-a', ownerId: 'user-1', managerId: null }],
      roomRows: [],
    }) as never);

    const res = await buildRoomsApp().fetch(
      authedRequest('http://localhost/properties/prop-1/rooms/room-2', {
        method: 'DELETE',
      }),
      buildEnv()
    );

    expect(res.status).toBe(404);
    expect(updateSetSpy).not.toHaveBeenCalled();
    expect(updateWhereSpy).not.toHaveBeenCalled();
  });

  it('PUT e DELETE cross-tenant continuam bloqueados antes do update', async () => {
    for (const method of ['PUT', 'DELETE']) {
      updateWhereSpy.mockClear();
      updateSetSpy.mockClear();
      vi.mocked(getDb).mockReturnValue(buildRoomsWriteDb({ propertyRows: [] }) as never);

      const res = await buildRoomsApp().fetch(
        authedRequest('http://localhost/properties/prop-x/rooms/room-1', {
          method,
          headers: method === 'PUT' ? { 'Content-Type': 'application/json' } : undefined,
          body: method === 'PUT' ? JSON.stringify({ name: 'Sala atualizada' }) : undefined,
        }),
        buildEnv()
      );

      expect(res.status).toBe(404);
      expect(updateSetSpy).not.toHaveBeenCalled();
      expect(updateWhereSpy).not.toHaveBeenCalled();
    }
  });
});
