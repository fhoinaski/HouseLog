import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Bindings } from '../lib/types';

vi.mock('../db/client', () => ({ getDb: vi.fn() }));
vi.mock('../lib/audit', () => ({ writeAuditLog: vi.fn(async () => undefined) }));
vi.mock('../lib/r2', () => ({
  preparePrivateUpload: vi.fn(async (file: File) => ({
    ok: true,
    buffer: await file.arrayBuffer(),
    mimeType: file.type,
    size: file.size,
  })),
  buildR2Key: vi.fn(() => 'prop-a/inventory/item-photo.jpg'),
  uploadToR2: vi.fn(async () => undefined),
  extractR2KeyFromPublicUrl: vi.fn((url: string) => url),
}));
vi.mock('../lib/jwt', () => ({
  resolveJwtSecret: vi.fn(() => 'test-secret-key-minimum-32-chars-ok'),
  verifyJwt: vi.fn(async () => ({
    sub: 'user-1',
    email: 'test@example.com',
    role: 'owner' as const,
  })),
}));
vi.mock('../lib/ai', () => ({
  extractLabelData: vi.fn(),
  diagnoseImage: vi.fn(),
  transcribeAudio: vi.fn(),
  classifyDocument: vi.fn(),
}));
vi.mock('../lib/email', () => ({
  sendEmail: vi.fn(async () => undefined),
  emailOsStatusChanged: vi.fn(() => ({})),
  emailServiceAssigned: vi.fn(() => ({})),
}));

import { getDb } from '../db/client';
import { writeAuditLog } from '../lib/audit';
import inventoryRouter from './inventory';

function buildEnv(overrides: Partial<Bindings> = {}): Bindings {
  return {
    DB: {} as D1Database,
    STORAGE: {
      get: vi.fn(async () => null),
      put: vi.fn(async () => undefined),
      delete: vi.fn(async () => undefined),
    } as unknown as R2Bucket,
    KV: {} as KVNamespace,
    QUEUE: {} as Queue,
    DOCUMENT_INGESTION_QUEUE: {} as Queue,
    AI: {} as Ai,
    JWT_SECRET: 'test-secret-key-minimum-32-chars-ok',
    CORS_ORIGINS: 'http://localhost:3000',
    ENVIRONMENT: 'development',
    R2_PUBLIC_URL: '',
    RESEND_API_KEY: 'test-key',
    APP_URL: 'http://localhost:3000',
    ...overrides,
  };
}

function authed(url: string, opts: RequestInit = {}): Request {
  return new Request(url, {
    ...opts,
    headers: {
      Authorization: 'Bearer test-token',
      ...((opts.headers as Record<string, string>) ?? {}),
    },
  });
}

function buildApp() {
  const app = new Hono<{ Bindings: Bindings }>();
  app.route('/properties/:propertyId/inventory', inventoryRouter);
  return app;
}

function membership(tenantId: string, role: 'owner' | 'manager' = 'owner') {
  return { tenantId, role };
}

const propertyAccess = { tenantId: 'tenant-a', ownerId: 'user-1', managerId: null };

const itemA = {
  id: 'item-1',
  property_id: 'prop-a',
  room_id: null,
  category: 'equipment',
  name: 'Filtro',
  brand: null,
  model: null,
  serial_number: null,
  color_code: null,
  lot_number: null,
  supplier: null,
  quantity: 1,
  unit: 'un',
  reserve_qty: null,
  storage_loc: null,
  photo_url: null,
  qr_code: null,
  price_paid: null,
  purchase_date: null,
  warranty_until: null,
  notes: null,
  created_at: '2026-05-16T00:00:00.000Z',
  deleted_at: null,
};

type DbMock = {
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  whereCalls: unknown[];
};

function buildDb(selectCalls: unknown[][], updateWhere = vi.fn(async () => undefined)): DbMock {
  let i = 0;
  const whereCalls: unknown[] = [];

  function terminal(rows: unknown[]) {
    return { limit: vi.fn(async () => rows) };
  }

  function whereResult(rows: unknown[]) {
    return {
      limit: vi.fn(async () => rows),
      orderBy: vi.fn(() => terminal(rows)),
    };
  }

  function recordWhere(rows: unknown[]) {
    return vi.fn((condition: unknown) => {
      whereCalls.push(condition);
      return whereResult(rows);
    });
  }

  function fromResult(rows: unknown[]) {
    return {
      where: recordWhere(rows),
      innerJoin: vi.fn(() => ({
        where: recordWhere(rows),
      })),
      leftJoin: vi.fn(() => ({
        where: recordWhere(rows),
      })),
      orderBy: vi.fn(async () => rows),
      limit: vi.fn(async () => rows),
    };
  }

  return {
    select: vi.fn(() => {
      const rows = selectCalls[i++] ?? [];
      return {
        from: vi.fn(() => fromResult(rows)),
      };
    }),
    insert: vi.fn(() => ({
      values: vi.fn(async () => undefined),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: updateWhere,
      })),
    })),
    whereCalls,
  };
}

function conditionContainsField(condition: unknown, fieldName: string): boolean {
  const seen = new WeakSet<object>();

  function visit(value: unknown): boolean {
    if (value === null || value === undefined) return false;
    if (typeof value !== 'object') return false;
    if (seen.has(value)) return false;
    seen.add(value);

    const record = value as Record<string, unknown>;
    if (record.name === fieldName || record.keyAsName === fieldName) return true;
    return Object.values(record).some(visit);
  }

  return visit(condition);
}

function expectTenantPropertyItemScope(condition: unknown) {
  expect(conditionContainsField(condition, 'id')).toBe(true);
  expect(conditionContainsField(condition, 'tenant_id')).toBe(true);
  expect(conditionContainsField(condition, 'property_id')).toBe(true);
  expect(conditionContainsField(condition, 'deleted_at')).toBe(true);
}

function firstMockArg(mock: ReturnType<typeof vi.fn>): unknown {
  return (mock.mock.calls as unknown[][])[0]?.[0];
}

describe('Inventory IDOR hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('permite update autorizado e audita a alteracao', async () => {
    const updateWhere = vi.fn(async () => undefined);
    const db = buildDb([
      [membership('tenant-a')],
      [propertyAccess],
      [],
      [itemA],
      [{ ...itemA, name: 'Filtro atualizado' }],
    ], updateWhere);
    vi.mocked(getDb).mockReturnValue(db as never);

    const res = await buildApp().fetch(
      authed('http://localhost/properties/prop-a/inventory/item-1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Filtro atualizado' }),
      }),
      buildEnv()
    );
    const body = await res.json() as { item: { id: string; name: string } };

    expect(res.status).toBe(200);
    expect(body.item).toMatchObject({ id: 'item-1', name: 'Filtro atualizado' });
    expect(updateWhere).toHaveBeenCalledOnce();
    expectTenantPropertyItemScope(firstMockArg(updateWhere));
    expect(writeAuditLog).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      tenantId: 'tenant-a',
      propertyId: 'prop-a',
      entityId: 'item-1',
      action: 'update',
    }));
  });

  it('bloqueia update cross-tenant antes da mutacao', async () => {
    const updateWhere = vi.fn(async () => undefined);
    const db = buildDb([
      [membership('tenant-a')],
      [propertyAccess],
      [],
      [],
    ], updateWhere);
    vi.mocked(getDb).mockReturnValue(db as never);

    const res = await buildApp().fetch(
      authed('http://localhost/properties/prop-a/inventory/item-tenant-b', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Tentativa' }),
      }),
      buildEnv()
    );

    expect(res.status).toBe(404);
    expect(db.update).not.toHaveBeenCalled();
    expect(updateWhere).not.toHaveBeenCalled();
  });

  it('bloqueia update cross-property antes da mutacao', async () => {
    const updateWhere = vi.fn(async () => undefined);
    const db = buildDb([
      [membership('tenant-a')],
      [propertyAccess],
      [],
      [],
    ], updateWhere);
    vi.mocked(getDb).mockReturnValue(db as never);

    const res = await buildApp().fetch(
      authed('http://localhost/properties/prop-a/inventory/item-prop-b', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Tentativa' }),
      }),
      buildEnv()
    );

    expect(res.status).toBe(404);
    expect(db.update).not.toHaveBeenCalled();
    expect(updateWhere).not.toHaveBeenCalled();
  });

  it('bloqueia delete cross-property antes da mutacao', async () => {
    const updateWhere = vi.fn(async () => undefined);
    const db = buildDb([
      [membership('tenant-a')],
      [propertyAccess],
      [],
      [],
    ], updateWhere);
    vi.mocked(getDb).mockReturnValue(db as never);

    const res = await buildApp().fetch(
      authed('http://localhost/properties/prop-a/inventory/item-prop-b', { method: 'DELETE' }),
      buildEnv()
    );

    expect(res.status).toBe(404);
    expect(db.update).not.toHaveBeenCalled();
    expect(updateWhere).not.toHaveBeenCalled();
  });

  it('nao retorna item de outro property no select pos-update', async () => {
    const updateWhere = vi.fn(async () => undefined);
    const db = buildDb([
      [membership('tenant-a')],
      [propertyAccess],
      [],
      [itemA],
      [],
    ], updateWhere);
    vi.mocked(getDb).mockReturnValue(db as never);

    const res = await buildApp().fetch(
      authed('http://localhost/properties/prop-a/inventory/item-1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Filtro atualizado' }),
      }),
      buildEnv()
    );
    const body = await res.json() as { code: string };

    expect(res.status).toBe(500);
    expect(body.code).toBe('UPDATE_ERROR');
    expectTenantPropertyItemScope(firstMockArg(updateWhere));
    expectTenantPropertyItemScope(db.whereCalls.at(-1));
    expect(writeAuditLog).not.toHaveBeenCalled();
  });

  it('upload de foto atualiza usando itemId + tenantId + propertyId + deletedAt', async () => {
    const updateWhere = vi.fn(async () => undefined);
    const db = buildDb([
      [membership('tenant-a')],
      [propertyAccess],
      [],
      [{ id: 'item-1' }],
    ], updateWhere);
    vi.mocked(getDb).mockReturnValue(db as never);

    const form = new FormData();
    form.append('photo', new File(['image-bytes'], 'photo.jpg', { type: 'image/jpeg' }));

    const res = await buildApp().fetch(
      authed('http://localhost/properties/prop-a/inventory/item-1/photo', {
        method: 'POST',
        body: form,
      }),
      buildEnv()
    );
    const body = await res.json() as { photo_url: string };

    expect(res.status).toBe(200);
    expect(body.photo_url).toBe('/api/v1/properties/prop-a/inventory/item-1/photo');
    expect(updateWhere).toHaveBeenCalledOnce();
    expectTenantPropertyItemScope(firstMockArg(updateWhere));
  });

  it('geracao de QR atualiza usando itemId + tenantId + propertyId + deletedAt', async () => {
    const updateWhere = vi.fn(async () => undefined);
    const db = buildDb([
      [membership('tenant-a')],
      [propertyAccess],
      [],
      [{ id: 'item-1' }],
    ], updateWhere);
    vi.mocked(getDb).mockReturnValue(db as never);

    const res = await buildApp().fetch(
      authed('http://localhost/properties/prop-a/inventory/item-1/qr', { method: 'POST' }),
      buildEnv()
    );
    const body = await res.json() as { qr_value: string; item_id: string };

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ qr_value: 'houselog://inventory/item-1', item_id: 'item-1' });
    expect(updateWhere).toHaveBeenCalledOnce();
    expectTenantPropertyItemScope(firstMockArg(updateWhere));
  });
});
