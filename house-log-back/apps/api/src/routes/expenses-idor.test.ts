import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Bindings } from '../lib/types';

vi.mock('../db/client', () => ({ getDb: vi.fn() }));
vi.mock('../lib/audit', () => ({ writeAuditLog: vi.fn(async () => undefined) }));
vi.mock('../lib/jwt', () => ({
  verifyJwt: vi.fn(async () => ({
    sub: 'user-1',
    email: 'test@example.com',
    role: 'owner' as const,
  })),
}));

import { getDb } from '../db/client';
import { writeAuditLog } from '../lib/audit';
import expensesRouter from './expenses';

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
  app.route('/properties/:propertyId/expenses', expensesRouter);
  return app;
}

const propertyAccess = { tenantId: 'tenant-a', ownerId: 'user-1', managerId: null };

const expenseA = {
  id: 'expense-1',
  property_id: 'prop-a',
  category: 'maintenance',
  amount: 100,
  type: 'expense',
  reference_month: '2026-05',
  is_recurring: false,
  recurrence_group: null,
  receipt_url: null,
  notes: 'Original',
  created_by: 'user-1',
  created_at: '2026-05-17T00:00:00.000Z',
  deleted_at: null,
};

type DbMock = {
  select: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  whereCalls: unknown[];
};

function buildDb(selectCalls: unknown[][], updateWhere = vi.fn(async () => undefined)): DbMock {
  let i = 0;
  const whereCalls: unknown[] = [];

  function terminal(rows: unknown[]) {
    return { limit: vi.fn(async () => rows) };
  }

  function recordWhere(rows: unknown[]) {
    return vi.fn((condition: unknown) => {
      whereCalls.push(condition);
      return terminal(rows);
    });
  }

  function fromResult(rows: unknown[]) {
    return {
      where: recordWhere(rows),
      innerJoin: vi.fn(() => ({
        where: recordWhere(rows),
      })),
    };
  }

  return {
    select: vi.fn(() => {
      const rows = selectCalls[i++] ?? [];
      return {
        from: vi.fn(() => fromResult(rows)),
      };
    }),
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

function expectTenantPropertyExpenseScope(condition: unknown) {
  expect(conditionContainsField(condition, 'id')).toBe(true);
  expect(conditionContainsField(condition, 'tenant_id')).toBe(true);
  expect(conditionContainsField(condition, 'property_id')).toBe(true);
  expect(conditionContainsField(condition, 'deleted_at')).toBe(true);
}

function firstMockArg(mock: ReturnType<typeof vi.fn>): unknown {
  return (mock.mock.calls as unknown[][])[0]?.[0];
}

describe('Expenses IDOR hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('permite update autorizado e audita a alteracao', async () => {
    const updateWhere = vi.fn(async () => undefined);
    const db = buildDb([
      [{ tenantId: 'tenant-a', role: 'owner' }],
      [propertyAccess],
      [],
      [expenseA],
      [{ ...expenseA, notes: 'Atualizada' }],
    ], updateWhere);
    vi.mocked(getDb).mockReturnValue(db as never);

    const res = await buildApp().fetch(
      authed('http://localhost/properties/prop-a/expenses/expense-1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: 'Atualizada' }),
      }),
      buildEnv()
    );
    const body = await res.json() as { expense: { id: string; notes: string } };

    expect(res.status).toBe(200);
    expect(body.expense).toMatchObject({ id: 'expense-1', notes: 'Atualizada' });
    expect(updateWhere).toHaveBeenCalledOnce();
    expectTenantPropertyExpenseScope(firstMockArg(updateWhere));
    expect(writeAuditLog).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      tenantId: 'tenant-a',
      propertyId: 'prop-a',
      entityId: 'expense-1',
      action: 'update',
    }));
  });

  it('bloqueia update cross-tenant antes da mutacao', async () => {
    const updateWhere = vi.fn(async () => undefined);
    const db = buildDb([
      [{ tenantId: 'tenant-a', role: 'owner' }],
      [propertyAccess],
      [],
      [],
    ], updateWhere);
    vi.mocked(getDb).mockReturnValue(db as never);

    const res = await buildApp().fetch(
      authed('http://localhost/properties/prop-a/expenses/expense-tenant-b', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: 'Tentativa' }),
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
      [{ tenantId: 'tenant-a', role: 'owner' }],
      [propertyAccess],
      [],
      [],
    ], updateWhere);
    vi.mocked(getDb).mockReturnValue(db as never);

    const res = await buildApp().fetch(
      authed('http://localhost/properties/prop-a/expenses/expense-prop-b', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: 'Tentativa' }),
      }),
      buildEnv()
    );

    expect(res.status).toBe(404);
    expect(db.update).not.toHaveBeenCalled();
    expect(updateWhere).not.toHaveBeenCalled();
  });

  it('retorna 404 para recurso inexistente sem executar update', async () => {
    const updateWhere = vi.fn(async () => undefined);
    const db = buildDb([
      [{ tenantId: 'tenant-a', role: 'owner' }],
      [propertyAccess],
      [],
      [],
    ], updateWhere);
    vi.mocked(getDb).mockReturnValue(db as never);

    const res = await buildApp().fetch(
      authed('http://localhost/properties/prop-a/expenses/missing-expense', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: 'Tentativa' }),
      }),
      buildEnv()
    );

    expect(res.status).toBe(404);
    expect(db.update).not.toHaveBeenCalled();
    expect(updateWhere).not.toHaveBeenCalled();
  });

  it('nao retorna despesa de outro property no select pos-update', async () => {
    const updateWhere = vi.fn(async () => undefined);
    const db = buildDb([
      [{ tenantId: 'tenant-a', role: 'owner' }],
      [propertyAccess],
      [],
      [expenseA],
      [],
    ], updateWhere);
    vi.mocked(getDb).mockReturnValue(db as never);

    const res = await buildApp().fetch(
      authed('http://localhost/properties/prop-a/expenses/expense-1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: 'Atualizada' }),
      }),
      buildEnv()
    );
    const body = await res.json() as { code: string };

    expect(res.status).toBe(404);
    expect(body.code).toBe('NOT_FOUND');
    expectTenantPropertyExpenseScope(firstMockArg(updateWhere));
    expectTenantPropertyExpenseScope(db.whereCalls.at(-1));
    expect(writeAuditLog).not.toHaveBeenCalled();
  });
});
