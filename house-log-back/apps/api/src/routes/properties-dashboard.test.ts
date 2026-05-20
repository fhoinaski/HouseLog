import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import propertiesRoute from './properties';
import { getDb } from '../db/client';
import { assertPropertyAccess } from '../middleware/auth';

const authState = vi.hoisted(() => ({
  userId: 'user-1',
  userRole: 'owner' as string,
  tenantId: 'tenant-a',
  tenantRole: 'owner' as string,
  propertyAccess: true,
}));

vi.mock('../db/client', () => ({ getDb: vi.fn() }));
vi.mock('../lib/audit', () => ({ writeAuditLog: vi.fn() }));
vi.mock('../lib/id', () => ({ createId: vi.fn(() => 'new-id') }));
vi.mock('../lib/r2', () => ({
  buildR2Key: vi.fn(),
  uploadToR2: vi.fn(),
  preparePrivateUpload: vi.fn(),
}));
vi.mock('../lib/authorization', () => ({ listAccessiblePropertyIds: vi.fn(async () => ['prop-1']) }));
vi.mock('../lib/property-tenant', () => ({ canCreatePropertyInTenant: vi.fn(async () => true) }));
vi.mock('../middleware/auth', () => ({
  authMiddleware: async (c: { set: (key: string, value: string) => void }, next: () => Promise<void>) => {
    c.set('userId', authState.userId);
    c.set('userRole', authState.userRole);
    await next();
  },
  resolveTenant: async (c: { set: (key: string, value: string) => void }, next: () => Promise<void>) => {
    c.set('tenantId', authState.tenantId);
    c.set('tenantRole', authState.tenantRole);
    await next();
  },
  requireRole: () => async (_c: unknown, next: () => Promise<void>) => next(),
  assertPropertyAccess: vi.fn(async () => authState.propertyAccess),
  assertTenantAccess: vi.fn(async () => true),
}));

function makeChain(value: unknown): Record<string, unknown> {
  function fn(): typeof proxy {
    return proxy;
  }
  const proxy: Record<string, unknown> = new Proxy(fn as unknown as Record<string, unknown>, {
    get(_, key: string | symbol) {
      if (key === 'then') {
        return (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
          Promise.resolve(value).then(onFulfilled, onRejected);
      }
      if (key === 'catch') return () => Promise.resolve(value);
      return fn;
    },
    apply() {
      return proxy;
    },
  });
  return proxy;
}

function createDbQueue(values: unknown[]) {
  const queue = [...values];
  return {
    select: vi.fn(() => makeChain(queue.shift() ?? [])),
  };
}

function mockDb(db: ReturnType<typeof createDbQueue>) {
  vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);
}

function createApp() {
  const app = new Hono();
  app.route('/properties', propertiesRoute);
  return app;
}

function send(path = '/properties/prop-1/dashboard') {
  return createApp().request(new Request(`http://localhost${path}`), undefined, { DB: {}, STORAGE: {} });
}

const propertyRow = [{ id: 'prop-1' }];

describe('GET /properties/:id/dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.propertyAccess = true;
    authState.tenantId = 'tenant-a';
  });

  it('retorna indicadores executivos derivados de fixtures reais sem payload sensivel', async () => {
    const db = createDbQueue([
      propertyRow,
      [{ total: 900, this_month: 120 }],
      [{ total: 5, requested: 2, in_progress: 1, done: 2, urgent_open: 1 }],
      [{ total: 8, low_stock: 2 }],
      [{ total: 3, overdue: 1, due_soon: 1 }],
      [{ health_score: 76 }],
      [{ total: 4, expired: 1, expiring_soon: 1 }],
      [{ pending_review: 2, failed_processing: 1 }],
      [{ total: 3, active: 2, expired: 1, expiring_soon: 1 }],
      [{ total: 1, issued: 1, accepted: 0 }],
      [{ reference_month: '2026-05', total: 120, category: 'maintenance' }],
      [{ id: 'inv-war-1', name: 'Filtro', warranty_until: '2026-05-30', days_left: 10, source: 'inventory' }],
      [{ id: 'war-1', name: 'Garantia estrutural', warranty_until: '2026-05-25', days_left: 5, source: 'warranty' }],
      [],
      [{ id: 'war-expired-1', name: 'Garantia impermeabilizacao', warranty_until: '2026-04-25', days_overdue: 10, source: 'warranty' }],
      [{ id: 'maint-1', title: 'Revisao eletrica', next_due: '2026-04-20', days_overdue: 15 }],
      [{ id: 'os-stale-1', title: 'Reparo infiltracao', status: 'requested', created_at: '2026-04-01T10:00:00.000Z', days_open: 34 }],
      [{ type: 'deed' }],
      [{ id: 'doc-1', title: 'Manual tecnico', created_at: '2026-05-01T10:00:00.000Z' }],
      [{ id: 'os-1', title: 'Revisao eletrica', status: 'completed', priority: 'normal', created_at: '2026-05-02T10:00:00.000Z', completed_at: '2026-05-03T10:00:00.000Z' }],
      [{ id: 'req-1', title: 'Infiltracao', status: 'OPEN', created_at: '2026-05-01T11:00:00.000Z' }],
      [{ id: 'war-1', title: 'Garantia estrutural', status: 'active', created_at: '2026-05-01T12:00:00.000Z' }],
      [{ id: 'inv-1', name: 'Tinta reserva', created_at: '2026-05-01T13:00:00.000Z' }],
      [{ id: 'hand-1', title: 'Dossie de entrega', status: 'issued', issued_at: '2026-05-04T10:00:00.000Z', accepted_at: null, created_at: '2026-05-01T09:00:00.000Z' }],
    ]);
    mockDb(db);

    const res = await send();
    const body = await res.json() as {
      documents: { pending_review: number; failed_processing: number };
      warranties: { expiring_soon: number };
      handover: { dossier_status: string };
      last_event: { type: string; title: string };
      warranties_expiring: Array<{ name: string; days_left: number }>;
      preventive_alerts: Array<{ type: string; title: string; entity_id: string | null }>;
    };
    const serialized = JSON.stringify(body);

    expect(res.status).toBe(200);
    expect(body.documents.pending_review).toBe(2);
    expect(body.documents.failed_processing).toBe(1);
    expect(body.warranties.expiring_soon).toBe(2);
    expect(body.handover.dossier_status).toBe('issued');
    expect(body.last_event).toMatchObject({ type: 'handover_issued', title: 'Dossie de entrega' });
    expect(body.warranties_expiring.map((warranty) => warranty.name)).toEqual(['Garantia estrutural', 'Filtro']);
    expect(body.preventive_alerts).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'warranty_expiring', title: 'Garantia vence em 30 dias', entity_id: 'war-1' }),
      expect.objectContaining({ type: 'warranty_expired', title: 'Garantia vencida', entity_id: 'war-expired-1' }),
      expect.objectContaining({ type: 'maintenance_overdue', entity_id: 'maint-1' }),
      expect.objectContaining({ type: 'stale_service_order', entity_id: 'os-stale-1' }),
      expect.objectContaining({ type: 'missing_essential_documents', entity_id: 'prop-1' }),
      expect.objectContaining({ type: 'handover_pending', entity_id: 'hand-1' }),
    ]));
    expect(serialized).not.toContain('r2');
    expect(serialized).not.toContain('token');
    expect(serialized).not.toContain('file_url');
  });

  it('bloqueia usuario sem permissao no imovel', async () => {
    authState.propertyAccess = false;
    const db = createDbQueue([propertyRow]);
    mockDb(db);

    const res = await send();

    expect(res.status).toBe(403);
    expect(assertPropertyAccess).toHaveBeenCalledWith(expect.anything(), 'prop-1', 'user-1', 'owner', 'tenant-a', 'owner');
  });

  it('nao permite acesso cross-tenant', async () => {
    const db = createDbQueue([[]]);
    mockDb(db);

    const res = await send('/properties/prop-other/dashboard');

    expect(res.status).toBe(404);
  });

  it('retorna lista limpa quando nao ha alerta preventivo', async () => {
    const db = createDbQueue([
      propertyRow,
      [{ total: 0, this_month: 0 }],
      [{ total: 1, requested: 0, in_progress: 0, done: 1, urgent_open: 0 }],
      [{ total: 0, low_stock: 0 }],
      [{ total: 1, overdue: 0, due_soon: 0 }],
      [{ health_score: 92 }],
      [{ total: 4, expired: 0, expiring_soon: 0 }],
      [{ pending_review: 0, failed_processing: 0 }],
      [{ total: 1, active: 1, expired: 0, expiring_soon: 0 }],
      [{ total: 1, issued: 1, accepted: 1 }],
      [],
      [],
      [],
      [],
      [],
      [],
      [],
      [{ type: 'deed' }, { type: 'insurance' }, { type: 'project' }, { type: 'permit' }],
      [],
      [],
      [],
      [],
      [],
      [{ id: 'hand-accepted-1', title: 'Dossie aceito', status: 'accepted', issued_at: '2026-05-01T10:00:00.000Z', accepted_at: '2026-05-02T10:00:00.000Z', created_at: '2026-05-01T09:00:00.000Z' }],
    ]);
    mockDb(db);

    const res = await send();
    const body = await res.json() as { preventive_alerts: unknown[] };

    expect(res.status).toBe(200);
    expect(body.preventive_alerts).toEqual([]);
  });
});
