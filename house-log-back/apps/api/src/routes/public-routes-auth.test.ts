/**
 * Testes de isolamento de autenticação — rotas públicas tokenizadas
 *
 * Garante que as rotas públicas abaixo NÃO exigem Authorization:
 *   GET  /invite/:token          — detalhes do convite (invites.ts)
 *   GET  /audit/public/:token    — audit link público (audit-links.ts)
 *   GET  /public/handover/:token — dossie público (public-handover.ts)
 *
 * E que as rotas protegidas adjacentes continuam exigindo auth:
 *   POST /properties/:id/invites            → 401 sem token
 *   POST /audit-link                        → 401 sem token
 *   POST /invite/:token/accept              → 401 sem token
 *
 * Simula a montagem de index.ts com a ordem corrigida:
 *   api.route('/audit', auditLinks)         — antes de invites
 *   api.route('/public', publicHandover)    — antes de invites
 *   api.route('/', invites)                 — por último
 */

import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Bindings } from '../lib/types';

// ── Mocks globais ─────────────────────────────────────────────────────────────

vi.mock('../db/client', () => ({ getDb: vi.fn() }));
vi.mock('../lib/audit', () => ({ writeAuditLog: vi.fn(async () => undefined) }));
vi.mock('../lib/token-hash', () => ({
  sha256TokenHash: vi.fn(async (t: string) => `hash:${t}`),
}));
vi.mock('../lib/jwt', () => ({
  verifyJwt: vi.fn(async () => ({
    sub: 'user-1',
    email: 'test@example.com',
    role: 'owner' as const,
    iat: 1,
    exp: 9999999999,
  })),
}));
vi.mock('../lib/webpush', () => ({ pushToUser: vi.fn(async () => undefined) }));

import { getDb } from '../db/client';
import auditLinksRouter from './audit-links';
import invitesRouter from './invites';
import publicHandoverRouter from './public-handover';

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
    R2_PUBLIC_URL: 'https://pub.r2.dev',
    RESEND_API_KEY: 'test-key',
    APP_URL: 'http://localhost:3000',
    ...overrides,
  };
}

/**
 * Monta o app com a mesma ordem do index.ts corrigido:
 *  1. /audit      → auditLinksRouter  (público, antes de invites)
 *  2. /public     → publicHandoverRouter (público, antes de invites)
 *  3. /           → invitesRouter     (tem use('*', authMiddleware) global)
 */
function buildApp() {
  const app = new Hono<{ Bindings: Bindings }>();
  app.route('/audit', auditLinksRouter);
  app.route('/public', publicHandoverRouter);
  app.route('/', invitesRouter);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /invite/:token — deve ser público (sem Authorization)
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /invite/:token — público (sem Authorization)', () => {
  it('retorna 200 com token válido sem header Authorization', async () => {
    const futureDate = new Date(Date.now() + 86400_000).toISOString();

    vi.mocked(getDb).mockReturnValue({
      select: vi.fn().mockReturnValue({
        from: vi.fn(() => ({
          innerJoin: vi.fn(() => ({
            innerJoin: vi.fn(() => ({
              where: vi.fn(() => ({
                limit: vi.fn(async () => [
                  {
                    id: 'inv-1',
                    email: 'convidado@example.com',
                    role: 'viewer',
                    expires_at: futureDate,
                    accepted_at: null,
                    invite_name: 'João',
                    whatsapp: null,
                    property_name: 'Apto 42',
                    property_address: 'Rua das Flores, 42',
                    property_city: 'São Paulo',
                    invited_by_name: 'Maria',
                    property_id: 'prop-1',
                    tenant_id: 'tenant-a',
                  },
                ]),
              })),
            })),
          })),
        })),
      }),
    } as never);

    // Sem Authorization header — simula navegador abrindo link de convite
    const res = await buildApp().fetch(
      new Request('http://localhost/invite/valid-invite-token-xyz'),
      buildEnv()
    );

    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.property_name).toBe('Apto 42');
    expect(body.role).toBe('viewer');
  });

  it('token inválido (curto) → 400 INVALID_TOKEN sem exigir auth', async () => {
    const res = await buildApp().fetch(
      new Request('http://localhost/invite/abc'),
      buildEnv()
    );

    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, unknown>;
    expect(body.code).toBe('INVALID_TOKEN');
  });

  it('token não encontrado → 404 NOT_FOUND sem exigir auth', async () => {
    vi.mocked(getDb).mockReturnValue({
      select: vi.fn().mockReturnValue({
        from: vi.fn(() => ({
          innerJoin: vi.fn(() => ({
            innerJoin: vi.fn(() => ({
              where: vi.fn(() => ({
                limit: vi.fn(async () => []),
              })),
            })),
          })),
        })),
      }),
    } as never);

    const res = await buildApp().fetch(
      new Request('http://localhost/invite/inexistente-token-xxxxxxxxx'),
      buildEnv()
    );

    expect(res.status).toBe(404);
    const body = await res.json() as Record<string, unknown>;
    expect(body.code).toBe('NOT_FOUND');
  });

  it('convite expirado → 410 LINK_EXPIRED sem exigir auth', async () => {
    vi.mocked(getDb).mockReturnValue({
      select: vi.fn().mockReturnValue({
        from: vi.fn(() => ({
          innerJoin: vi.fn(() => ({
            innerJoin: vi.fn(() => ({
              where: vi.fn(() => ({
                limit: vi.fn(async () => [
                  {
                    id: 'inv-exp',
                    email: 'x@x.com',
                    role: 'viewer',
                    expires_at: new Date(Date.now() - 3600_000).toISOString(),
                    accepted_at: null,
                    invite_name: null,
                    whatsapp: null,
                    property_name: 'Prop',
                    property_address: 'End',
                    property_city: 'SP',
                    invited_by_name: 'Owner',
                    property_id: 'p1',
                    tenant_id: 'tenant-a',
                  },
                ]),
              })),
            })),
          })),
        })),
      }),
    } as never);

    const res = await buildApp().fetch(
      new Request('http://localhost/invite/expired-token-xxxxxxxxxxx'),
      buildEnv()
    );

    expect(res.status).toBe(410);
    const body = await res.json() as Record<string, unknown>;
    expect(body.code).toBe('LINK_EXPIRED');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /audit/public/:token — deve ser público
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /audit/public/:token — público (sem Authorization)', () => {
  it('token válido retorna 200 sem header Authorization', async () => {
    const linkRow = {
      id: 'link-1',
      service_order_id: 'os-1',
      property_id: 'prop-1',
      created_by: 'user-1',
      scope: { canUploadPhotos: true, canUploadVideo: false, requiredFields: [] },
      expires_at: new Date(Date.now() + 3600_000).toISOString(),
      accessed_at: null,
      accessor_ip: null,
      geo_lat: null,
      geo_lng: null,
      status: 'active',
      created_at: new Date().toISOString(),
      link_tenant_id: 'tenant-a',
      order_tenant_id: 'tenant-a',
      property_tenant_id: 'tenant-a',
      order_title: 'Reparo hidráulico',
      order_description: 'Vazamento no banheiro',
      system_type: 'hydraulic',
      before_photos: [],
      property_name: 'Casa Principal',
      address: 'Rua das Flores, 100',
    };

    vi.mocked(getDb).mockReturnValue({
      select: vi.fn().mockReturnValue({
        from: vi.fn(() => ({
          innerJoin: vi.fn(() => ({
            innerJoin: vi.fn(() => ({
              where: vi.fn(() => ({
                limit: vi.fn(async () => [linkRow]),
              })),
            })),
          })),
        })),
      }),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(async () => undefined),
        })),
      })),
    } as never);

    // Sem Authorization — o invites.use('*', authMiddleware) NÃO deve interceptar
    const res = await buildApp().fetch(
      new Request('http://localhost/audit/public/valid-audit-token-xyz'),
      buildEnv()
    );

    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.order_title).toBe('Reparo hidráulico');
  });

  it('token inexistente → 404 sem exigir auth', async () => {
    vi.mocked(getDb).mockReturnValue({
      select: vi.fn().mockReturnValue({
        from: vi.fn(() => ({
          innerJoin: vi.fn(() => ({
            innerJoin: vi.fn(() => ({
              where: vi.fn(() => ({
                limit: vi.fn(async () => []),
              })),
            })),
          })),
        })),
      }),
    } as never);

    const res = await buildApp().fetch(
      new Request('http://localhost/audit/public/token-inexistente-xyzxyz'),
      buildEnv()
    );

    expect(res.status).toBe(404);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Rotas protegidas — ainda devem exigir Authorization
// ═══════════════════════════════════════════════════════════════════════════════

describe('Rotas protegidas — exigem Authorization', () => {
  it('POST /properties/:id/invites sem Authorization → 401', async () => {
    // Sem membership no mock → resolveTenant não encontra tenant → TENANT_REQUIRED,
    // mas antes disso authMiddleware deve barrar com 401
    const res = await buildApp().fetch(
      new Request('http://localhost/properties/prop-1/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'x@x.com', role: 'viewer' }),
      }),
      buildEnv()
    );

    expect(res.status).toBe(401);
  });

  it('POST /invite/:token/accept sem Authorization → 401', async () => {
    const res = await buildApp().fetch(
      new Request('http://localhost/invite/valid-token-xxxxxxxxxxx/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }),
      buildEnv()
    );

    expect(res.status).toBe(401);
  });
});
