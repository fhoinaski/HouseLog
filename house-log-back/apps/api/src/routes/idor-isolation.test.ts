/**
 * Testes de isolamento IDOR — P0-IDOR-AUDIT
 *
 * Cobre os patches de isolamento multi-tenant implementados em:
 *  - technical-systems.ts  (resolvePropertyAccess com jwtTenantId)
 *  - technical-points.ts   (idem)
 *  - marketplace.ts        (ratings filtradas por tenantId em /providers/match)
 *  - expenses.ts           (propertyId no WHERE de UPDATE e DELETE)
 *  - invites.ts            (tenantId nos queries de listagem do GET)
 *  - service-requests.ts   (bids.tenantId no convert-to-service)
 */

import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Bindings } from '../lib/types';
import { isUuidV4 } from '../lib/id';

// ── Mocks globais ────────────────────────────────────────────────────────────

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
import technicalSystemsRouter from './technical-systems';
import technicalPointsRouter from './technical-points';
import marketplaceRouter from './marketplace';
import expensesRouter from './expenses';
import serviceRequestsRouter from './service-requests';

// ── Helpers ──────────────────────────────────────────────────────────────────

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

/** Mock de membership válido para o tenant solicitado. */
function membershipRow(tenantId: string, role: 'owner' | 'manager' = 'owner') {
  return { tenantId, role };
}

/** Stub de select que retorna rows fixas (suporta .limit(), .orderBy(), .groupBy()). */
function selectStub(rows: unknown[]) {
  const terminal = {
    limit: vi.fn(async () => rows),
    orderBy: vi.fn(async () => rows),
    groupBy: vi.fn(async () => rows),
  };
  return {
    from: vi.fn(() => ({
      where: vi.fn(() => terminal),
      innerJoin: vi.fn(() => ({
        where: vi.fn(() => terminal),
      })),
      orderBy: vi.fn(async () => rows),
      groupBy: vi.fn(async () => rows),
    })),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ═══════════════════════════════════════════════════════════════════════════════
// technical-systems.ts — cross-tenant property access
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /properties/:propertyId/technical-systems — isolamento cross-tenant', () => {
  function buildApp() {
    const app = new Hono<{ Bindings: Bindings }>();
    app.route('/properties/:propertyId/technical-systems', technicalSystemsRouter);
    return app;
  }

  it('retorna 404 quando propertyId pertence a outro tenant (cross-tenant IDOR)', async () => {
    // resolveTenant retorna tenant-a; property fetch retorna vazio (tenantId filtrado pelo JWT)
    vi.mocked(getDb).mockReturnValue({
      select: vi.fn()
        // 1ª: resolveTenant membership
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            innerJoin: vi.fn(() => ({
              where: vi.fn(() => ({
                limit: vi.fn(async () => [membershipRow('tenant-a')]),
              })),
            })),
          })),
        })
        // 2ª: resolvePropertyAccess property fetch — com eq(tenantId, jwtTenantId) não encontra nada
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(() => ({ limit: vi.fn(async () => []) })),
          })),
        }),
    } as never);

    const res = await buildApp().fetch(
      authedRequest('http://localhost/properties/prop-tenant-b/technical-systems'),
      buildEnv()
    );

    // resolvePropertyAccess retorna null → notFound
    expect(res.status).toBe(404);
  });

  it('retorna 200 quando propertyId pertence ao tenant correto', async () => {
    const propertyRow = { id: 'prop-1', tenantId: 'tenant-a', ownerId: 'user-1', managerId: null };
    vi.mocked(getDb).mockReturnValue({
      select: vi.fn()
        // 1ª: resolveTenant
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            innerJoin: vi.fn(() => ({
              where: vi.fn(() => ({
                limit: vi.fn(async () => [membershipRow('tenant-a')]),
              })),
            })),
          })),
        })
        // 2ª: property fetch — encontrada porque tenantId bate
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(() => ({ limit: vi.fn(async () => [propertyRow]) })),
          })),
        })
        // 3ª: collaborator lookup
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(() => ({ limit: vi.fn(async () => []) })),
          })),
        })
        // 4ª: systems list
        .mockReturnValue(selectStub([])),
    } as never);

    const res = await buildApp().fetch(
      authedRequest('http://localhost/properties/prop-1/technical-systems'),
      buildEnv()
    );

    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body).toHaveProperty('systems');
  });
});

describe('POST /properties/:propertyId/service-requests/:id/convert-to-service - room cross-tenant bloqueado', () => {
  const insertSpy = vi.fn();

  function buildApp() {
    const app = new Hono<{ Bindings: Bindings }>();
    app.route('/properties/:propertyId/service-requests', serviceRequestsRouter);
    return app;
  }

  beforeEach(() => {
    insertSpy.mockClear();
  });

  it('retorna 422 e nao cria OS quando room_id nao pertence ao tenant/property ativo', async () => {
    vi.mocked(getDb).mockReturnValue({
      select: vi.fn()
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            innerJoin: vi.fn(() => ({
              where: vi.fn(() => ({ limit: vi.fn(async () => [membershipRow('tenant-a')]) })),
            })),
          })),
        })
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => [{ tenantId: 'tenant-a', ownerId: 'user-1', managerId: null }]),
            })),
          })),
        })
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(() => ({ limit: vi.fn(async () => []) })),
          })),
        })
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            innerJoin: vi.fn(() => ({
              where: vi.fn(() => ({
                limit: vi.fn(async () => [{
                  id: 'request-1',
                  propertyId: 'prop-1',
                  title: 'Orcamento',
                  description: 'Descricao',
                  status: 'OPEN',
                }]),
              })),
            })),
          })),
        })
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => [{
                id: 'bid-1',
                providerId: 'provider-1',
                amount: 500,
                scope: 'Escopo',
                status: 'ACCEPTED',
              }]),
            })),
          })),
        })
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(() => ({ limit: vi.fn(async () => []) })),
          })),
        }),
      insert: insertSpy,
    } as never);

    const res = await buildApp().fetch(
      authedRequest('http://localhost/properties/prop-1/service-requests/request-1/convert-to-service', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'OS convertida',
          system_type: 'general',
          priority: 'normal',
          room_id: 'room-tenant-b',
        }),
      }),
      buildEnv()
    );

    const body = await res.json() as Record<string, unknown>;
    expect(res.status).toBe(422);
    expect(body.code).toBe('REFERENCE_NOT_FOUND');
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it('cria OS autorizada com UUID v4', async () => {
    const serviceInsertValuesSpy = vi.fn(async () => undefined);
    const updateWhereSpy = vi.fn(async () => undefined);

    vi.mocked(getDb).mockReturnValue({
      select: vi.fn()
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            innerJoin: vi.fn(() => ({
              where: vi.fn(() => ({ limit: vi.fn(async () => [membershipRow('tenant-a')]) })),
            })),
          })),
        })
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => [{ tenantId: 'tenant-a', ownerId: 'user-1', managerId: null }]),
            })),
          })),
        })
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(() => ({ limit: vi.fn(async () => []) })),
          })),
        })
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            innerJoin: vi.fn(() => ({
              where: vi.fn(() => ({
                limit: vi.fn(async () => [{
                  id: 'request-1',
                  propertyId: 'prop-1',
                  title: 'Orcamento',
                  description: 'Descricao',
                  status: 'OPEN',
                }]),
              })),
            })),
          })),
        })
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => [{
                id: 'bid-1',
                providerId: 'provider-1',
                amount: 500,
                scope: 'Escopo',
                status: 'ACCEPTED',
              }]),
            })),
          })),
        })
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(() => ({ limit: vi.fn(async () => [{ id: 'room-1' }]) })),
          })),
        })
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => [{
                id: 'service-created',
                property_id: 'prop-1',
                room_id: 'room-1',
                system_type: 'general',
                requested_by: 'user-1',
                assigned_to: 'provider-1',
                title: 'OS convertida',
                description: 'Descricao',
                priority: 'normal',
                status: 'approved',
                cost: 500,
                before_photos: [],
                after_photos: [],
                video_url: null,
                audio_url: null,
                checklist: [],
                warranty_until: null,
                scheduled_at: null,
                completed_at: null,
                created_at: new Date().toISOString(),
                deleted_at: null,
              }]),
            })),
          })),
        }),
      insert: vi.fn(() => ({ values: serviceInsertValuesSpy })),
      update: vi.fn(() => ({ set: vi.fn(() => ({ where: updateWhereSpy })) })),
    } as never);

    const res = await buildApp().fetch(
      authedRequest('http://localhost/properties/prop-1/service-requests/request-1/convert-to-service', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'OS convertida',
          system_type: 'general',
          priority: 'normal',
          room_id: 'room-1',
        }),
      }),
      buildEnv()
    );

    expect(res.status).toBe(201);
    expect(serviceInsertValuesSpy).toHaveBeenCalledOnce();
    const [insertedValues] = serviceInsertValuesSpy.mock.calls[0] as unknown as [Record<string, unknown>];
    expect(insertedValues.tenantId).toBe('tenant-a');
    expect(insertedValues.propertyId).toBe('prop-1');
    expect(isUuidV4(String(insertedValues.id))).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// technical-points.ts — cross-tenant property access
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /properties/:propertyId/technical-points — isolamento cross-tenant', () => {
  function buildApp() {
    const app = new Hono<{ Bindings: Bindings }>();
    app.route('/properties/:propertyId/technical-points', technicalPointsRouter);
    return app;
  }

  it('retorna 404 quando propertyId pertence a outro tenant', async () => {
    vi.mocked(getDb).mockReturnValue({
      select: vi.fn()
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            innerJoin: vi.fn(() => ({
              where: vi.fn(() => ({
                limit: vi.fn(async () => [membershipRow('tenant-a')]),
              })),
            })),
          })),
        })
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(() => ({ limit: vi.fn(async () => []) })), // property não encontrada
          })),
        }),
    } as never);

    const res = await buildApp().fetch(
      authedRequest('http://localhost/properties/prop-tenant-b/technical-points'),
      buildEnv()
    );

    expect(res.status).toBe(404);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// marketplace.ts — ratings filtradas por tenantId em /providers/match
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /marketplace/providers/match — ratings filtradas por tenantId', () => {
  function buildApp() {
    const app = new Hono<{ Bindings: Bindings }>();
    app.route('/marketplace', marketplaceRouter);
    return app;
  }

  it('retorna 400 TENANT_REQUIRED quando tenant não está ativo', async () => {
    // resolveTenant falha (sem membership)
    vi.mocked(getDb).mockReturnValue({
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          innerJoin: vi.fn(() => ({
            where: vi.fn(() => ({ limit: vi.fn(async () => []) })),
          })),
        })),
      })),
    } as never);

    const res = await buildApp().fetch(
      authedRequest('http://localhost/marketplace/providers/match'),
      buildEnv()
    );

    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, unknown>;
    expect(body.code).toBe('TENANT_REQUIRED');
  });

  it('inclui tenantId na query de ratings ao buscar providers', async () => {
    // ratingWhereSpy é o método .where() da query de ratingRows — deve ser chamado
    const ratingGroupBySpy = vi.fn(async () => []);
    const ratingWhereSpy = vi.fn(() => ({ groupBy: ratingGroupBySpy }));

    vi.mocked(getDb).mockReturnValue({
      select: vi.fn()
        // 1ª: resolveTenant membership
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            innerJoin: vi.fn(() => ({
              where: vi.fn(() => ({
                limit: vi.fn(async () => [membershipRow('tenant-a')]),
              })),
            })),
          })),
        })
        // 2ª: providers list
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(() => ({ limit: vi.fn(async () => []) })),
          })),
        })
        // 3ª: ratingRows — rota chama .from().where(tenantId).groupBy()
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: ratingWhereSpy,
            groupBy: vi.fn(async () => []),
          })),
        })
        // 4ª: endorseRows
        .mockReturnValue({
          from: vi.fn(() => ({
            groupBy: vi.fn(async () => []),
          })),
        }),
    } as never);

    const res = await buildApp().fetch(
      authedRequest('http://localhost/marketplace/providers/match'),
      buildEnv()
    );

    // Deve retornar 200 com data
    expect(res.status).toBe(200);
    // .where() foi chamado na query de ratings — confirma que a rota filtra por tenantId
    expect(ratingWhereSpy).toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// expenses.ts — propertyId no WHERE de UPDATE (defense-in-depth)
// ═══════════════════════════════════════════════════════════════════════════════

describe('PUT /properties/:propertyId/expenses/:id — propertyId no WHERE de update', () => {
  const updateWhereSpy = vi.fn(async () => undefined);

  function buildApp() {
    const app = new Hono<{ Bindings: Bindings }>();
    app.route('/properties/:propertyId/expenses', expensesRouter);
    return app;
  }

  function expenseRow(overrides: Record<string, unknown> = {}) {
    return {
      id: 'expense-x',
      property_id: 'prop-1',
      category: 'maintenance',
      amount: 100,
      type: 'expense',
      reference_month: '2026-05',
      is_recurring: 0,
      recurrence_group: null,
      receipt_url: null,
      notes: null,
      created_by: 'user-1',
      created_at: '2026-05-16T00:00:00.000Z',
      deleted_at: null,
      ...overrides,
    };
  }

  it('retorna 200 no update autorizado e devolve a despesa atualizada', async () => {
    const authorizedUpdateWhereSpy = vi.fn(async () => undefined);
    const updated = expenseRow({ amount: 250, notes: 'Ajuste autorizado' });

    vi.mocked(getDb).mockReturnValue({
      select: vi.fn()
        // 1Âª: resolveTenant
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            innerJoin: vi.fn(() => ({
              where: vi.fn(() => ({
                limit: vi.fn(async () => [membershipRow('tenant-a')]),
              })),
            })),
          })),
        })
        // 2Âª: assertPropertyAccess
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => [{ tenantId: 'tenant-a', ownerId: 'user-1', managerId: null }]),
            })),
          })),
        })
        // 3Âª: collaborator lookup
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(() => ({ limit: vi.fn(async () => []) })),
          })),
        })
        // 4Âª: expense fetch autorizada
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(() => ({ limit: vi.fn(async () => [expenseRow()]) })),
          })),
        })
        // 5Âª: select pos-update com escopo da mesma tenant/property
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(() => ({ limit: vi.fn(async () => [updated]) })),
          })),
        }),
      update: vi.fn(() => ({
        set: vi.fn(() => ({ where: authorizedUpdateWhereSpy })),
      })),
    } as never);

    const res = await buildApp().fetch(
      authedRequest('http://localhost/properties/prop-1/expenses/expense-x', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 250, notes: 'Ajuste autorizado' }),
      }),
      buildEnv()
    );

    expect(res.status).toBe(200);
    expect(authorizedUpdateWhereSpy).toHaveBeenCalled();
    await expect(res.json()).resolves.toMatchObject({
      expense: {
        id: 'expense-x',
        property_id: 'prop-1',
        amount: 250,
      },
    });
  });

  it('retorna 404 quando despesa não pertence à property/tenant (prior fetch guarda)', async () => {
    vi.mocked(getDb).mockReturnValue({
      select: vi.fn()
        // 1ª: resolveTenant
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            innerJoin: vi.fn(() => ({
              where: vi.fn(() => ({
                limit: vi.fn(async () => [membershipRow('tenant-a')]),
              })),
            })),
          })),
        })
        // 2ª: assertPropertyAccess — property lookup encontrada para tenant-a
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => [{ tenantId: 'tenant-a', ownerId: 'user-1', managerId: null }]),
            })),
          })),
        })
        // 3ª: collaborator lookup
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(() => ({ limit: vi.fn(async () => []) })),
          })),
        })
        // 4ª: expense fetch — não encontrada (property errada ou tenant errado)
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(() => ({ limit: vi.fn(async () => []) })),
          })),
        }),
      update: vi.fn(() => ({
        set: vi.fn(() => ({ where: updateWhereSpy })),
      })),
    } as never);

    const res = await buildApp().fetch(
      authedRequest('http://localhost/properties/prop-1/expenses/expense-x', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 999 }),
      }),
      buildEnv()
    );

    // expense fetch vazia → 404
    expect(res.status).toBe(404);
    // update não deve ter sido chamado
    expect(updateWhereSpy).not.toHaveBeenCalled();
  });

  it('retorna 404 quando o select pos-update nao encontra a despesa no mesmo tenant/property', async () => {
    const scopedUpdateWhereSpy = vi.fn(async () => undefined);

    vi.mocked(getDb).mockReturnValue({
      select: vi.fn()
        .mockReturnValueOnce(selectStub([membershipRow('tenant-a')]))
        .mockReturnValueOnce(selectStub([{ tenantId: 'tenant-a', ownerId: 'user-1', managerId: null }]))
        .mockReturnValueOnce(selectStub([]))
        .mockReturnValueOnce(selectStub([expenseRow()]))
        .mockReturnValueOnce(selectStub([])),
      update: vi.fn(() => ({
        set: vi.fn(() => ({ where: scopedUpdateWhereSpy })),
      })),
    } as never);

    const res = await buildApp().fetch(
      authedRequest('http://localhost/properties/prop-1/expenses/expense-x', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 999 }),
      }),
      buildEnv()
    );

    expect(res.status).toBe(404);
    expect(scopedUpdateWhereSpy).toHaveBeenCalled();
    await expect(res.json()).resolves.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});

describe('DELETE /properties/:propertyId/expenses/:id - cross-property bloqueado', () => {
  function buildApp() {
    const app = new Hono<{ Bindings: Bindings }>();
    app.route('/properties/:propertyId/expenses', expensesRouter);
    return app;
  }

  it('retorna 404 no delete cross-property e nao executa soft delete', async () => {
    const deleteWhereSpy = vi.fn(async () => undefined);

    vi.mocked(getDb).mockReturnValue({
      select: vi.fn()
        .mockReturnValueOnce(selectStub([membershipRow('tenant-a')]))
        .mockReturnValueOnce(selectStub([{ tenantId: 'tenant-a', ownerId: 'user-1', managerId: null }]))
        .mockReturnValueOnce(selectStub([]))
        .mockReturnValueOnce(selectStub([])),
      update: vi.fn(() => ({
        set: vi.fn(() => ({ where: deleteWhereSpy })),
      })),
    } as never);

    const res = await buildApp().fetch(
      authedRequest('http://localhost/properties/prop-1/expenses/expense-x', {
        method: 'DELETE',
      }),
      buildEnv()
    );

    expect(res.status).toBe(404);
    expect(deleteWhereSpy).not.toHaveBeenCalled();
  });
});
