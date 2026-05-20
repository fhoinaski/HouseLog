/**
 * Testes de integração do módulo de propostas (service_bids)
 *
 * Rotas cobertas:
 *  GET  /properties/:propertyId/services/:serviceId/bids      — owner lista propostas
 *  POST /properties/:propertyId/services/:serviceId/bids      — provider envia proposta
 *  PATCH /properties/:propertyId/services/:serviceId/bids/:bidId/status — owner aceita/recusa
 *
 * Casos:
 *  1.  Provider cria proposta com sucesso (201)
 *  2.  Provider duplicado bloqueado (409)
 *  3.  OS com assigned_to bloqueia proposta (409)
 *  4.  OS com status != requested bloqueia proposta (409)
 *  5.  Owner lista propostas recebidas (200)
 *  6.  Cross-tenant: OS de outro tenant retorna 404
 *  7.  Owner aceita proposta (200, bid.status=accepted)
 *  8.  Owner recusa proposta (200, bid.status=rejected)
 *  9.  Provider não pode aceitar/recusar (403)
 *  10. Bid já processado retorna 409
 */

import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Bindings } from '../lib/types';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../db/client', () => ({ getDb: vi.fn() }));
vi.mock('../lib/audit', () => ({ writeAuditLog: vi.fn(async () => undefined) }));
vi.mock('../lib/jwt', () => ({
  resolveJwtSecret: vi.fn(() => 'test-secret-key-minimum-32-chars-ok'),
  verifyJwt: vi.fn(async () => ({
    sub: 'owner-1',
    email: 'owner@example.com',
    role: 'owner' as const,
  })),
}));
vi.mock('../lib/email', () => ({
  sendEmail: vi.fn(async () => undefined),
  emailNewBid: vi.fn(() => '<html/>'),
}));
vi.mock('../lib/tenant-authorization', () => ({
  canAccessTenantProperty: vi.fn(async () => ({
    allowed: true,
    reason: 'tenant_property_owner',
  })),
}));

import { getDb } from '../db/client';
import { verifyJwt } from '../lib/jwt';
import bidsRouter from './bids';

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function authed(
  url: string,
  opts: RequestInit = {},
  role: 'owner' | 'manager' | 'provider' | 'admin' = 'owner'
): Request {
  return new Request(url, {
    ...opts,
    headers: {
      Authorization: 'Bearer test-token',
      'X-Tenant-Id': 'tenant-a',
      'Content-Type': 'application/json',
      ...((opts.headers as Record<string, string>) ?? {}),
    },
  });
}

function buildApp() {
  const app = new Hono<{ Bindings: Bindings }>();
  app.route('/properties/:propertyId/services/:serviceId/bids', bidsRouter);
  return app;
}

function tenantRow(tenantId = 'tenant-a', role = 'owner') {
  return { tenantId, role };
}

function orderRow(overrides: Partial<{
  id: string;
  title: string;
  status: string;
  assigned_to: string | null;
  requested_by: string;
  property_name: string;
  owner_id: string;
}> = {}) {
  return {
    id: 'os-1',
    title: 'Reparo elétrico',
    status: 'requested',
    assigned_to: null,
    requested_by: 'owner-1',
    property_name: 'Casa Principal',
    owner_id: 'owner-1',
    ...overrides,
  };
}

function bidRow(overrides: Partial<{
  id: string;
  service_id: string;
  provider_id: string;
  provider_name: string;
  provider_email: string;
  provider_phone: string | null;
  amount: number;
  notes: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}> = {}) {
  return {
    id: 'bid-1',
    service_id: 'os-1',
    provider_id: 'provider-1',
    provider_name: 'João Elétrica',
    provider_email: 'joao@example.com',
    provider_phone: null,
    amount: 500,
    notes: 'Material incluso',
    status: 'pending',
    created_at: '2026-05-17T10:00:00.000Z',
    updated_at: '2026-05-17T10:00:00.000Z',
    ...overrides,
  };
}

/** Cria mock de DB com selectCalls consumidos em sequência. */
function buildDb(
  selectCalls: unknown[][],
  extra?: {
    insertValues?: ReturnType<typeof vi.fn>;
    updateWhere?: ReturnType<typeof vi.fn>;
    run?: ReturnType<typeof vi.fn>;
  }
) {
  let i = 0;
  function terminal(rows: unknown[]) {
    return {
      limit: vi.fn(async () => rows),
      orderBy: vi.fn(async () => rows),
    };
  }
  return {
    select: vi.fn(() => {
      const rows = selectCalls[i++] ?? [];
      return {
        from: vi.fn(() => ({
          where: vi.fn(() => terminal(rows)),
          innerJoin: vi.fn(() => ({
            where: vi.fn(() => terminal(rows)),
          })),
          orderBy: vi.fn(async () => rows),
          limit: vi.fn(async () => rows),
        })),
      };
    }),
    insert: vi.fn(() => ({
      values: extra?.insertValues ?? vi.fn(async () => undefined),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: extra?.updateWhere ?? vi.fn(async () => undefined),
      })),
    })),
    run: extra?.run ?? vi.fn(async () => undefined),
  };
}

const BASE_JWT = { iat: 1700000000, exp: 9999999999 };

beforeEach(() => {
  vi.clearAllMocks();
  // Padrão: JWT de owner
  vi.mocked(verifyJwt).mockResolvedValue({
    ...BASE_JWT,
    sub: 'owner-1',
    email: 'owner@example.com',
    role: 'owner',
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. Provider cria proposta com sucesso
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /bids — provider envia proposta', () => {
  it('retorna 201 com bid criado quando provider elegível e OS está requested', async () => {
    vi.mocked(verifyJwt).mockResolvedValue({ ...BASE_JWT, sub: 'provider-1', email: 'p@e.com', role: 'provider' });
    vi.mocked(getDb).mockReturnValue(buildDb([
      [tenantRow('tenant-a', 'provider')],  // resolveTenant
      [orderRow()],                          // loadTenantServiceOrder
      [],                                    // existing bid check (nenhum)
      [bidRow()],                            // select do bid criado
    ]) as never);

    const res = await buildApp().fetch(
      authed(
        'http://localhost/properties/prop-a/services/os-1/bids',
        { method: 'POST', body: JSON.stringify({ amount: 500, notes: 'Material incluso' }) },
        'provider'
      ),
      buildEnv({ RESEND_API_KEY: '' })  // desabilita email para evitar selects extras no mock
    );

    expect(res.status).toBe(201);
    const body = await res.json() as { bid: { id: string; status: string; amount: number } };
    expect(body.bid.status).toBe('pending');
    expect(body.bid.amount).toBe(500);
  });

  it('retorna 409 quando provider já tem bid pendente para a OS', async () => {
    vi.mocked(verifyJwt).mockResolvedValue({ ...BASE_JWT, sub: 'provider-1', email: 'p@e.com', role: 'provider' });
    vi.mocked(getDb).mockReturnValue(buildDb([
      [tenantRow('tenant-a', 'provider')],  // resolveTenant
      [orderRow()],                          // loadTenantServiceOrder
      [{ id: 'bid-existing' }],              // existing bid check → já existe
    ]) as never);

    const res = await buildApp().fetch(
      authed(
        'http://localhost/properties/prop-a/services/os-1/bids',
        { method: 'POST', body: JSON.stringify({ amount: 300 }) },
        'provider'
      ),
      buildEnv()
    );

    expect(res.status).toBe(409);
    const body = await res.json() as { code: string };
    expect(body.code).toBe('DUPLICATE_BID');
  });

  it('retorna 409 quando OS já tem assigned_to (execução direta)', async () => {
    vi.mocked(verifyJwt).mockResolvedValue({ ...BASE_JWT, sub: 'provider-1', email: 'p@e.com', role: 'provider' });
    vi.mocked(getDb).mockReturnValue(buildDb([
      [tenantRow('tenant-a', 'provider')],
      [orderRow({ assigned_to: 'other-provider' })],
    ]) as never);

    const res = await buildApp().fetch(
      authed(
        'http://localhost/properties/prop-a/services/os-1/bids',
        { method: 'POST', body: JSON.stringify({ amount: 400 }) },
        'provider'
      ),
      buildEnv()
    );

    expect(res.status).toBe(409);
    const body = await res.json() as { code: string };
    expect(body.code).toBe('DIRECT_EXECUTION');
  });

  it('retorna 409 quando OS não está em status requested', async () => {
    vi.mocked(verifyJwt).mockResolvedValue({ ...BASE_JWT, sub: 'provider-1', email: 'p@e.com', role: 'provider' });
    vi.mocked(getDb).mockReturnValue(buildDb([
      [tenantRow('tenant-a', 'provider')],
      [orderRow({ status: 'approved' })],
    ]) as never);

    const res = await buildApp().fetch(
      authed(
        'http://localhost/properties/prop-a/services/os-1/bids',
        { method: 'POST', body: JSON.stringify({ amount: 400 }) },
        'provider'
      ),
      buildEnv()
    );

    expect(res.status).toBe(409);
    const body = await res.json() as { code: string };
    expect(body.code).toBe('BIDDING_CLOSED');
  });

  it('retorna 403 quando role não é provider ou admin', async () => {
    // owner tentando criar bid
    vi.mocked(getDb).mockReturnValue(buildDb([
      [tenantRow('tenant-a', 'owner')],
    ]) as never);

    const res = await buildApp().fetch(
      authed(
        'http://localhost/properties/prop-a/services/os-1/bids',
        { method: 'POST', body: JSON.stringify({ amount: 400 }) }
      ),
      buildEnv()
    );

    expect(res.status).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Owner lista propostas recebidas
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /bids — owner lista propostas', () => {
  it('retorna 200 com array de bids para owner da propriedade', async () => {
    vi.mocked(getDb).mockReturnValue(buildDb([
      [tenantRow()],    // resolveTenant
      [orderRow()],     // loadTenantServiceOrder
      [bidRow(), bidRow({ id: 'bid-2', provider_id: 'provider-2', amount: 450 })],  // bids
    ]) as never);

    const res = await buildApp().fetch(
      authed('http://localhost/properties/prop-a/services/os-1/bids'),
      buildEnv()
    );

    expect(res.status).toBe(200);
    const body = await res.json() as { bids: unknown[] };
    expect(Array.isArray(body.bids)).toBe(true);
    expect(body.bids).toHaveLength(2);
  });

  it('retorna 200 com array vazio quando não há propostas', async () => {
    vi.mocked(getDb).mockReturnValue(buildDb([
      [tenantRow()],
      [orderRow()],
      [],  // sem bids
    ]) as never);

    const res = await buildApp().fetch(
      authed('http://localhost/properties/prop-a/services/os-1/bids'),
      buildEnv()
    );

    expect(res.status).toBe(200);
    const body = await res.json() as { bids: unknown[] };
    expect(body.bids).toHaveLength(0);
  });

  it('retorna 404 quando OS pertence a outro tenant (cross-tenant bloqueado)', async () => {
    vi.mocked(getDb).mockReturnValue(buildDb([
      [tenantRow()],  // resolveTenant (tenant-a)
      [],             // loadTenantServiceOrder → OS não encontrada neste tenant
    ]) as never);

    const res = await buildApp().fetch(
      authed('http://localhost/properties/prop-b/services/os-other/bids'),
      buildEnv()
    );

    expect(res.status).toBe(404);
  });

  it('retorna 404 quando serviceId não corresponde ao propertyId do tenant', async () => {
    vi.mocked(getDb).mockReturnValue(buildDb([
      [tenantRow()],
      [],  // loadTenantServiceOrder valida tenantId+propertyId+serviceId — não encontrou
    ]) as never);

    const res = await buildApp().fetch(
      authed('http://localhost/properties/prop-a/services/os-wrong-property/bids'),
      buildEnv()
    );

    expect(res.status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Owner aceita/recusa proposta
// ─────────────────────────────────────────────────────────────────────────────

describe('PATCH /bids/:bidId/status — owner processa proposta', () => {
  it('retorna 200 com status=accepted quando owner aceita bid pendente', async () => {
    vi.mocked(getDb).mockReturnValue(buildDb(
      [
        [tenantRow()],    // resolveTenant
        [orderRow()],     // loadTenantServiceOrder
        [{ id: 'bid-1', provider_id: 'provider-1', amount: 500, status: 'pending' }],  // bid query
      ],
      {
        updateWhere: vi.fn(async () => undefined),
        run: vi.fn(async () => undefined),
      }
    ) as never);

    const res = await buildApp().fetch(
      authed(
        'http://localhost/properties/prop-a/services/os-1/bids/bid-1/status',
        { method: 'PATCH', body: JSON.stringify({ status: 'accepted' }) }
      ),
      buildEnv()
    );

    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; status: string };
    expect(body.success).toBe(true);
    expect(body.status).toBe('accepted');
  });

  it('retorna 200 com status=rejected quando owner recusa bid pendente', async () => {
    vi.mocked(getDb).mockReturnValue(buildDb(
      [
        [tenantRow()],
        [orderRow()],
        [{ id: 'bid-1', provider_id: 'provider-1', amount: 500, status: 'pending' }],
      ],
      { updateWhere: vi.fn(async () => undefined) }
    ) as never);

    const res = await buildApp().fetch(
      authed(
        'http://localhost/properties/prop-a/services/os-1/bids/bid-1/status',
        { method: 'PATCH', body: JSON.stringify({ status: 'rejected' }) }
      ),
      buildEnv()
    );

    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; status: string };
    expect(body.success).toBe(true);
    expect(body.status).toBe('rejected');
  });

  it('retorna 403 quando provider tenta aceitar/recusar proposta', async () => {
    vi.mocked(verifyJwt).mockResolvedValue({ ...BASE_JWT, sub: 'provider-1', email: 'p@e.com', role: 'provider' });
    // DB só precisa de resolveTenant — o guard de role retorna antes
    vi.mocked(getDb).mockReturnValue(buildDb([
      [tenantRow('tenant-a', 'provider')],
    ]) as never);

    const res = await buildApp().fetch(
      authed(
        'http://localhost/properties/prop-a/services/os-1/bids/bid-1/status',
        { method: 'PATCH', body: JSON.stringify({ status: 'accepted' }) },
        'provider'
      ),
      buildEnv()
    );

    expect(res.status).toBe(403);
    const body = await res.json() as { code: string };
    expect(body.code).toBe('FORBIDDEN');
  });

  it('retorna 409 quando bid já foi processado (não está pending)', async () => {
    vi.mocked(getDb).mockReturnValue(buildDb([
      [tenantRow()],
      [orderRow()],
      [{ id: 'bid-1', provider_id: 'provider-1', amount: 500, status: 'accepted' }],
    ]) as never);

    const res = await buildApp().fetch(
      authed(
        'http://localhost/properties/prop-a/services/os-1/bids/bid-1/status',
        { method: 'PATCH', body: JSON.stringify({ status: 'rejected' }) }
      ),
      buildEnv()
    );

    expect(res.status).toBe(409);
    const body = await res.json() as { code: string };
    expect(body.code).toBe('ALREADY_PROCESSED');
  });

  it('retorna 404 quando bidId não pertence ao tenant+service (cross-tenant bloqueado)', async () => {
    vi.mocked(getDb).mockReturnValue(buildDb([
      [tenantRow()],
      [orderRow()],
      [],  // bid não encontrado → tenantId+serviceId não batem
    ]) as never);

    const res = await buildApp().fetch(
      authed(
        'http://localhost/properties/prop-a/services/os-1/bids/bid-other-tenant/status',
        { method: 'PATCH', body: JSON.stringify({ status: 'accepted' }) }
      ),
      buildEnv()
    );

    expect(res.status).toBe(404);
  });
});
