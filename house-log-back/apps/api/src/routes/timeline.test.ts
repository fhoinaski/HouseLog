import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import timelineRoute from './timeline';
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
  assertPropertyAccess: vi.fn(async () => authState.propertyAccess),
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

function createApp() {
  const app = new Hono();
  app.route('/properties/:propertyId/timeline', timelineRoute);
  return app;
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

function request(path = '/properties/prop-1/timeline') {
  return new Request(`http://localhost${path}`);
}

function send(path = '/properties/prop-1/timeline') {
  return createApp().request(request(path), undefined, { DB: {} });
}

const propertyRow = [{ id: 'prop-1', name: 'Casa Jardim', type: 'house', createdAt: '2026-01-01T10:00:00.000Z' }];

describe('GET /properties/:propertyId/timeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.propertyAccess = true;
    authState.tenantId = 'tenant-a';
    authState.tenantRole = 'owner';
  });

  it('renderiza eventos tecnicos sem payload sensivel', async () => {
    const db = createDbQueue([
      propertyRow,
      [{ id: 'room-1', name: 'Sala', type: 'living', createdAt: '2026-01-02T10:00:00.000Z' }],
      [{ id: 'doc-1', title: 'Manual tecnico', type: 'manual', createdAt: '2026-01-03T10:00:00.000Z' }],
      [{ id: 'war-1', title: 'Garantia do telhado', status: 'active', endDate: '2028-01-01', createdAt: '2026-01-04T10:00:00.000Z' }],
      [{ id: 'req-1', title: 'Infiltracao na suite', status: 'OPEN', createdAt: '2026-01-05T10:00:00.000Z' }],
      [{
        id: 'os-1',
        title: 'Reparo hidraulico',
        status: 'completed',
        priority: 'urgent',
        systemType: 'plumbing',
        beforePhotos: ['prop-1/private/r2-key-before.jpg'],
        afterPhotos: ['prop-1/private/r2-key-after.jpg'],
        createdAt: '2026-01-06T10:00:00.000Z',
        completedAt: '2026-01-07T10:00:00.000Z',
      }],
      [{ id: 'inv-1', name: 'Filtro reserva', category: 'plumbing', createdAt: '2026-01-08T10:00:00.000Z' }],
      [{ id: 'hand-1', title: 'Entrega tecnica', type: 'handover', status: 'accepted', createdAt: '2026-01-09T10:00:00.000Z', issuedAt: '2026-01-10T10:00:00.000Z', acceptedAt: '2026-01-11T10:00:00.000Z' }],
      [{ id: 'ren-1', title: 'Reforma da cozinha', category: 'finishing', status: 'completed', completedAt: '2026-01-12T10:00:00.000Z', createdAt: '2026-01-12T09:00:00.000Z' }],
      [{ id: 'job-1', documentId: 'doc-1', status: 'completed', finishedAt: '2026-01-13T10:00:00.000Z', createdAt: '2026-01-13T09:00:00.000Z' }],
    ]);
    mockDb(db);

    const res = await send();
    const body = await res.json() as { data: Array<{ type: string; meta?: Record<string, unknown> }> };
    const serialized = JSON.stringify(body);

    expect(res.status).toBe(200);
    expect(body.data.map((event) => event.type)).toEqual(expect.arrayContaining([
      'property_created',
      'room_created',
      'document_uploaded',
      'warranty_created',
      'service_request_opened',
      'diagnostic_recorded',
      'service_order_created',
      'service_order_completed',
      'evidence_uploaded',
      'inventory_updated',
      'renovation_completed',
      'dossier_issued',
      'handover_accepted',
    ]));
    expect(serialized).not.toContain('r2-key-before');
    expect(serialized).not.toContain('r2-key-after');
    expect(serialized).not.toContain('token');
    expect(serialized).not.toContain('file_url');
    expect(body.data.find((event) => event.type === 'evidence_uploaded')?.meta).toEqual({
      evidence_count: 2,
      system_type: 'plumbing',
    });
  });

  it('retorna vazio para imovel sem eventos alem da criacao fora do cursor', async () => {
    const db = createDbQueue([propertyRow, [], [], [], [], [], [], [], [], []]);
    mockDb(db);

    const res = await send('/properties/prop-1/timeline?before=2025-01-01T00:00:00.000Z');
    const body = await res.json() as { data: unknown[] };

    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(0);
  });

  it('bloqueia usuario sem permissao no imovel', async () => {
    authState.propertyAccess = false;
    const db = createDbQueue([propertyRow]);
    mockDb(db);

    const res = await send();

    expect(res.status).toBe(403);
    expect(assertPropertyAccess).toHaveBeenCalledWith(expect.anything(), 'prop-1', 'user-1', 'owner', 'tenant-a', 'owner');
  });

  it('nao vaza eventos quando o imovel pertence a outro tenant', async () => {
    const db = createDbQueue([[]]);
    mockDb(db);

    const res = await send('/properties/prop-cross/timeline');

    expect(res.status).toBe(404);
  });

  it('valida input de query string', async () => {
    const db = createDbQueue([propertyRow]);
    mockDb(db);

    const res = await send('/properties/prop-1/timeline?limit=9999');

    expect(res.status).toBe(400);
  });
});
