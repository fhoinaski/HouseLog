import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Bindings, Role, TenantRole } from '../lib/types';

vi.mock('../db/client', () => ({
  getDb: vi.fn(),
}));

vi.mock('../lib/audit', () => ({
  writeAuditLog: vi.fn(async () => undefined),
}));

vi.mock('../middleware/auth', () => ({
  authMiddleware: async (c: { set: (key: string, value: string) => void }, next: () => Promise<void>) => {
    c.set('userId', 'user-1');
    c.set('userRole', 'owner');
    await next();
  },
  resolveTenant: async (c: { set: (key: string, value: string) => void }, next: () => Promise<void>) => {
    c.set('tenantId', 'tenant-a');
    c.set('tenantRole', 'owner');
    await next();
  },
  assertPropertyAccess: vi.fn(
    async (
      _db: D1Database,
      _propertyId: string,
      _userId: string,
      _role: Role,
      _tenantId?: string | null,
      _tenantRole?: TenantRole | null
    ) => true
  ),
}));

import { getDb } from '../db/client';
import renovationsRoute from './renovations';

type JsonObject = Record<string, unknown>;
type WhereSpy = ReturnType<typeof vi.fn<(condition: unknown) => void>>;

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

function buildApp() {
  const app = new Hono<{ Bindings: Bindings }>();
  app.route('/properties/:propertyId/renovations', renovationsRoute);
  return app;
}

function request(path: string, body: JsonObject, method: 'POST' | 'PUT' = 'POST') {
  return new Request(`http://localhost${path}`, {
    method,
    headers: {
      Authorization: 'Bearer test-token',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

function renovationPayload(overrides: JsonObject = {}): JsonObject {
  return {
    title: 'Reforma cozinha',
    category: 'finishing',
    status: 'planned',
    before_photos: [],
    after_photos: [],
    ...overrides,
  };
}

function renovationRow(overrides: JsonObject = {}): JsonObject {
  return {
    id: 'renovation-1',
    tenant_id: 'tenant-a',
    property_id: 'prop-1',
    room_id: null,
    service_order_id: null,
    document_id: null,
    title: 'Reforma cozinha',
    description: null,
    category: 'finishing',
    status: 'planned',
    started_at: null,
    completed_at: null,
    contractor_name: null,
    contractor_id: null,
    cost: null,
    notes: null,
    before_photos: [],
    after_photos: [],
    created_by: 'user-1',
    created_at: '2026-05-17T00:00:00.000Z',
    updated_at: null,
    deleted_at: null,
    ...overrides,
  };
}

function selectRows(rows: JsonObject[], whereSpy?: WhereSpy) {
  const terminal = {
    limit: vi.fn(async () => rows),
  };
  return {
    from: vi.fn(() => ({
      where: vi.fn((condition: unknown) => {
        whereSpy?.(condition);
        return terminal;
      }),
    })),
  };
}

function collectConditionText(value: unknown, seen = new Set<unknown>()): string[] {
  if (value === null || value === undefined) return [];
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return [String(value)];
  if (typeof value !== 'object') return [];
  if (seen.has(value)) return [];
  seen.add(value);

  const record = value as Record<string, unknown>;
  const parts: string[] = [];
  const name = record.name;
  if (typeof name === 'string') parts.push(name);

  const config = record.config;
  if (config && typeof config === 'object') {
    const configName = (config as Record<string, unknown>).name;
    if (typeof configName === 'string') parts.push(configName);
  }

  const paramValue = record.value;
  if (typeof paramValue === 'string' || typeof paramValue === 'number' || typeof paramValue === 'boolean') {
    parts.push(String(paramValue));
  }
  if (Array.isArray(paramValue)) {
    parts.push(...paramValue.flatMap((item) => collectConditionText(item, seen)));
  }

  const queryChunks = record.queryChunks;
  if (Array.isArray(queryChunks)) {
    parts.push(...queryChunks.flatMap((item) => collectConditionText(item, seen)));
  }

  return parts;
}

function expectScopedReferenceQuery(whereSpy: WhereSpy, referenceId: string) {
  expect(whereSpy).toHaveBeenCalledTimes(1);
  const firstCall = whereSpy.mock.calls[0];
  expect(firstCall).toBeDefined();
  const [condition] = firstCall!;
  const conditionText = collectConditionText(condition);
  expect(conditionText).toContain('id');
  expect(conditionText).toContain(referenceId);
  expect(conditionText).toContain('tenant_id');
  expect(conditionText).toContain('tenant-a');
  expect(conditionText).toContain('property_id');
  expect(conditionText).toContain('prop-1');
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('renovations reference tenant/property scope', () => {
  it('cria reforma com referencia autorizada', async () => {
    const referenceWhereSpy = vi.fn<(condition: unknown) => void>();
    const insertValuesSpy = vi.fn(async () => undefined);

    vi.mocked(getDb).mockReturnValue({
      select: vi.fn()
        .mockReturnValueOnce(selectRows([{ id: 'prop-1' }]))
        .mockReturnValueOnce(selectRows([{ tenantId: 'tenant-a', propertyId: 'prop-1' }], referenceWhereSpy))
        .mockReturnValueOnce(selectRows([renovationRow({ room_id: 'room-1' })])),
      insert: vi.fn(() => ({ values: insertValuesSpy })),
    } as never);

    const res = await buildApp().fetch(
      request('/properties/prop-1/renovations', renovationPayload({ room_id: 'room-1' })),
      buildEnv()
    );

    expect(res.status).toBe(201);
    expect(insertValuesSpy).toHaveBeenCalledTimes(1);
    expectScopedReferenceQuery(referenceWhereSpy, 'room-1');
  });

  it('bloqueia referencia de outro tenant no primeiro SELECT', async () => {
    const referenceWhereSpy = vi.fn<(condition: unknown) => void>();
    const insertSpy = vi.fn();

    vi.mocked(getDb).mockReturnValue({
      select: vi.fn()
        .mockReturnValueOnce(selectRows([{ id: 'prop-1' }]))
        .mockReturnValueOnce(selectRows([], referenceWhereSpy)),
      insert: insertSpy,
    } as never);

    const res = await buildApp().fetch(
      request('/properties/prop-1/renovations', renovationPayload({ room_id: 'room-tenant-b' })),
      buildEnv()
    );
    const body = await res.json() as JsonObject;

    expect(res.status).toBe(422);
    expect(body.code).toBe('REFERENCE_NOT_IN_PROPERTY');
    expect(insertSpy).not.toHaveBeenCalled();
    expectScopedReferenceQuery(referenceWhereSpy, 'room-tenant-b');
  });

  it('bloqueia referencia de outro imovel no mesmo tenant no primeiro SELECT', async () => {
    const referenceWhereSpy = vi.fn<(condition: unknown) => void>();
    const insertSpy = vi.fn();

    vi.mocked(getDb).mockReturnValue({
      select: vi.fn()
        .mockReturnValueOnce(selectRows([{ id: 'prop-1' }]))
        .mockReturnValueOnce(selectRows([], referenceWhereSpy)),
      insert: insertSpy,
    } as never);

    const res = await buildApp().fetch(
      request('/properties/prop-1/renovations', renovationPayload({ service_order_id: 'service-prop-2' })),
      buildEnv()
    );
    const body = await res.json() as JsonObject;

    expect(res.status).toBe(422);
    expect(body.code).toBe('REFERENCE_NOT_IN_PROPERTY');
    expect(insertSpy).not.toHaveBeenCalled();
    expectScopedReferenceQuery(referenceWhereSpy, 'service-prop-2');
  });

  it('bloqueia referencia inexistente sem criar reforma', async () => {
    const referenceWhereSpy = vi.fn<(condition: unknown) => void>();
    const insertSpy = vi.fn();

    vi.mocked(getDb).mockReturnValue({
      select: vi.fn()
        .mockReturnValueOnce(selectRows([{ id: 'prop-1' }]))
        .mockReturnValueOnce(selectRows([], referenceWhereSpy)),
      insert: insertSpy,
    } as never);

    const res = await buildApp().fetch(
      request('/properties/prop-1/renovations', renovationPayload({ document_id: 'missing-document' })),
      buildEnv()
    );
    const body = await res.json() as JsonObject;

    expect(res.status).toBe(422);
    expect(body.code).toBe('REFERENCE_NOT_IN_PROPERTY');
    expect(insertSpy).not.toHaveBeenCalled();
    expectScopedReferenceQuery(referenceWhereSpy, 'missing-document');
  });

  it('bloqueia update com referencia invalida sem atualizar reforma', async () => {
    const referenceWhereSpy = vi.fn<(condition: unknown) => void>();
    const updateSpy = vi.fn();

    vi.mocked(getDb).mockReturnValue({
      select: vi.fn()
        .mockReturnValueOnce(selectRows([{ id: 'prop-1' }]))
        .mockReturnValueOnce(selectRows([renovationRow()]))
        .mockReturnValueOnce(selectRows([], referenceWhereSpy)),
      update: updateSpy,
    } as never);

    const res = await buildApp().fetch(
      request('/properties/prop-1/renovations/renovation-1', renovationPayload({ room_id: 'missing-room' }), 'PUT'),
      buildEnv()
    );
    const body = await res.json() as JsonObject;

    expect(res.status).toBe(422);
    expect(body.code).toBe('REFERENCE_NOT_IN_PROPERTY');
    expect(updateSpy).not.toHaveBeenCalled();
    expectScopedReferenceQuery(referenceWhereSpy, 'missing-room');
  });
});
